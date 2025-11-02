from flask import Flask, request, jsonify, render_template_string
from datetime import datetime
import logging
from collections import deque

app = Flask(__name__)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Device and command storage
device_status = {}
command_queue = {}
DEVICE_ID = "broodinnox_001"

# Store historical data for charts
historical_data = {
    "broodinnox_001": {
        "temperatures": deque(maxlen=50),
        "timestamps": deque(maxlen=50),
        "relay_states": deque(maxlen=50)
    }
}

HTML_TEMPLATE = '''
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Broodinnox Control Dashboard</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
            color: #333;
        }

        .container {
            max-width: 1400px;
            margin: 0 auto;
        }

        .header {
            background: rgba(255, 255, 255, 0.95);
            padding: 30px;
            border-radius: 20px;
            margin-bottom: 20px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
            backdrop-filter: blur(10px);
            text-align: center;
        }

        .header h1 {
            color: #2c3e50;
            font-size: 2.5em;
            margin-bottom: 10px;
        }

        .header .subtitle {
            color: #7f8c8d;
            font-size: 1.2em;
        }

        .dashboard {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin-bottom: 20px;
        }

        @media (max-width: 1200px) {
            .dashboard {
                grid-template-columns: 1fr;
            }
        }

        .card {
            background: rgba(255, 255, 255, 0.95);
            padding: 25px;
            border-radius: 15px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
            backdrop-filter: blur(10px);
        }

        .card h2 {
            color: #2c3e50;
            margin-bottom: 20px;
            font-size: 1.5em;
            border-bottom: 2px solid #3498db;
            padding-bottom: 10px;
        }

        .status-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin-bottom: 20px;
        }

        .status-item {
            background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
            padding: 20px;
            border-radius: 10px;
            text-align: center;
            border-left: 4px solid #3498db;
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
            color: #2c3e50;
        }

        .status-item .unit {
            font-size: 0.8em;
            color: #7f8c8d;
        }

        .online {
            color: #27ae60 !important;
        }

        .offline {
            color: #e74c3c !important;
        }

        .heating-on {
            color: #e74c3c !important;
            animation: pulse 1.5s infinite;
        }

        @keyframes pulse {
            0% { opacity: 1; }
            50% { opacity: 0.5; }
            100% { opacity: 1; }
        }

        .heating-off {
            color: #27ae60 !important;
        }

        .control-panel {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 15px;
            margin-top: 20px;
        }

        .control-group {
            background: #f8f9fa;
            padding: 15px;
            border-radius: 10px;
            border: 1px solid #e9ecef;
        }

        .control-group label {
            display: block;
            margin-bottom: 8px;
            font-weight: 600;
            color: #2c3e50;
        }

        .control-group input, .control-group select {
            width: 100%;
            padding: 10px;
            border: 2px solid #ddd;
            border-radius: 8px;
            font-size: 1em;
            transition: border-color 0.3s;
        }

        .control-group input:focus, .control-group select:focus {
            outline: none;
            border-color: #3498db;
        }

        .btn {
            background: linear-gradient(135deg, #3498db 0%, #2980b9 100%);
            color: white;
            border: none;
            padding: 12px 20px;
            border-radius: 8px;
            cursor: pointer;
            font-size: 1em;
            font-weight: 600;
            transition: all 0.3s;
            margin-top: 10px;
        }

        .btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 5px 15px rgba(52, 152, 219, 0.4);
        }

        .btn-danger {
            background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%);
        }

        .btn-success {
            background: linear-gradient(135deg, #27ae60 0%, #229954 100%);
        }

        .btn-warning {
            background: linear-gradient(135deg, #f39c12 0%, #e67e22 100%);
        }

        .sensor-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 15px;
            margin-top: 15px;
        }

        .sensor-card {
            background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
            padding: 15px;
            border-radius: 10px;
            text-align: center;
            border-top: 4px solid #3498db;
        }

        .sensor-card.active {
            border-top-color: #27ae60;
        }

        .sensor-card.inactive {
            border-top-color: #e74c3c;
            opacity: 0.6;
        }

        .sensor-card .sensor-value {
            font-size: 1.4em;
            font-weight: bold;
            margin: 5px 0;
        }

        .sensor-card .sensor-label {
            font-size: 0.8em;
            color: #7f8c8d;
            text-transform: uppercase;
        }

        .chart-container {
            height: 300px;
            margin-top: 15px;
        }

        .alert {
            padding: 15px;
            border-radius: 8px;
            margin: 10px 0;
            font-weight: 600;
        }

        .alert-success {
            background: #d4edda;
            color: #155724;
            border: 1px solid #c3e6cb;
        }

        .alert-error {
            background: #f8d7da;
            color: #721c24;
            border: 1px solid #f5c6cb;
        }

        .last-update {
            text-align: center;
            margin-top: 15px;
            color: #7f8c8d;
            font-size: 0.9em;
        }

        .system-controls {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 10px;
            margin-top: 15px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🐥 Broodinnox Smart Brooding System</h1>
            <div class="subtitle">Real-time Monitoring & Remote Control</div>
        </div>

        <div class="dashboard">
            <!-- Left Column -->
            <div class="column">
                <!-- System Status Card -->
                <div class="card">
                    <h2>📊 System Status</h2>
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
                            <div class="label">Avg Temperature</div>
                            <div class="value">0.0<span class="unit">°C</span></div>
                        </div>
                        <div class="status-item">
                            <div class="label">Heater</div>
                            <div class="value heating-off">OFF</div>
                        </div>
                    </div>
                    
                    <div class="sensor-grid" id="sensorGrid">
                        <div class="sensor-card inactive">
                            <div class="sensor-label">Sensor 1</div>
                            <div class="sensor-value">N/A</div>
                            <div class="sensor-status">INACTIVE</div>
                        </div>
                        <div class="sensor-card inactive">
                            <div class="sensor-label">Sensor 2</div>
                            <div class="sensor-value">N/A</div>
                            <div class="sensor-status">INACTIVE</div>
                        </div>
                        <div class="sensor-card inactive">
                            <div class="sensor-label">Sensor 3</div>
                            <div class="sensor-value">N/A</div>
                            <div class="sensor-status">INACTIVE</div>
                        </div>
                        <div class="sensor-card inactive">
                            <div class="sensor-label">Sensor 4</div>
                            <div class="sensor-value">N/A</div>
                            <div class="sensor-status">INACTIVE</div>
                        </div>
                    </div>

                    <div class="last-update" id="lastUpdate">
                        Last update: Never
                    </div>
                </div>

                <!-- Temperature Control Card -->
                <div class="card">
                    <h2>🌡️ Temperature Control</h2>
                    <div class="control-panel">
                        <div class="control-group">
                            <label for="maxTemp">Max Temperature (°C)</label>
                            <input type="number" id="maxTemp" min="20" max="40" step="0.5" value="36">
                            <button class="btn" onclick="sendCommand('max_temp', document.getElementById('maxTemp').value)">Update</button>
                        </div>
                        <div class="control-group">
                            <label for="minTemp">Min Temperature (°C)</label>
                            <input type="number" id="minTemp" min="15" max="35" step="0.5" value="32">
                            <button class="btn" onclick="sendCommand('min_temp', document.getElementById('minTemp').value)">Update</button>
                        </div>
                    </div>
                </div>

                <!-- Time Settings Card -->
                <div class="card">
                    <h2>⏰ Time Settings</h2>
                    <div class="control-panel">
                        <div class="control-group">
                            <label for="totalDays">Total Days</label>
                            <input type="number" id="totalDays" min="1" max="365" step="1" value="30">
                            <button class="btn" onclick="sendCommand('total_days', document.getElementById('totalDays').value)">Update</button>
                        </div>
                        <div class="control-group">
                            <label for="startDate">Start Date</label>
                            <input type="date" id="startDate" value="2025-10-11">
                            <button class="btn" onclick="updateStartDate()">Update Date</button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Right Column -->
            <div class="column">
                <!-- Temperature Chart Card -->
                <div class="card">
                    <h2>📈 Temperature History</h2>
                    <div class="chart-container">
                        <canvas id="tempChart"></canvas>
                    </div>
                </div>

                <!-- Sensor Control Card -->
                <div class="card">
                    <h2>🔧 Sensor Management</h2>
                    <div class="control-panel">
                        <div class="control-group">
                            <label>Sensor 1</label>
                            <select id="sensor1">
                                <option value="true">Enabled</option>
                                <option value="false">Disabled</option>
                            </select>
                            <button class="btn" onclick="sendCommand('sensor1', document.getElementById('sensor1').value)">Update</button>
                        </div>
                        <div class="control-group">
                            <label>Sensor 2</label>
                            <select id="sensor2">
                                <option value="true">Enabled</option>
                                <option value="false">Disabled</option>
                            </select>
                            <button class="btn" onclick="sendCommand('sensor2', document.getElementById('sensor2').value)">Update</button>
                        </div>
                        <div class="control-group">
                            <label>Sensor 3</label>
                            <select id="sensor3">
                                <option value="true">Enabled</option>
                                <option value="false">Disabled</option>
                            </select>
                            <button class="btn" onclick="sendCommand('sensor3', document.getElementById('sensor3').value)">Update</button>
                        </div>
                        <div class="control-group">
                            <label>Sensor 4</label>
                            <select id="sensor4">
                                <option value="true">Enabled</option>
                                <option value="false">Disabled</option>
                            </select>
                            <button class="btn" onclick="sendCommand('sensor4', document.getElementById('sensor4').value)">Update</button>
                        </div>
                    </div>
                </div>

                <!-- System Control Card -->
                <div class="card">
                    <h2>⚙️ System Control</h2>
                    <div class="system-controls">
                        <button class="btn btn-success" onclick="sendCommand('save', '1')">💾 Save Settings</button>
                        <button class="btn btn-warning" onclick="sendCommand('screen', '0')">📱 Main Screen</button>
                        <button class="btn btn-danger" onclick="sendCommand('reset', '1')">🔄 Restart</button>
                    </div>
                    <div style="margin-top: 15px;">
                        <button class="btn" onclick="refreshData()" style="width: 100%">🔄 Refresh Data</button>
                    </div>
                </div>
            </div>
        </div>

        <!-- Message Display -->
        <div id="messageContainer"></div>
    </div>

    <script>
        let tempChart;
        let lastData = {};
        const deviceId = 'broodinnox_001';

        // Initialize chart
        function initializeChart() {
            const ctx = document.getElementById('tempChart').getContext('2d');
            tempChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: [],
                    datasets: [
                        {
                            label: 'Average Temperature',
                            data: [],
                            borderColor: '#3498db',
                            backgroundColor: 'rgba(52, 152, 219, 0.1)',
                            borderWidth: 3,
                            fill: true,
                            tension: 0.4
                        },
                        {
                            label: 'Max Temp',
                            data: [],
                            borderColor: '#e74c3c',
                            borderWidth: 2,
                            borderDash: [5, 5],
                            fill: false,
                            tension: 0.4
                        },
                        {
                            label: 'Min Temp',
                            data: [],
                            borderColor: '#27ae60',
                            borderWidth: 2,
                            borderDash: [5, 5],
                            fill: false,
                            tension: 0.4
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: false,
                            title: {
                                display: true,
                                text: 'Temperature (°C)'
                            },
                            grid: {
                                color: 'rgba(0,0,0,0.1)'
                            }
                        },
                        x: {
                            title: {
                                display: true,
                                text: 'Time'
                            },
                            grid: {
                                color: 'rgba(0,0,0,0.1)'
                            }
                        }
                    },
                    plugins: {
                        legend: {
                            position: 'top',
                        },
                        tooltip: {
                            mode: 'index',
                            intersect: false
                        }
                    }
                }
            });
        }

        // Update chart with new data
        function updateChart(data) {
            const now = new Date();
            const timeLabel = now.toLocaleTimeString();

            // Add new data point
            tempChart.data.labels.push(timeLabel);
            tempChart.data.datasets[0].data.push(data.ave_temp || 0);
            tempChart.data.datasets[1].data.push(data.max_temp || 0);
            tempChart.data.datasets[2].data.push(data.min_temp || 0);

            // Keep only last 20 points
            if (tempChart.data.labels.length > 20) {
                tempChart.data.labels.shift();
                tempChart.data.datasets.forEach(dataset => dataset.data.shift());
            }

            tempChart.update('none');
        }

        // Send command to device
        async function sendCommand(command, value) {
            try {
                showMessage('Sending command...', 'info');
                
                const response = await fetch('/command', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        device: deviceId,
                        command: command,
                        value: value
                    })
                });

                const result = await response.json();
                
                if (result.success) {
                    showMessage(`✅ ${result.message}`, 'success');
                    // Refresh data after command
                    setTimeout(refreshData, 1000);
                } else {
                    showMessage(`❌ ${result.message}`, 'error');
                }
            } catch (error) {
                showMessage(`❌ Error: ${error.message}`, 'error');
            }
        }

        // Update start date
        function updateStartDate() {
            const dateInput = document.getElementById('startDate');
            if (dateInput.value) {
                sendCommand('start_date', dateInput.value);
            }
        }

        // Refresh data from server
        async function refreshData() {
            try {
                const response = await fetch('/status?device=' + deviceId);
                const data = await response.json();
                
                updateDashboard(data);
                updateChart(data);
                
                // Update form values
                if (data.max_temp) document.getElementById('maxTemp').value = data.max_temp;
                if (data.min_temp) document.getElementById('minTemp').value = data.min_temp;
                if (data.total_days) document.getElementById('totalDays').value = data.total_days;
                
                // Update sensor selects
                if (data.sensor1_active !== undefined) {
                    document.getElementById('sensor1').value = data.sensor1_active ? 'true' : 'false';
                }
                if (data.sensor2_active !== undefined) {
                    document.getElementById('sensor2').value = data.sensor2_active ? 'true' : 'false';
                }
                if (data.sensor3_active !== undefined) {
                    document.getElementById('sensor3').value = data.sensor3_active ? 'true' : 'false';
                }
                if (data.sensor4_active !== undefined) {
                    document.getElementById('sensor4').value = data.sensor4_active ? 'true' : 'false';
                }
                
                // Update start date if available
                if (data.starting_year && data.starting_month && data.starting_day) {
                    const startDate = data.starting_year + '-' + 
                                    String(data.starting_month).padStart(2, '0') + '-' + 
                                    String(data.starting_day).padStart(2, '0');
                    document.getElementById('startDate').value = startDate;
                }
                
            } catch (error) {
                console.error('Error fetching data:', error);
                showMessage('❌ Error fetching data from server', 'error');
            }
        }

        // Update dashboard with new data
        function updateDashboard(data) {
            lastData = data;
            
            // Update status grid
            const statusGrid = document.getElementById('statusGrid');
            statusGrid.innerHTML = `
                <div class="status-item">
                    <div class="label">Status</div>
                    <div class="value ${data.online ? 'online' : 'offline'}">${data.online ? 'ONLINE' : 'OFFLINE'}</div>
                </div>
                <div class="status-item">
                    <div class="label">Current Day</div>
                    <div class="value">${data.day || 0}/${data.total_days || 0}</div>
                </div>
                <div class="status-item">
                    <div class="label">Avg Temperature</div>
                    <div class="value">${(data.ave_temp || 0).toFixed(1)}<span class="unit">°C</span></div>
                </div>
                <div class="status-item">
                    <div class="label">Heater</div>
                    <div class="value ${data.relay_state ? 'heating-on' : 'heating-off'}">${data.relay_state ? 'ON' : 'OFF'}</div>
                </div>
            `;

            // Update sensor grid
            const sensorGrid = document.getElementById('sensorGrid');
            sensorGrid.innerHTML = `
                <div class="sensor-card ${data.sensor1_active ? 'active' : 'inactive'}">
                    <div class="sensor-label">Sensor 1</div>
                    <div class="sensor-value">${data.temp1 !== undefined ? data.temp1.toFixed(1) + '°C' : 'N/A'}</div>
                    <div class="sensor-status">${data.sensor1_active ? 'ACTIVE' : 'INACTIVE'}</div>
                </div>
                <div class="sensor-card ${data.sensor2_active ? 'active' : 'inactive'}">
                    <div class="sensor-label">Sensor 2</div>
                    <div class="sensor-value">${data.temp2 !== undefined ? data.temp2.toFixed(1) + '°C' : 'N/A'}</div>
                    <div class="sensor-status">${data.sensor2_active ? 'ACTIVE' : 'INACTIVE'}</div>
                </div>
                <div class="sensor-card ${data.sensor3_active ? 'active' : 'inactive'}">
                    <div class="sensor-label">Sensor 3</div>
                    <div class="sensor-value">${data.temp3 !== undefined ? data.temp3.toFixed(1) + '°C' : 'N/A'}</div>
                    <div class="sensor-status">${data.sensor3_active ? 'ACTIVE' : 'INACTIVE'}</div>
                </div>
                <div class="sensor-card ${data.sensor4_active ? 'active' : 'inactive'}">
                    <div class="sensor-label">Sensor 4</div>
                    <div class="sensor-value">${data.temp4 !== undefined ? data.temp4.toFixed(1) + '°C' : 'N/A'}</div>
                    <div class="sensor-status">${data.sensor4_active ? 'ACTIVE' : 'INACTIVE'}</div>
                </div>
            `;

            // Update last update time
            document.getElementById('lastUpdate').textContent = 
                'Last update: ' + new Date().toLocaleString();
        }

        // Show message to user
        function showMessage(message, type) {
            const container = document.getElementById('messageContainer');
            const alertClass = type === 'success' ? 'alert-success' : 
                             type === 'error' ? 'alert-error' : 'alert-info';
            
            const messageDiv = document.createElement('div');
            messageDiv.className = 'alert ' + alertClass;
            messageDiv.textContent = message;
            
            container.appendChild(messageDiv);
            
            // Remove message after 5 seconds
            setTimeout(() => {
                if (messageDiv.parentNode) {
                    messageDiv.remove();
                }
            }, 5000);
        }

        // Auto-refresh data every 10 seconds
        setInterval(refreshData, 10000);

        // Initialize when page loads
        document.addEventListener('DOMContentLoaded', function() {
            initializeChart();
            refreshData();
        });
    </script>
</body>
</html>
'''

