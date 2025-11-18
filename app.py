from flask import Flask, request, jsonify
from datetime import datetime

app = Flask(__name__)

@app.route("/", methods=["GET"])
def home():
    return "GSM Flask API is running."

@app.route("/api/name", methods=["POST"])
def receive_name():
    data = request.get_json()

    if not data or "name" not in data:
        return jsonify({
            "status": "error",
            "message": "Missing 'name' in JSON"
        }), 400

    name = data["name"]

    print("Received name:", name)

    return jsonify({
        "status": "success",
        "message": f"Hello {name}, your data was received!",
        "time": datetime.now().isoformat()
    })

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
