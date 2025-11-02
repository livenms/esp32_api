from flask import Flask, request, jsonify, render_template_string
import requests
from datetime import datetime
import json
import threading
import time

app = Flask(__name__)

# Store commands and status
command_queue = {}
device_status = {}
DEVICE_ID = "broodinnox_001"

HTML_TEMPLATE = """
<!DOCTYPE html>
<html>
<head>
    <title>Broodinnox Remote Control</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
        .container { max-width: 600px; margin: 0 auto; background: white; padding: 20px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .section { margin-bottom: 20px; padding: 15px; background: #f9f9f9; border-radius: 5px; }
        .status { background: #e8f5e8; padding: 10px; border-radius: 5px; margin-bottom: 15px; }
        .control-group { margin: 10px 0; }
        label { display: inline-block; width: 150px; font-weight: bold; }
        input, select { padding: 8px; margin: 5px; border: 1px solid #ddd; border-radius: 4px; }
        button { background: #007bff; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer; margin: 5px; }
        button:hover { background: #0056b3; }
        .success { color: green; font-weight: bold; }
        .error { color: red; font-weight: bold; }
        .offline { background: #ffe6e6; }
        .online { background: #e6ffe6; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🐥 Broodinnox Remote Control</h1>
        
        <div class="status" id="status">
            Loading current status...
        </div>

        <div class="section">
            <h3>Temperature Settings</h3>
            <div class="control-group">
                <label>Max Temperature:</label>
                <input type="number" id="max_temp" min="20" max="40" step="1">
                <button onclick="sendCommand('max_temp')">Update</button>
            </div>
            <div class="control-group">
                <label>Min Temperature:</label>
                <input type="number" id="min_temp" min="15" max="35" step="1">
                <button onclick="sendCommand('min_temp')">Update</button>
            </div>
        </div>

        <div class="section">
            <h3>Time Settings</h3>
            <div class="control-group">
                <label>Total Days:</label>
                <input type="number" id="total_days" min="1" max="365" step="1">
                <button onclick="sendCommand('total_days')">Update</button>
            </div>
            <div class="control-group">
                <label>Start Date:</label>
                <input type="number" id="starting_year" min="2020" max="2030" placeholder="Year" style="width: 80px;">
                <input type="number" id="starting_month" min="1" max="12" placeholder="Month" style="width: 80px;">
                <input type="number" id="starting_day" min="1" max="31" placeholder="Day" style="width: 80px;">
                <button onclick="updateStartDate()">Update Date</button>
            </div>
        </div>

        <div class="section">
            <h3>Sensor Control</h3>
            <div class="control-group">
                <label>Sensor 1:</label>
                <select id="sensor1">
                    <option value="true">Enabled</option>
                    <option value="false">Disabled</option>
                </select>
                <button onclick="sendCommand('sensor1')">Update</button>
            </div>
            <div class="control-group">
                <label>Sensor 2:</label>
                <select id="sensor2">
                    <option value="true">Enabled</option>
                    <option value="false">Disabled</option>
                </select>
                <button onclick="sendCommand('sensor2')">Update</button>
            </div>
            <div class="control-group">
                <label>Sensor 3:</label>
                <select id="sensor3">
                    <option value="true">Enabled</option>
                    <option value="false">Disabled</option>
                </select>
                <button onclick="sendCommand('sensor3')">Update</button>
            </div>
            <div class="control-group">
                <label>Sensor 4:</label>
                <select id="sensor4">
                    <option value="true">Enabled</option>
                    <option value="false">Disabled</option>
                </select>
                <button onclick="sendCommand('sensor4')">Update</button>
            </div>
        </div>

        <div class="section">
            <h3>System Control</h3>
            <div class="control-group">
                <button onclick="sendCommand('reset', '1')">Restart System</button>
                <button onclick="sendCommand('save', '1')">Force Save</button>
                <button onclick="sendCommand('screen', '0')">Main Screen</button>
                <button onclick="refreshStatus()">Refresh Status</button>
            </div>
        </div>

        <div id="message"></div>
    </div>

    <script>
        function refreshStatus() {
            fetch('/status')
                .then(response => response.json())
                .then(data => {
                    const statusDiv = document.getElementById('status');
                    const isOnline = data.online;
                    
                    statusDiv.innerHTML = 
                        `<span class="${isOnline ? 'online' : 'offline'}">` +
                        `📊 Status: ${isOnline ? 'ONLINE' : 'OFFLINE'} | ` +
                        `Day ${data.day}/${data.total_days} | ` +
                        `Temp: ${data.ave_temp}°C | ` +
                        `Heater: ${data.relay_state ? 'ON' : 'OFF'} | ` +
                        `Max: ${data.max_temp}°C | Min: ${data.min_temp}°C` +
                        `</span>`;
                    
                    // Update form values
                    if (isOnline) {
                        document.getElementById('max_temp').value = data.max_temp;
                        document.getElementById('min_temp').value = data.min_temp;
                        document.getElementById('total_days').value = data.total_days;
                        document.getElementById('starting_year').value = data.starting_year;
                        document.getElementById('starting_month').value = data.starting_month;
                        document.getElementById('starting_day').value = data.starting_day;
                        document.getElementById('sensor1').value = data.sensor1_active.toString();
                        document.getElementById('sensor2').value = data.sensor2_active.toString();
                        document.getElementById('sensor3').value = data.sensor3_active.toString();
                        document.getElementById('sensor4').value = data.sensor4_active.toString();
                    }
                })
                .catch(error => {
                    document.getElementById('status').innerHTML = 
                        '<span class="offline">❌ Error fetching status</span>';
                });
        }

        function sendCommand(command, value = null) {
            if (value === null) {
                value = document.getElementById(command).value;
            }

            fetch('/command', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({command: command, value: value})
            })
            .then(response => response.json())
            .then(data => {
                const messageDiv = document.getElementById('message');
                if(data.success) {
                    messageDiv.innerHTML = `<div class="success">✅ ${data.message}</div>`;
                    setTimeout(() => refreshStatus(), 2000);
                } else {
                    messageDiv.innerHTML = `<div class="error">❌ ${data.message}</div>`;
                }
                setTimeout(() => messageDiv.innerHTML = '', 5000);
            })
            .catch(error => {
                document.getElementById('message').innerHTML = 
                    `<div class="error">❌ Error: ${error}</div>`;
            });
        }

        function updateStartDate() {
            const year = document.getElementById('starting_year').value;
            const month = document.getElementById('starting_month').value;
            const day = document.getElementById('starting_day').value;
            
            if(year && month && day) {
                sendCommand('start_date', `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`);
            }
        }

        // Load status on page load
        refreshStatus();
        // Auto-refresh every 10 seconds
        setInterval(refreshStatus, 10000);
    </script>
</body>
</html>
"""