@app.route("/")
def dashboard():
    """Serve the main dashboard"""
    return render_template_string(HTML_TEMPLATE)

@app.route("/send", methods=["POST"])
def receive_data():
    """Receive data from ESP32"""
    try:
        data = request.get_json()
        device_id = data.get("device", DEVICE_ID)
        data["last_update"] = datetime.now().isoformat()
        data["online"] = True
        device_status[device_id] = data
        
        # Store historical data
        if device_id not in historical_data:
            historical_data[device_id] = {
                "temperatures": deque(maxlen=50),
                "timestamps": deque(maxlen=50),
                "relay_states": deque(maxlen=50)
            }
        
        historical_data[device_id]["temperatures"].append(data.get("ave_temp", 0))
        historical_data[device_id]["timestamps"].append(datetime.now().strftime("%H:%M:%S"))
        historical_data[device_id]["relay_states"].append(data.get("relay_state", False))
        
        print(f"✅ Data received from {device_id}")
        return jsonify({"success": True, "message": "Data received"})
    except Exception as e:
        print("❌ Error receiving data:", e)
        return jsonify({"success": False, "message": str(e)}), 400

@app.route("/status", methods=["GET"])
def get_status():
    """Return latest ESP32 data"""
    device_id = request.args.get("device", DEVICE_ID)
    if device_id not in device_status:
        return jsonify({
            "online": False, 
            "message": "Device not connected",
            "day": 0,
            "total_days": 0,
            "ave_temp": 0,
            "relay_state": False,
            "max_temp": 0,
            "min_temp": 0,
            "sensor1_active": False,
            "sensor2_active": False,
            "sensor3_active": False,
            "sensor4_active": False,
            "temp1": 0,
            "temp2": 0,
            "temp3": 0,
            "temp4": 0
        })
    
    data = device_status[device_id]
    last_update = datetime.fromisoformat(data["last_update"])
    seconds = (datetime.now() - last_update).total_seconds()
    data["online"] = seconds < 120  # 2 min threshold
    return jsonify(data)

