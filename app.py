from flask import Flask, request, jsonify, render_template_string
from datetime import datetime, timedelta
import logging
from collections import deque
import paho.mqtt.client as mqtt
import json
import threading
import time
import sqlite3
import os
from contextlib import contextmanager

app = Flask(__name__)

# Enhanced logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('broodinnox.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)


# Database initialization
def init_db():
    conn = sqlite3.connect('broodinnox.db')
    cursor = conn.cursor()

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS temperature_data (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            device_id TEXT,
            temperature REAL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS relay_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            device_id TEXT,
            state TEXT,
            mode TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS alerts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            device_id TEXT,
            alert_type TEXT,
            message TEXT,
            severity TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            resolved BOOLEAN DEFAULT FALSE
        )
    ''')

    conn.commit()
    conn.close()


init_db()


@contextmanager
def get_db_connection():
    conn = sqlite3.connect('broodinnox.db')
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()


# Global variables
device_status = {}
active_alerts = deque(maxlen=20)
DEVICE_ID = "broodinnox_001"
system_start_time = datetime.now()

historical_data = {
    DEVICE_ID: {
        "temperatures": deque(maxlen=200),
        "timestamps": deque(maxlen=200),
        "relay_states": deque(maxlen=200)
    }
}

# MQTT Configuration
MQTT_BROKER = "broker.hivemq.com"
MQTT_PORT = 1883
MQTT_TOPICS = {
    "data": "broodinnox/data",
    "relay": "broodinnox/control/relay",
    "max_temp": "broodinnox/control/max_temp",
    "min_temp": "broodinnox/control/min_temp",
    "total_days": "broodinnox/control/total_days",
    "sensor": "broodinnox/control/sensor",
    "status": "broodinnox/status"
}

mqtt_client = mqtt.Client(client_id=f"broodinnox_dashboard_{int(time.time())}")
mqtt_client.reconnect_delay_set(min_delay=1, max_delay=120)

# HTML Template
HTML_TEMPLATE = '''
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>🐥 Broodinnox Pro - Smart Brooding System</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <style>
        :root {
            --primary: #3498db;
            --secondary: #2c3e50;
            --success: #27ae60;
            --warning: #f39c12;
            --danger: #e74c3c;
            --light: #f8f9fa;
            --dark: #343a40;
            --gradient: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            --card-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
        }

        * { margin: 0; padding: 0; box-sizing: border-box; }

        body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            background: var(--gradient); 
            min-height: 100vh; 
            padding: 20px; 
            color: var(--dark);
        }

        .container { max-width: 1800px; margin: 0 auto; }

        .header { 
            background: rgba(255, 255, 255, 0.95); 
            padding: 30px; 
            border-radius: 20px; 
            margin-bottom: 20px; 
            box-shadow: var(--card-shadow); 
            text-align: center;
            position: relative;
        }

        .header::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 4px;
            background: linear-gradient(90deg, var(--primary), var(--success), var(--warning), var(--danger));
        }

        .header h1 { 
            color: var(--secondary); 
            font-size: 2.5em; 
            margin-bottom: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 15px;
        }

        .stats-bar {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin-top: 20px;
        }

        .stat-item {
            background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
            padding: 15px;
            border-radius: 12px;
            text-align: center;
            border-left: 4px solid var(--primary);
        }

        .stat-item .label {
            font-size: 0.85em;
            color: #7f8c8d;
            text-transform: uppercase;
            font-weight: 600;
        }

        .stat-item .value {
            font-size: 1.5em;
            font-weight: bold;
            color: var(--secondary);
            margin-top: 5px;
        }

        .dashboard { 
            display: grid; 
            grid-template-columns: 1fr 1fr 1fr; 
            gap: 20px; 
            margin-bottom: 20px; 
        }

        @media (max-width: 1600px) { 
            .dashboard { grid-template-columns: 1fr 1fr; } 
        }

        @media (max-width: 1200px) { 
            .dashboard { grid-template-columns: 1fr; } 
        }

        .card { 
            background: rgba(255, 255, 255, 0.95); 
            padding: 25px; 
            border-radius: 15px; 
            box-shadow: var(--card-shadow); 
            transition: transform 0.3s ease;
        }

        .card:hover {
            transform: translateY(-5px);
        }

        .card h2 { 
            color: var(--secondary); 
            margin-bottom: 20px; 
            font-size: 1.4em; 
            border-bottom: 2px solid var(--primary); 
            padding-bottom: 10px;
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .status-grid { 
            display: grid; 
            grid-template-columns: repeat(2, 1fr); 
            gap: 15px; 
            margin-bottom: 20px; 
        }

        .status-item { 
            background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); 
            padding: 20px; 
            border-radius: 10px; 
            text-align: center; 
            border-left: 4px solid var(--primary);
        }

        .status-item .label { 
            font-size: 0.9em; 
            color: #7f8c8d; 
            margin-bottom: 5px; 
            text-transform: uppercase; 
            font-weight: 600; 
        }

        .status-item .value { 
            font-size: 1.8em; 
            font-weight: bold; 
            color: var(--secondary); 
        }

        .online { color: var(--success) !important; }
        .offline { color: var(--danger) !important; }
        .heating-on { 
            color: var(--danger) !important; 
            animation: pulse 1.5s infinite; 
        }

        @keyframes pulse { 
            0%, 100% { opacity: 1; } 
            50% { opacity: 0.5; } 
        }

        .heating-off { color: var(--success) !important; }

        .control-panel { 
            display: grid; 
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); 
            gap: 15px; 
            margin-top: 15px; 
        }

        .control-group { 
            background: #f8f9fa; 
            padding: 15px; 
            border-radius: 10px; 
        }

        .control-group label { 
            display: block; 
            margin-bottom: 8px; 
            font-weight: 600; 
            color: var(--secondary);
            font-size: 0.9em;
        }

        .control-group input, .control-group select { 
            width: 100%; 
            padding: 10px; 
            border: 2px solid #ddd; 
            border-radius: 8px; 
            font-size: 1em; 
        }

        .control-group input:focus, .control-group select:focus { 
            outline: none; 
            border-color: var(--primary); 
        }

        .btn { 
            background: linear-gradient(135deg, var(--primary) 0%, #2980b9 100%); 
            color: white; 
            border: none; 
            padding: 12px 20px; 
            border-radius: 8px; 
            cursor: pointer; 
            font-size: 0.95em; 
            font-weight: 600; 
            transition: all 0.3s ease; 
            margin-top: 10px; 
            width: 100%; 
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
        }

        .btn:hover { 
            transform: translateY(-2px); 
            box-shadow: 0 5px 15px rgba(52, 152, 219, 0.4); 
        }

        .btn-danger { background: linear-gradient(135deg, var(--danger) 0%, #c0392b 100%); }
        .btn-success { background: linear-gradient(135deg, var(--success) 0%, #229954 100%); }
        .btn-warning { background: linear-gradient(135deg, var(--warning) 0%, #e67e22 100%); }

        .sensor-grid { 
            display: grid; 
            grid-template-columns: repeat(2, 1fr); 
            gap: 15px; 
            margin-top: 15px; 
        }

        .sensor-card { 
            background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); 
            padding: 15px; 
            border-radius: 10px; 
            text-align: center; 
            border-top: 4px solid var(--primary);
        }

        .sensor-card.active { border-top-color: var(--success); }
        .sensor-card.inactive { border-top-color: var(--danger); opacity: 0.6; }
        .sensor-card .sensor-value { font-size: 1.3em; font-weight: bold; margin: 5px 0; }
        .sensor-card .sensor-label { font-size: 0.8em; color: #7f8c8d; text-transform: uppercase; }
        .sensor-card .sensor-status { font-size: 0.75em; color: #7f8c8d; margin-top: 5px; }

        .chart-container { height: 300px; margin-top: 15px; }
        .large-chart { height: 400px; }

        .alert { 
            padding: 12px 15px; 
            border-radius: 8px; 
            margin: 8px 0; 
            font-size: 0.9em;
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .alert-success { background: #d4edda; color: #155724; }
        .alert-error { background: #f8d7da; color: #721c24; }
        .alert-info { background: #d1ecf1; color: #0c5460; }

        .connection-status { 
            position: fixed; 
            top: 10px; 
            right: 10px; 
            padding: 10px 15px; 
            border-radius: 8px; 
            font-weight: 600;
            font-size: 0.9em;
            z-index: 1000;
            display: flex;
            align-items: center;
            gap: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        }

        .connected { background: #d4edda; color: #155724; }
        .disconnected { background: #f8d7da; color: #721c24; }

        .mode-badge { 
            display: inline-block; 
            padding: 4px 10px; 
            border-radius: 5px; 
            font-size: 0.85em;
            font-weight: 600;
        }

        .mode-auto { background: var(--success); color: white; }
        .mode-manual { background: var(--warning); color: white; }

        .progress-bar {
            height: 10px;
            background: #e9ecef;
            border-radius: 5px;
            overflow: hidden;
            margin: 10px 0;
        }

        .progress-fill {
            height: 100%;
            background: linear-gradient(90deg, var(--success), var(--primary));
            transition: width 0.5s ease;
        }

        .analytics-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 15px;
            margin-top: 15px;
        }

        .analytics-card {
            background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
            padding: 15px;
            border-radius: 10px;
            text-align: center;
        }

        .analytics-value {
            font-size: 1.6em;
            font-weight: bold;
            margin: 8px 0;
            color: var(--secondary);
        }

        .analytics-label {
            font-size: 0.8em;
            color: #7f8c8d;
            text-transform: uppercase;
            font-weight: 600;
        }

        .system-controls { 
            display: grid; 
            grid-template-columns: repeat(3, 1fr); 
            gap: 10px; 
            margin-top: 15px; 
        }

        .last-update {
            text-align: center;
            margin-top: 15px;
            color: #7f8c8d;
            font-size: 0.85em;
        }

        .info-box {
            background: #f8f9fa;
            padding: 15px;
            border-radius: 8px;
            margin-top: 15px;
        }

        .info-box p {
            margin: 8px 0;
            font-size: 0.9em;
        }

        .info-box strong {
            color: var(--secondary);
        }

        #messageContainer {
            position: fixed;
            bottom: 20px;
            right: 20px;
            z-index: 1000;
            max-width: 400px;
        }

        .alert-container {
            max-height: 300px;
            overflow-y: auto;
        }

        .alert-item {
            background: #fff;
            border-left: 4px solid var(--warning);
            padding: 12px;
            margin: 8px 0;
            border-radius: 5px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }

        .alert-item.severity-error {
            border-left-color: var(--danger);
        }

        .alert-item.severity-info {
            border-left-color: var(--primary);
        }

        .alert-time {
            font-size: 0.75em;
            color: #7f8c8d;
            margin-top: 5px;
        }
    </style>
</head>
<body>
    <div id="connectionStatus" class="connection-status disconnected">
        <i class="fas fa-circle"></i>
        <span>MQTT Disconnected</span>
    </div>

    <div class="container">
        <div class="header">
            <h1>
                <i class="fas fa-egg"></i>
                Broodinnox Pro
            </h1>
            <div style="color: #7f8c8d; font-size: 1.1em;">Advanced Poultry Brooding Management</div>

            <div class="stats-bar">
                <div class="stat-item">
                    <div class="label"><i class="fas fa-clock"></i> Uptime</div>
                    <div class="value" id="systemUptime">00:00:00</div>
                </div>
                <div class="stat-item">
                    <div class="label"><i class="fas fa-database"></i> Data Points</div>
                    <div class="value" id="dataPoints">0</div>
                </div>
                <div class="stat-item">
                    <div class="label"><i class="fas fa-bell"></i> Active Alerts</div>
                    <div class="value" id="activeAlertCount">0</div>
                </div>
                <div class="stat-item">
                    <div class="label"><i class="fas fa-bolt"></i> Energy Used</div>
                    <div class="value" id="energyUsed">0.0 kWh</div>
                </div>
            </div>
        </div>

        <div class="dashboard">
            <!-- Column 1: System Status & Temperature Control -->
            <div class="column">
                <div class="card">
                    <h2><i class="fas fa-heartbeat"></i> System Status</h2>
                    <div class="status-grid" id="statusGrid">
                        <div class="status-item">
                            <div class="label">Status</div>
                            <div class="value offline">OFFLINE</div>
                        </div>
                        <div class="status-item">
                            <div class="label">Current Day</div>
                            <div class="value">0/0</div>
                        </div>
                        <div class="status-item">
                            <div class="label">Temperature</div>
                            <div class="value">0.0°C</div>
                        </div>
                        <div class="status-item">
                            <div class="label">Heater</div>
                            <div class="value heating-off">OFF</div>
                        </div>
                    </div>

                    <div class="sensor-grid" id="sensorGrid">
                        <!-- Sensor cards will be populated by JavaScript -->
                    </div>

                    <div class="last-update" id="lastUpdate">
                        <i class="fas fa-sync-alt"></i> Last update: Never
                    </div>
                </div>

                <div class="card">
                    <h2><i class="fas fa-thermometer-half"></i> Temperature Control</h2>
                    <div class="control-panel">
                        <div class="control-group">
                            <label for="maxTemp"><i class="fas fa-fire"></i> Max Temperature (°C)</label>
                            <input type="number" id="maxTemp" min="20" max="50" step="1" value="36">
                            <button class="btn" onclick="updateMaxTemp()">
                                <i class="fas fa-check"></i> Update
                            </button>
                        </div>
                        <div class="control-group">
                            <label for="minTemp"><i class="fas fa-snowflake"></i> Min Temperature (°C)</label>
                            <input type="number" id="minTemp" min="15" max="45" step="1" value="32">
                            <button class="btn" onclick="updateMinTemp()">
                                <i class="fas fa-check"></i> Update
                            </button>
                        </div>
                    </div>

                    <div class="analytics-grid">
                        <div class="analytics-card">
                            <div class="analytics-label">24h Avg</div>
                            <div class="analytics-value" id="avg24h">-°C</div>
                        </div>
                        <div class="analytics-card">
                            <div class="analytics-label">24h High</div>
                            <div class="analytics-value" id="high24h">-°C</div>
                        </div>
                        <div class="analytics-card">
                            <div class="analytics-label">24h Low</div>
                            <div class="analytics-value" id="low24h">-°C</div>
                        </div>
                    </div>
                </div>

                <div class="card">
                    <h2><i class="fas fa-fire-alt"></i> Heater Control</h2>
                    <div class="system-controls">
                        <button class="btn btn-success" onclick="setRelay('ON')">
                            <i class="fas fa-power-off"></i> ON
                        </button>
                        <button class="btn btn-danger" onclick="setRelay('OFF')">
                            <i class="fas fa-power-off"></i> OFF
                        </button>
                        <button class="btn btn-warning" onclick="setRelay('AUTO')">
                            <i class="fas fa-robot"></i> AUTO
                        </button>
                    </div>
                    <div class="info-box">
                        <p><strong>Mode:</strong> <span id="relayMode" class="mode-badge mode-auto">AUTO</span></p>
                        <p><strong>Status:</strong> <span id="relayStatus">OFF</span></p>
                        <p><strong>Runtime Today:</strong> <span id="runtimeToday">0h 0m</span></p>
                    </div>
                </div>
            </div>

            <!-- Column 2: Charts & Analytics -->
            <div class="column">
                <div class="card">
                    <h2><i class="fas fa-chart-line"></i> Temperature History</h2>
                    <div class="chart-container large-chart">
                        <canvas id="tempChart"></canvas>
                    </div>
                </div>

                <div class="card">
                    <h2><i class="fas fa-microchip"></i> Sensor Management</h2>
                    <div class="control-panel">
                        <div class="control-group">
                            <label>DHT Sensor 1</label>
                            <select id="sensor1">
                                <option value="ON">Enabled</option>
                                <option value="OFF">Disabled</option>
                            </select>
                            <button class="btn" onclick="updateSensor(1)">
                                <i class="fas fa-sync"></i> Update
                            </button>
                        </div>
                        <div class="control-group">
                            <label>DHT Sensor 2</label>
                            <select id="sensor2">
                                <option value="ON">Enabled</option>
                                <option value="OFF">Disabled</option>
                            </select>
                            <button class="btn" onclick="updateSensor(2)">
                                <i class="fas fa-sync"></i> Update
                            </button>
                        </div>
                        <div class="control-group">
                            <label>DHT Sensor 3</label>
                            <select id="sensor3">
                                <option value="ON">Enabled</option>
                                <option value="OFF">Disabled</option>
                            </select>
                            <button class="btn" onclick="updateSensor(3)">
                                <i class="fas fa-sync"></i> Update
                            </button>
                        </div>
                        <div class="control-group">
                            <label>DHT Sensor 4</label>
                            <select id="sensor4">
                                <option value="ON">Enabled</option>
                                <option value="OFF">Disabled</option>
                            </select>
                            <button class="btn" onclick="updateSensor(4)">
                                <i class="fas fa-sync"></i> Update
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Column 3: Cycle Management & Alerts -->
            <div class="column">
                <div class="card">
                    <h2><i class="fas fa-calendar-alt"></i> Brooding Cycle</h2>
                    <div class="control-panel">
                        <div class="control-group">
                            <label for="totalDays">Total Days</label>
                            <input type="number" id="totalDays" min="1" max="365" step="1" value="30">
                            <button class="btn" onclick="updateTotalDays()">
                                <i class="fas fa-check"></i> Update
                            </button>
                        </div>
                    </div>
                    <div class="info-box">
                        <p><strong>Current Day:</strong> <span id="currentDay">0</span></p>
                        <p><strong>Remaining:</strong> <span id="remainingDays">0</span> days</p>
                        <p><strong>Progress:</strong></p>
                        <div class="progress-bar">
                            <div class="progress-fill" id="cycleProgress" style="width: 0%"></div>
                        </div>
                        <p style="text-align: center; margin-top: 5px;"><span id="progressText">0%</span></p>
                    </div>
                </div>

                <div class="card">
                    <h2><i class="fas fa-bell"></i> System Alerts</h2>
                    <div class="alert-container" id="alertsContainer">
                        <p style="text-align: center; color: #7f8c8d; padding: 20px;">No active alerts</p>
                    </div>
                    <button class="btn btn-warning" onclick="clearAlerts()" style="margin-top: 10px;">
                        <i class="fas fa-trash"></i> Clear Alerts
                    </button>
                </div>

                <div class="card">
                    <h2><i class="fas fa-info-circle"></i> System Info</h2>
                    <div class="info-box">
                        <p><strong>Device ID:</strong> broodinnox_001</p>
                        <p><strong>Firmware:</strong> <span id="firmwareVersion">2.1.0</span></p>
                        <p><strong>Error Status:</strong> <span id="errorStatus">NO ERROR</span></p>
                        <p><strong>Last Update:</strong> <span id="lastUpdateTime">Never</span></p>
                    </div>
                    <div class="system-controls" style="margin-top: 15px;">
                        <button class="btn" onclick="refreshData()">
                            <i class="fas fa-sync"></i> Refresh
                        </button>
                        <button class="btn btn-warning" onclick="exportData()">
                            <i class="fas fa-download"></i> Export
                        </button>
                        <button class="btn btn-danger" onclick="resetSystem()">
                            <i class="fas fa-redo"></i> Reset
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <div id="messageContainer"></div>

    <script>
        let tempChart;
        let lastData = {};
        const deviceId = 'broodinnox_001';
        let systemStartTime = new Date();

        // Initialize chart
        function initializeChart() {
            const ctx = document.getElementById('tempChart').getContext('2d');
            tempChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: [],
                    datasets: [
                        {
                            label: 'Avg Temperature',
                            data: [],
                            borderColor: '#3498db',
                            backgroundColor: 'rgba(52, 152, 219, 0.1)',
                            borderWidth: 3,
                            fill: true,
                            tension: 0.4
                        },
                        {
                            label: 'Max Threshold',
                            data: [],
                            borderColor: '#e74c3c',
                            borderWidth: 2,
                            borderDash: [5, 5],
                            fill: false
                        },
                        {
                            label: 'Min Threshold',
                            data: [],
                            borderColor: '#27ae60',
                            borderWidth: 2,
                            borderDash: [5, 5],
                            fill: false
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: false,
                            title: { display: true, text: 'Temperature (°C)' }
                        },
                        x: {
                            title: { display: true, text: 'Time' }
                        }
                    },
                    plugins: {
                        legend: { position: 'top' },
                        tooltip: { mode: 'index', intersect: false }
                    }
                }
            });
        }

        // Update chart
        function updateChart(data) {
            const now = new Date();
            const timeLabel = now.toLocaleTimeString();

            tempChart.data.labels.push(timeLabel);
            tempChart.data.datasets[0].data.push(data.temperature || 0);
            tempChart.data.datasets[1].data.push(data.max_temp || 0);
            tempChart.data.datasets[2].data.push(data.min_temp || 0);

            if (tempChart.data.labels.length > 20) {
                tempChart.data.labels.shift();
                tempChart.data.datasets.forEach(dataset => dataset.data.shift());
            }

            tempChart.update('none');
        }

        // Control functions
        async function setRelay(mode) {
            try {
                showMessage(`Setting heater to ${mode}...`, 'info');
                const response = await fetch('/control/relay', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ mode: mode })
                });

                const result = await response.json();
                if (result.success) {
                    showMessage(`✅ Heater set to ${mode}`, 'success');
                    setTimeout(refreshData, 1000);
                } else {
                    showMessage(`❌ ${result.message}`, 'error');
                }
            } catch (error) {
                showMessage(`❌ Error: ${error.message}`, 'error');
            }
        }

        async function updateMaxTemp() {
            const value = document.getElementById('maxTemp').value;
            await updateSetting('max_temp', value);
        }

        async function updateMinTemp() {
            const value = document.getElementById('minTemp').value;
            await updateSetting('min_temp', value);
        }

        async function updateTotalDays() {
            const value = document.getElementById('totalDays').value;
            await updateSetting('total_days', value);
        }

        async function updateSensor(sensorNum) {
            const value = document.getElementById('sensor' + sensorNum).value;
            await updateSetting('sensor', `${sensorNum}:${value}`);
        }

        async function updateSetting(setting, value) {
            try {
                showMessage(`Updating ${setting}...`, 'info');
                const response = await fetch('/control/setting', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ setting: setting, value: value })
                });

                const result = await response.json();
                if (result.success) {
                    showMessage(`✅ ${setting} updated successfully`, 'success');
                    setTimeout(refreshData, 1000);
                } else {
                    showMessage(`❌ Failed to update ${setting}`, 'error');
                }
            } catch (error) {
                showMessage(`❌ Error: ${error.message}`, 'error');
            }
        }

        // Refresh data
        async function refreshData() {
            try {
                const response = await fetch('/status?device=' + deviceId);
                const data = await response.json();
                updateDashboard(data);

                if (data.online) {
                    updateChart(data);
                }

                // Fetch analytics
                fetchAnalytics();
                fetchAlerts();
            } catch (error) {
                console.error('Error fetching data:', error);
            }
        }

        // Fetch analytics
        async function fetchAnalytics() {
            try {
                const response = await fetch('/api/analytics?device=' + deviceId);
                const data = await response.json();

                document.getElementById('avg24h').textContent = data.avg_temp_24h ? data.avg_temp_24h + '°C' : '-°C';
                document.getElementById('high24h').textContent = data.max_temp_24h ? data.max_temp_24h + '°C' : '-°C';
                document.getElementById('low24h').textContent = data.min_temp_24h ? data.min_temp_24h + '°C' : '-°C';
                document.getElementById('dataPoints').textContent = data.data_points_24h || 0;

                const hours = Math.floor(data.runtime_today / 60);
                const mins = data.runtime_today % 60;
                document.getElementById('runtimeToday').textContent = `${hours}h ${mins}m`;

                const energyUsed = (data.runtime_today / 60) * 1.5;
                document.getElementById('energyUsed').textContent = energyUsed.toFixed(2) + ' kWh';
            } catch (error) {
                console.error('Error fetching analytics:', error);
            }
        }

        // Fetch alerts
        async function fetchAlerts() {
            try {
                const response = await fetch('/api/alerts');
                const alerts = await response.json();

                const container = document.getElementById('alertsContainer');
                document.getElementById('activeAlertCount').textContent = alerts.length;

                if (alerts.length === 0) {
                    container.innerHTML = '<p style="text-align: center; color: #7f8c8d; padding: 20px;">No active alerts</p>';
                } else {
                    container.innerHTML = alerts.map(alert => `
                        <div class="alert-item severity-${alert.severity}">
                            <strong>${alert.alert_type}:</strong> ${alert.message}
                            <div class="alert-time">${new Date(alert.timestamp).toLocaleString()}</div>
                        </div>
                    `).join('');
                }
            } catch (error) {
                console.error('Error fetching alerts:', error);
            }
        }

        // Update dashboard
        function updateDashboard(data) {
            lastData = data;

            // Status grid
            document.getElementById('statusGrid').innerHTML = `
                <div class="status-item">
                    <div class="label">Status</div>
                    <div class="value ${data.online ? 'online' : 'offline'}">${data.online ? 'ONLINE' : 'OFFLINE'}</div>
                </div>
                <div class="status-item">
                    <div class="label">Current Day</div>
                    <div class="value">${data.cycle_day || 0}/${data.total_days || 0}</div>
                </div>
                <div class="status-item">
                    <div class="label">Temperature</div>
                    <div class="value">${(data.temperature || 0).toFixed(1)}°C</div>
                </div>
                <div class="status-item">
                    <div class="label">Heater</div>
                    <div class="value ${data.relay_status === 'ON' ? 'heating-on' : 'heating-off'}">${data.relay_status || 'OFF'}</div>
                </div>
            `;

            // Sensor grid
            const sensors = data.sensors || {};
            function formatTemp(temp) {
                if (temp === 'N/A' || temp === null || temp === undefined) return 'N/A';
                if (typeof temp === 'number') return temp.toFixed(1) + '°C';
                return temp + '°C';
            }

            document.getElementById('sensorGrid').innerHTML = `
                <div class="sensor-card ${sensors.s1_active ? 'active' : 'inactive'}">
                    <div class="sensor-label">Sensor 1</div>
                    <div class="sensor-value">${formatTemp(sensors.temp1)}</div>
                    <div class="sensor-status">${sensors.s1_active ? 'ACTIVE' : 'INACTIVE'}</div>
                </div>
                <div class="sensor-card ${sensors.s2_active ? 'active' : 'inactive'}">
                    <div class="sensor-label">Sensor 2</div>
                    <div class="sensor-value">${formatTemp(sensors.temp2)}</div>
                    <div class="sensor-status">${sensors.s2_active ? 'ACTIVE' : 'INACTIVE'}</div>
                </div>
                <div class="sensor-card ${sensors.s3_active ? 'active' : 'inactive'}">
                    <div class="sensor-label">Sensor 3</div>
                    <div class="sensor-value">${formatTemp(sensors.temp3)}</div>
                    <div class="sensor-status">${sensors.s3_active ? 'ACTIVE' : 'INACTIVE'}</div>
                </div>
                <div class="sensor-card ${sensors.s4_active ? 'active' : 'inactive'}">
                    <div class="sensor-label">Sensor 4</div>
                    <div class="sensor-value">${formatTemp(sensors.temp4)}</div>
                    <div class="sensor-status">${sensors.s4_active ? 'ACTIVE' : 'INACTIVE'}</div>
                </div>
            `;

            // Update cycle info
            document.getElementById('currentDay').textContent = data.cycle_day || 0;
            const remaining = Math.max(0, (data.total_days || 0) - (data.cycle_day || 0));
            document.getElementById('remainingDays').textContent = remaining;
            const progress = data.total_days > 0 ? ((data.cycle_day / data.total_days) * 100).toFixed(1) : 0;
            document.getElementById('cycleProgress').style.width = progress + '%';
            document.getElementById('progressText').textContent = progress + '%';

            // Update relay info
            document.getElementById('relayMode').textContent = data.relay_mode || 'AUTO';
            document.getElementById('relayMode').className = 'mode-badge ' + (data.relay_mode === 'MANUAL' ? 'mode-manual' : 'mode-auto');
            document.getElementById('relayStatus').textContent = data.relay_status || 'OFF';

            // Update form values
            if (data.max_temp) document.getElementById('maxTemp').value = data.max_temp;
            if (data.min_temp) document.getElementById('minTemp').value = data.min_temp;
            if (data.total_days) document.getElementById('totalDays').value = data.total_days;

            // Update sensor selects
            if (sensors.s1_active !== undefined) document.getElementById('sensor1').value = sensors.s1_active ? 'ON' : 'OFF';
            if (sensors.s2_active !== undefined) document.getElementById('sensor2').value = sensors.s2_active ? 'ON' : 'OFF';
            if (sensors.s3_active !== undefined) document.getElementById('sensor3').value = sensors.s3_active ? 'ON' : 'OFF';
            if (sensors.s4_active !== undefined) document.getElementById('sensor4').value = sensors.s4_active ? 'ON' : 'OFF';

            // Update error status
            document.getElementById('errorStatus').textContent = data.error || 'NO ERROR';

            // Update timestamps
            const now = new Date().toLocaleString();
            document.getElementById('lastUpdate').innerHTML = `<i class="fas fa-sync-alt"></i> Last update: ${now}`;
            document.getElementById('lastUpdateTime').textContent = now;

            // Connection status
            const connectionStatus = document.getElementById('connectionStatus');
            if (data.online) {
                connectionStatus.className = 'connection-status connected';
                connectionStatus.innerHTML = '<i class="fas fa-circle"></i><span>MQTT Connected</span>';
            } else {
                connectionStatus.className = 'connection-status disconnected';
                connectionStatus.innerHTML = '<i class="fas fa-circle"></i><span>MQTT Disconnected</span>';
            }
        }

        // Show message
        function showMessage(message, type) {
            const container = document.getElementById('messageContainer');
            const alertClass = type === 'success' ? 'alert-success' : 
                             type === 'error' ? 'alert-error' : 'alert-info';

            const messageDiv = document.createElement('div');
            messageDiv.className = 'alert ' + alertClass;
            messageDiv.innerHTML = `<i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i> ${message}`;

            container.appendChild(messageDiv);

            setTimeout(() => {
                if (messageDiv.parentNode) {
                    messageDiv.style.opacity = '0';
                    setTimeout(() => messageDiv.remove(), 300);
                }
            }, 5000);
        }

        // Clear alerts
        async function clearAlerts() {
            try {
                const response = await fetch('/api/alerts/clear', { method: 'POST' });
                if (response.ok) {
                    showMessage('Alerts cleared', 'success');
                    fetchAlerts();
                }
            } catch (error) {
                showMessage('Failed to clear alerts', 'error');
            }
        }

        // Export data
        async function exportData() {
            try {
                showMessage('Exporting data...', 'info');
                window.open(`/api/export?device=${deviceId}&format=csv`, '_blank');
                showMessage('Export started', 'success');
            } catch (error) {
                showMessage('Export failed', 'error');
            }
        }

        // Reset system
        function resetSystem() {
            if (confirm('Are you sure you want to reset the system? This will clear all data.')) {
                fetch('/api/system/reset', { method: 'POST' })
                    .then(response => response.json())
                    .then(result => {
                        if (result.success) {
                            showMessage('System reset initiated', 'success');
                        }
                    })
                    .catch(error => {
                        showMessage('Reset failed', 'error');
                    });
            }
        }

        // Update system uptime
        function updateUptime() {
            const now = new Date();
            const uptime = Math.floor((now - systemStartTime) / 1000);
            const hours = Math.floor(uptime / 3600);
            const minutes = Math.floor((uptime % 3600) / 60);
            const seconds = uptime % 60;

            document.getElementById('systemUptime').textContent = 
                `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }

        // Initialize
        document.addEventListener('DOMContentLoaded', function() {
            initializeChart();
            refreshData();
            setInterval(updateUptime, 1000);
            setInterval(refreshData, 10000);
        });
    </script>
</body>
</html>
'''


# MQTT Callbacks
def on_connect(client, userdata, flags, rc):
    if rc == 0:
        logger.info("✅ Connected to MQTT Broker!")
        for topic in MQTT_TOPICS.values():
            client.subscribe(topic)
            logger.info(f"📡 Subscribed to: {topic}")
        userdata['connected_at'] = datetime.now()
    else:
        logger.error(f"❌ Failed to connect, return code: {rc}")


def on_disconnect(client, userdata, rc):
    if rc != 0:
        logger.warning("⚠️ MQTT disconnected. Reconnecting...")


def on_message(client, userdata, msg):
    try:
        payload = msg.payload.decode()
        logger.info(f"📨 Message on {msg.topic}: {payload}")

        data = json.loads(payload)
        device_id = DEVICE_ID

        if msg.topic == MQTT_TOPICS['data']:
            process_device_data(device_id, data)

    except Exception as e:
        logger.error(f"❌ Error processing message: {e}")


def parse_temp(val):
    """Parse temperature value safely"""
    if val in ["NaN", "null", None, "inf", "-inf"]:
        return "N/A"
    try:
        temp = float(val)
        if -40 <= temp <= 85:
            return temp
        return "N/A"
    except (ValueError, TypeError):
        return "N/A"


def process_device_data(device_id, data):
    """Process incoming device data"""
    try:
        sensors = data.get("sensors", {})

        device_status[device_id] = {
            "online": True,
            "last_update": datetime.now().isoformat(),
            "temperature": parse_temp(data.get("temperature", 0)),
            "cycle_day": int(data.get("cycle_day", 0)),
            "total_days": int(data.get("total_days", 30)),
            "max_temp": int(data.get("max_temp", 36)),
            "min_temp": int(data.get("min_temp", 32)),
            "relay_status": data.get("relay_status", "OFF"),
            "relay_mode": data.get("relay_mode", "AUTO"),
            "error": data.get("error", "OK"),
            "timestamp": data.get("timestamp", ""),
            "sensors": {
                "temp1": parse_temp(sensors.get("temp1")),
                "temp2": parse_temp(sensors.get("temp2")),
                "temp3": parse_temp(sensors.get("temp3")),
                "temp4": parse_temp(sensors.get("temp4")),
                "s1_active": bool(sensors.get("s1_active", False)),
                "s2_active": bool(sensors.get("s2_active", False)),
                "s3_active": bool(sensors.get("s3_active", False)),
                "s4_active": bool(sensors.get("s4_active", False))
            }
        }

        # Store in database
        with get_db_connection() as conn:
            cursor = conn.cursor()
            temp = parse_temp(data.get("temperature", 0))
            if temp != "N/A":
                cursor.execute(
                    'INSERT INTO temperature_data (device_id, temperature) VALUES (?, ?)',
                    (device_id, temp)
                )
                cursor.execute(
                    'INSERT INTO relay_history (device_id, state, mode) VALUES (?, ?, ?)',
                    (device_id, data.get('relay_status', 'OFF'), data.get('relay_mode', 'AUTO'))
                )
                conn.commit()

        # Update historical data
        if device_id not in historical_data:
            historical_data[device_id] = {
                "temperatures": deque(maxlen=200),
                "timestamps": deque(maxlen=200),
                "relay_states": deque(maxlen=200)
            }

        temp = parse_temp(data.get("temperature", 0))
        if temp != "N/A":
            historical_data[device_id]["temperatures"].append(temp)
            historical_data[device_id]["timestamps"].append(datetime.now())
            historical_data[device_id]["relay_states"].append(data.get("relay_status") == "ON")

        # Check for alerts
        check_alerts(device_id, data)

        logger.info(f"✅ Data processed: Day {data.get('cycle_day')}/{data.get('total_days')}, Temp: {temp}°C")

    except Exception as e:
        logger.error(f"❌ Error processing device data: {e}")


def check_alerts(device_id, data):
    """Check for alert conditions"""
    try:
        temp = data.get("temperature", 0)
        if isinstance(temp, str):
            return

        max_temp = data.get("max_temp", 36)
        min_temp = data.get("min_temp", 32)

        if temp > max_temp + 2:
            add_alert(device_id, "HIGH_TEMP",
                      f"Temperature {temp}°C exceeds max {max_temp}°C", "warning")
        elif temp < min_temp - 2:
            add_alert(device_id, "LOW_TEMP",
                      f"Temperature {temp}°C below min {min_temp}°C", "warning")

    except Exception as e:
        logger.error(f"❌ Error checking alerts: {e}")


def add_alert(device_id, alert_type, message, severity):
    """Add alert to database"""
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                'INSERT INTO alerts (device_id, alert_type, message, severity) VALUES (?, ?, ?, ?)',
                (device_id, alert_type, message, severity)
            )
            conn.commit()

        active_alerts.append({
            "device_id": device_id,
            "alert_type": alert_type,
            "message": message,
            "severity": severity,
            "timestamp": datetime.now().isoformat()
        })

        logger.info(f"🚨 Alert: {alert_type} - {message}")
    except Exception as e:
        logger.error(f"❌ Error adding alert: {e}")


def start_mqtt_client():
    """Start MQTT client"""
    mqtt_client.on_connect = on_connect
    mqtt_client.on_message = on_message
    mqtt_client.on_disconnect = on_disconnect
    mqtt_client.user_data_set({'connected_at': None})

    try:
        logger.info(f"🔌 Connecting to {MQTT_BROKER}:{MQTT_PORT}")
        mqtt_client.connect(MQTT_BROKER, MQTT_PORT, 60)
        mqtt_client.loop_forever()
    except Exception as e:
        logger.error(f"❌ MQTT error: {e}")
        threading.Timer(5, start_mqtt_client).start()


# Flask Routes
@app.route("/")
def dashboard():
    return render_template_string(HTML_TEMPLATE)


@app.route("/status", methods=["GET"])
def get_status():
    device_id = request.args.get("device", DEVICE_ID)

    if device_id not in device_status:
        return jsonify({
            "online": False,
            "cycle_day": 0,
            "total_days": 0,
            "temperature": 0,
            "relay_status": "OFF",
            "relay_mode": "AUTO",
            "max_temp": 36,
            "min_temp": 32,
            "error": "NO DATA",
            "sensors": {
                "temp1": "N/A", "temp2": "N/A", "temp3": "N/A", "temp4": "N/A",
                "s1_active": False, "s2_active": False, "s3_active": False, "s4_active": False
            }
        })

    data = device_status[device_id].copy()
    last_update = datetime.fromisoformat(data["last_update"])
    data["online"] = (datetime.now() - last_update).total_seconds() < 120

    return jsonify(data)


@app.route("/control/relay", methods=["POST"])
def control_relay():
    try:
        data = request.get_json()
        mode = data.get("mode", "AUTO").upper()

        if mode not in ["ON", "OFF", "AUTO"]:
            return jsonify({"success": False, "message": "Invalid mode"})

        mqtt_client.publish(MQTT_TOPICS['relay'], mode)
        logger.info(f"📤 Relay command: {mode}")

        return jsonify({"success": True, "message": f"Relay set to {mode}"})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)})


@app.route("/control/setting", methods=["POST"])
def control_setting():
    try:
        data = request.get_json()
        setting = data.get("setting")
        value = data.get("value")

        if setting == "max_temp":
            mqtt_client.publish(MQTT_TOPICS['max_temp'], str(value))
        elif setting == "min_temp":
            mqtt_client.publish(MQTT_TOPICS['min_temp'], str(value))
        elif setting == "total_days":
            mqtt_client.publish(MQTT_TOPICS['total_days'], str(value))
        elif setting == "sensor":
            mqtt_client.publish(MQTT_TOPICS['sensor'], value)
        else:
            return jsonify({"success": False, "message": "Unknown setting"})

        logger.info(f"📤 Setting {setting}: {value}")
        return jsonify({"success": True, "message": f"Setting '{setting}' updated"})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)})


@app.route("/api/analytics")
def get_analytics():
    try:
        device_id = request.args.get("device", DEVICE_ID)

        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT 
                    AVG(temperature) as avg_temp,
                    MAX(temperature) as max_temp,
                    MIN(temperature) as min_temp,
                    COUNT(*) as data_points
                FROM temperature_data 
                WHERE device_id = ? AND timestamp >= datetime('now', '-1 day')
            ''', (device_id,))

            stats = dict(cursor.fetchone() or {})

            cursor.execute('''
                SELECT COUNT(*) as runtime_minutes
                FROM relay_history 
                WHERE device_id = ? AND state = 'ON' AND DATE(timestamp) = DATE('now')
            ''', (device_id,))

            runtime = cursor.fetchone()['runtime_minutes'] or 0

        return jsonify({
            "avg_temp_24h": round(stats.get('avg_temp', 0) or 0, 1),
            "max_temp_24h": round(stats.get('max_temp', 0) or 0, 1),
            "min_temp_24h": round(stats.get('min_temp', 0) or 0, 1),
            "data_points_24h": stats.get('data_points', 0),
            "runtime_today": runtime
        })
    except Exception as e:
        logger.error(f"❌ Analytics error: {e}")
        return jsonify({})


@app.route("/api/alerts")
def get_alerts():
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT * FROM alerts 
                WHERE resolved = FALSE 
                ORDER BY timestamp DESC 
                LIMIT 10
            ''')
            alerts = [dict(row) for row in cursor.fetchall()]
        return jsonify(alerts)
    except Exception as e:
        return jsonify([])


@app.route("/api/alerts/clear", methods=["POST"])
def clear_alerts():
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('UPDATE alerts SET resolved = TRUE WHERE resolved = FALSE')
            conn.commit()
        active_alerts.clear()
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)})


@app.route("/api/export")
def export_data():
    try:
        device_id = request.args.get("device", DEVICE_ID)

        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT timestamp, temperature 
                FROM temperature_data 
                WHERE device_id = ? 
                ORDER BY timestamp DESC 
                LIMIT 1000
            ''', (device_id,))

            data = [dict(row) for row in cursor.fetchall()]

        import csv
        from io import StringIO
        output = StringIO()
        writer = csv.writer(output)
        writer.writerow(['Timestamp', 'Temperature'])
        for row in data:
            writer.writerow([row['timestamp'], row['temperature']])

        return output.getvalue(), 200, {
            'Content-Type': 'text/csv',
            'Content-Disposition': f'attachment; filename=broodinnox_{datetime.now().strftime("%Y%m%d")}.csv'
        }
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/system/reset", methods=["POST"])
def system_reset():
    try:
        logger.warning("🔄 Factory reset initiated")
        add_alert(DEVICE_ID, "FACTORY_RESET", "System reset initiated", "warning")
        return jsonify({"success": True, "message": "Reset initiated"})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)})


@app.route("/debug")
def debug_info():
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) as count FROM temperature_data")
        temp_count = cursor.fetchone()['count']

    return jsonify({
        "mqtt_connected": mqtt_client.is_connected(),
        "device_online": DEVICE_ID in device_status,
        "temperature_records": temp_count,
        "active_alerts": len(active_alerts),
        "topics": MQTT_TOPICS
    })


if __name__ == "__main__":
    print("\n" + "=" * 70)
    print("🚀 BROODINNOX PRO - SMART BROODING SYSTEM")
    print("=" * 70)
    print(f"📍 Dashboard: http://localhost:10000")
    print(f"🐛 Debug: http://localhost:10000/debug")
    print(f"📊 Analytics: http://localhost:10000/api/analytics")
    print("\n📡 MQTT Topics:")
    for name, topic in MQTT_TOPICS.items():
        print(f"   {name}: {topic}")
    print("=" * 70 + "\n")

    mqtt_thread = threading.Thread(target=start_mqtt_client, daemon=True)
    mqtt_thread.start()
    time.sleep(2)

    port = int(os.environ.get("PORT", 10000))
    app.run(host="0.0.0.0", port=port, debug=False)
