from flask import Flask, request, jsonify

app = Flask(__name__)

data_store = {}

@app.route("/send", methods=["POST"])
def receive_data():
    content = request.get_json()
    if content:
        data_store.update(content)
        return jsonify({"status": "success", "received": content})
    return jsonify({"status": "fail", "message": "No JSON received"}), 400

@app.route("/data", methods=["GET"])
def send_data():
    return jsonify(data_store)

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=10000)
