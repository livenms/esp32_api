from flask import Flask, request, jsonify
from datetime import datetime

app = Flask(__name__)

# Device and command storage
device_status = {}
command_queue = {}
DEVICE_ID = "broodinnox_001"

@app.route("/send", methods=["POST"])
def receive_data():
    """Receive data from ESP32"""
    try:
        data = request.get_json()
        device_id = data.get("device", DEVICE_ID)
        data["last_update"] = datetime.now().isoformat()
        data["online"] = True
        device_status[device_id] = data
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
        return jsonify({"online": False, "message": "Device not connected"})
    
    data = device_status[device_id]
    last_update = datetime.fromisoformat(data["last_update"])
    seconds = (datetime.now() - last_update).total_seconds()
    data["online"] = seconds < 120  # 2 min threshold
    return jsonify(data)


@app.route("/command", methods=["POST"])
def queue_command():
    """Web interface sends commands"""
    try:
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
    except Exception as e:
        return jsonify({"success": False, "message": str(e)})


@app.route("/command", methods=["GET"])
def get_command():
    """ESP32 fetches commands"""
    device_id = request.args.get("device", DEVICE_ID)
    if device_id in command_queue:
        cmd = command_queue[device_id]
        del command_queue[device_id]
        return jsonify(cmd)
    return jsonify({"command": None, "value": None})


if __name__ == "__main__":
    import os
    print("🌐 Broodinnox API Server started")
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 10000)))
