# app.py
from flask import Flask, request, jsonify
from datetime import datetime
import os

app = Flask(__name__)

# Store data in memory (for demo)
data_store = []

@app.route('/')
def home():
    return jsonify({
        "message": "ESP32 API Server is running on Render!",
        "status": "active",
        "timestamp": datetime.now().isoformat()
    })

@app.route('/api/data', methods=['POST'])
def receive_data():
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({"error": "No data provided"}), 400
        
        # Add timestamp and ID
        data['id'] = len(data_store) + 1
        data['received_at'] = datetime.now().isoformat()
        
        data_store.append(data)
        
        print(f"📥 Received data: {data}")  # This will appear in Render logs
        
        return jsonify({
            "message": "Data received successfully",
            "id": data['id'],
            "status": "stored"
        }), 201
        
    except Exception as e:
        print(f"❌ Error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/data', methods=['GET'])
def get_all_data():
    return jsonify({
        "count": len(data_store),
        "data": data_store
    })

@app.route('/api/data/<int:data_id>', methods=['GET'])
def get_data(data_id):
    if data_id < 1 or data_id > len(data_store):
        return jsonify({"error": "Data not found"}), 404
    
    return jsonify(data_store[data_id - 1])

# Health check endpoint for Render
@app.route('/health')
def health():
    return jsonify({"status": "healthy", "timestamp": datetime.now().isoformat()})

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 10000))
    app.run(host='0.0.0.0', port=port, debug=False)
