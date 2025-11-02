# app.py
from flask import Flask, request, jsonify
from datetime import datetime
import os

app = Flask(__name__)

# Store only the latest data (single record)
latest_data = None

@app.route('/')
def home():
    return jsonify({
        "message": "ESP32 API Server is running!",
        "status": "active",
        "timestamp": datetime.now().isoformat(),
        "data_count": 1 if latest_data else 0
    })

@app.route('/send', methods=['POST'])
def receive_esp32_data():
    """
    Endpoint for ESP32 to send data
    Replaces any existing data with the new data
    """
    global latest_data
    
    try:
        # Try to get JSON data first
        if request.is_json:
            data = request.get_json()
        else:
            # If not JSON, try form data or raw data
            data = request.form.to_dict() or request.get_data(as_text=True)
        
        if not data:
            return jsonify({"error": "No data provided"}), 400
        
        # Create the latest data record (replaces previous)
        latest_data = {
            'data': data,
            'received_at': datetime.now().isoformat(),
            'id': 1  # Always ID 1 since we only keep one record
        }
        
        print(f"📥 New data received: {data}")
        print(f"🔄 Replaced previous data (if any)")
        
        return jsonify({
            "message": "Data received successfully - replaced existing data",
            "status": "replaced",
            "received_at": latest_data['received_at']
        }), 201
        
    except Exception as e:
        print(f"❌ Error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/data', methods=['POST'])
def receive_data():
    """
    Alternative endpoint for JSON data - also replaces existing data
    """
    global latest_data
    
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({"error": "No data provided"}), 400
        
        # Replace existing data with new data
        latest_data = {
            'data': data,
            'received_at': datetime.now().isoformat(),
            'id': 1
        }
        
        print(f"📥 Received via /api/data: {data}")
        
        return jsonify({
            "message": "Data received successfully - replaced existing data",
            "status": "replaced",
            "received_at": latest_data['received_at']
        }), 201
        
    except Exception as e:
        print(f"❌ Error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/data', methods=['GET'])
def get_latest_data():
    """Get the latest (and only) stored data"""
    if latest_data is None:
        return jsonify({
            "message": "No data available",
            "status": "empty"
        }), 404
    
    return jsonify({
        "message": "Latest data",
        "data": latest_data
    })

@app.route('/data', methods=['GET'])
def get_data_simple():
    """Simple endpoint to get just the data (without metadata)"""
    if latest_data is None:
        return jsonify({"error": "No data available"}), 404
    
    return jsonify(latest_data['data'])

@app.route('/current', methods=['GET'])
def get_current():
    """Very simple endpoint returning just the latest sensor values"""
    if latest_data is None:
        return jsonify({"error": "No data available"}), 404
    
    return jsonify(latest_data['data'])

@app.route('/health')
def health():
    return jsonify({
        "status": "healthy", 
        "timestamp": datetime.now().isoformat(),
        "has_data": latest_data is not None
    })

@app.route('/clear', methods=['POST', 'DELETE'])
def clear_data():
    """Clear the stored data"""
    global latest_data
    latest_data = None
    return jsonify({
        "message": "Data cleared successfully", 
        "status": "cleared"
    })

@app.route('/status')
def status():
    """Check server status and data info"""
    return jsonify({
        "server_status": "running",
        "data_available": latest_data is not None,
        "last_update": latest_data['received_at'] if latest_data else None,
        "storage_type": "single_record_replace"
    })

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 10000))
    app.run(host='0.0.0.0', port=port, debug=False)
