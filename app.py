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
        "message": "ESP32 API Server is running!",
        "status": "active",
        "timestamp": datetime.now().isoformat()
    })

@app.route('/send', methods=['POST'])
def receive_esp32_data():
    """
    Endpoint for ESP32 to send data
    This matches what your ESP32 is trying to POST to
    """
    try:
        # Try to get JSON data first
        if request.is_json:
            data = request.get_json()
        else:
            # If not JSON, try form data or raw data
            data = request.form.to_dict() or request.get_data(as_text=True)
        
        if not data:
            return jsonify({"error": "No data provided"}), 400
        
        # Create a structured response
        response_data = {
            'id': len(data_store) + 1,
            'received_at': datetime.now().isoformat(),
            'original_data': data
        }
        
        data_store.append(response_data)
        
        print(f"📥 Received from ESP32: {data}")
        print(f"📊 Total records: {len(data_store)}")
        
        return jsonify({
            "message": "Data received successfully from ESP32",
            "id": response_data['id'],
            "status": "success"
        }), 201
        
    except Exception as e:
        print(f"❌ Error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/data', methods=['POST'])
def receive_data():
    """
    Alternative endpoint for JSON data
    """
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({"error": "No data provided"}), 400
        
        # Add timestamp and ID
        data['id'] = len(data_store) + 1
        data['received_at'] = datetime.now().isoformat()
        
        data_store.append(data)
        
        print(f"📥 Received data: {data}")
        
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
    """Get all stored data"""
    return jsonify({
        "count": len(data_store),
        "data": data_store
    })

@app.route('/api/data/<int:data_id>', methods=['GET'])
def get_data(data_id):
    """Get specific data by ID"""
    if data_id < 1 or data_id > len(data_store):
        return jsonify({"error": "Data not found"}), 404
    
    return jsonify(data_store[data_id - 1])

@app.route('/health')
def health():
    return jsonify({"status": "healthy", "timestamp": datetime.now().isoformat()})

# Clear all data (for testing)
@app.route('/clear', methods=['POST'])
def clear_data():
    data_store.clear()
    return jsonify({"message": "All data cleared", "count": 0})

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 10000))
    app.run(host='0.0.0.0', port=port, debug=False)
