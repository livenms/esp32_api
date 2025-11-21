from flask import Flask, request, jsonify

app = Flask(__name__)

@app.route("/test", methods=["POST"])
def receive_data():
    try:
        data = request.get_json(force=True)

        name = data.get("name", "unknown")
        temp = data.get("temp", None)

        print("=== DATA RECEIVED FROM ESP32 ===")
        print(data)

        # Build feedback for ESP32
        feedback = {
            "status": "success",
            "received_name": name,
            "received_temp": temp,
            "reply": "Data stored. Continue.",
            "command": "LED_ON" if temp and temp > 30 else "LED_OFF"
        }

        return jsonify(feedback), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 400


@app.route("/", methods=["GET"])
def home():
    return "ESP32 GSM Server Running!"