@app.route("/")
def dashboard():
    return render_template_string(HTML_TEMPLATE)

@app.route("/send", methods=["POST"])
def receive_data():
    """Receive data from ESP32"""
    try:
        data = request.get_json()
        device_id = data.get("device", "unknown")
        
        # Store the latest status
        device_status[device_id] = {
            **data,
            "last_update": datetime.now().isoformat(),
            "online": True
        }
        
        print(f"✅ Received data from {device_id}")
        return jsonify({"success": True, "message": "Data received"})
    
    except Exception as e:
        print(f"❌ Error receiving data: {e}")
        return jsonify({"success": False, "message": str(e)}), 400

@app.route("/status", methods=["GET"])
def get_status():
    """Get current device status"""
    device_id = request.args.get("device", DEVICE_ID)
    
    if device_id in device_status:
        status = device_status[device_id]
        # Check if device is online (updated in last 2 minutes)
        last_update = datetime.fromisoformat(status["last_update"])
        time_diff = (datetime.now() - last_update).total_seconds()
        status["online"] = time_diff < 120  # 2 minutes threshold
        
        return jsonify(status)
    else:
        return jsonify({
            "online": False,
            "message": "Device not connected",
            "day": 0,
            "total_days": 0,
            "ave_temp": 0,
            "relay_state": False,
            "max_temp": 0,
            "min_temp": 0
        })

@app.route("/command", methods=["POST"])
def handle_command():
    """Handle remote commands from web interface"""
    try:
        data = request.get_json()
        command = data.get("command")
        value = data.get("value")
        device_id = data.get("device", DEVICE_ID)
        
        if not command or not value:
            return jsonify({"success": False, "message": "Missing command or value"})
        
        # Store command in queue
        command_queue[device_id] = {
            "command": command,
            "value": value,
            "timestamp": datetime.now().isoformat()
        }
        
        print(f"📡 Command queued: {command} = {value} for {device_id}")
        
        return jsonify({
            "success": True, 
            "message": f"Command '{command}' queued for execution"
        })
    
    except Exception as e:
        print(f"❌ Error handling command: {e}")
        return jsonify({"success": False, "message": str(e)})

@app.route("/command", methods=["GET"])
def get_command():
    """ESP32 polls this endpoint to get commands"""
    device_id = request.args.get("device", DEVICE_ID)
    
    if device_id in command_queue:
        command = command_queue[device_id]
        # Remove command from queue after sending
        del command_queue[device_id]
        print(f"📡 Sending command to {device_id}: {command}")
        return jsonify(command)
    else:
        return jsonify({"command": None, "value": None})

if __name__ == "__main__":
    print("🌐 Broodinnox Remote Control Server Started")
    print("📍 Access dashboard at: https://your-render-url.onrender.com")
    app.run(host="0.0.0.0", port=10000, debug=False)
