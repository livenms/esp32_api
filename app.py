# File: app.py
from flask import Flask, request, jsonify

app = Flask(__name__)

# Store latest data in memory
latest_data = {"device": "none", "temp": 0, "status": "no data"}

@app.route("/", methods=["GET"])
def home():
    return "✅ ESP32 API is running!"

@app.route("/data", methods=["POST"])
def receive_data():
    global latest_data
    data = request.get_json()
    if data:
        latest_data = data
        print("Received from ESP32:", data)
        return jsonify({"message": "Data received!", "data": data}), 200
    else:
        return jsonify({"error": "No data received"}), 400

@app.route("/data", methods=["GET"])
def send_data():
    return jsonify(latest_data)

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=10000)