@app.route("/command", methods=["GET", "POST"])
def handle_command():
    """Handle commands from both web interface and ESP32"""
    try:
        if request.method == "POST":
            # Web interface sends commands
            data = request.get_json()
            command = data.get("command")
            value = data.get("value")
            device_id = data.get("device", DEVICE_ID)

            if not command:
                return jsonify({"success": False, "message": "Missing command"})

            command_queue[device_id] = {
                "command": command,
                "value": value,
                "timestamp": datetime.now().isoformat()
            }
            print(f"📡 Command queued: {command}={value}")
            return jsonify({"success": True, "message": f"Command '{command}' queued"})
        
        else:  # GET request - ESP32 fetches commands
            device_id = request.args.get("device", DEVICE_ID)
            if device_id in command_queue:
                cmd = command_queue[device_id]
                del command_queue[device_id]
                return jsonify(cmd)
            return jsonify({"command": None, "value": None})
            
    except Exception as e:
        return jsonify({"success": False, "message": str(e)})

@app.route("/historical/<device_id>")
def get_historical_data(device_id):
    """Get historical data for charts"""
    if device_id in historical_data:
        return jsonify({
            "temperatures": list(historical_data[device_id]["temperatures"]),
            "timestamps": list(historical_data[device_id]["timestamps"]),
            "relay_states": list(historical_data[device_id]["relay_states"])
        })
    else:
        return jsonify({"temperatures": [], "timestamps": [], "relay_states": []})

if __name__ == "__main__":
    import os
    print("🌐 Broodinnox Control Dashboard Started")
    print("📍 Access dashboard at: http://localhost:10000")
    print("📊 Features:")
    print("   ✅ Real-time monitoring")
    print("   ✅ Temperature charts") 
    print("   ✅ Remote control")
    print("   ✅ Sensor management")
    print("   ✅ System controls")
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 10000)))
