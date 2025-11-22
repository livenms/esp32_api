from flask import Flask, request, jsonify
import numpy as np
import base64
import json
import os
from datetime import datetime

app = Flask(__name__)

# Database file to store fingerprint templates
DATABASE_FILE = 'fingerprints.json'

# Initialize database if it doesn't exist
if not os.path.exists(DATABASE_FILE):
    with open(DATABASE_FILE, 'w') as f:
        json.dump([], f)

def load_database():
    """Load fingerprint database from file"""
    try:
        with open(DATABASE_FILE, 'r') as f:
            return json.load(f)
    except:
        return []

def save_database(data):
    """Save fingerprint database to file"""
    with open(DATABASE_FILE, 'w') as f:
        json.dump(data, f, indent=2)

def calculate_similarity(template1, template2):
    """
    Calculate similarity between two fingerprint templates
    Returns percentage match (0-100)
    """
    if len(template1) != len(template2):
        return 0
    
    # Convert to numpy arrays for faster computation
    arr1 = np.frombuffer(template1, dtype=np.uint8)
    arr2 = np.frombuffer(template2, dtype=np.uint8)
    
    # Calculate Hamming distance (number of differing bits)
    xor = np.bitwise_xor(arr1, arr2)
    hamming_distance = np.unpackbits(xor).sum()
    
    # Calculate similarity percentage
    total_bits = len(template1) * 8
    similarity = 100 * (1 - (hamming_distance / total_bits))
    
    return round(similarity, 2)

def find_best_match(template_data, threshold=40):
    """
    Find best matching fingerprint in database
    Returns: (matched_user, similarity) or (None, best_similarity)
    """
    database = load_database()
    best_match = None
    best_similarity = 0
    
    for user in database:
        stored_template = base64.b64decode(user['template'])
        similarity = calculate_similarity(template_data, stored_template)
        
        print(f"  Comparing with {user['name']}: {similarity}%")
        
        if similarity > best_similarity:
            best_similarity = similarity
            if similarity >= threshold:
                best_match = user
    
    return best_match, best_similarity

@app.route('/')
def home():
    """Home page with system info"""
    database = load_database()
    return jsonify({
        'status': 'online',
        'message': 'Fingerprint Recognition Server',
        'endpoints': {
            '/match': 'POST - Match fingerprint (binary data)',
            '/register': 'POST - Register new fingerprint (JSON)',
            '/users': 'GET - List all registered users',
            '/delete/<user_id>': 'DELETE - Remove user'
        },
        'registered_users': len(database),
        'timestamp': datetime.now().isoformat()
    })

@app.route('/match', methods=['POST'])
def match_fingerprint():
    """
    Match incoming fingerprint template
    Expects: Binary data (512 bytes) or JSON with base64 template
    """
    try:
        # Check if data is binary (from ESP32)
        if request.content_type == 'application/octet-stream':
            template_data = request.data
            print(f"Received binary template: {len(template_data)} bytes")
            
        # Check if data is JSON (with base64 encoded template)
        elif request.content_type == 'application/json':
            json_data = request.get_json()
            if 'template' not in json_data:
                return jsonify({'status': 'error', 'message': 'Missing template field'}), 400
            
            template_data = base64.b64decode(json_data['template'])
            print(f"Received base64 template: {len(template_data)} bytes")
        else:
            return jsonify({'status': 'error', 'message': 'Invalid content type'}), 400
        
        # Validate template size
        if len(template_data) != 512:
            return jsonify({
                'status': 'error',
                'message': f'Invalid template size: {len(template_data)} bytes (expected 512)'
            }), 400
        
        print(f"\n=== Matching Fingerprint ===")
        print(f"Template size: {len(template_data)} bytes")
        
        # Find best match
        matched_user, similarity = find_best_match(template_data, threshold=40)
        
        if matched_user:
            print(f"✓ MATCH FOUND: {matched_user['name']} ({similarity}%)")
            return jsonify({
                'status': 'ok',
                'message': 'Match found',
                'user_name': matched_user['name'],
                'user_phone': matched_user['phone'],
                'user_id': matched_user['id'],
                'similarity': similarity,
                'timestamp': datetime.now().isoformat()
            })
        else:
            print(f"✗ NO MATCH (best: {similarity}%)")
            return jsonify({
                'status': 'no_match',
                'message': 'No matching fingerprint found',
                'best_similarity': similarity,
                'timestamp': datetime.now().isoformat()
            })
    
    except Exception as e:
        print(f"Error: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@app.route('/register', methods=['POST'])
def register_fingerprint():
    """
    Register new fingerprint
    Expects JSON: {
        "template": "base64_encoded_template",
        "name": "User Name",
        "phone": "1234567890"
    }
    """
    try:
        # Handle binary data
        if request.content_type == 'application/octet-stream':
            return jsonify({
                'status': 'error',
                'message': 'Use JSON format with name and phone for registration'
            }), 400
        
        data = request.get_json()
        
        # Validate required fields
        if not all(k in data for k in ['template', 'name', 'phone']):
            return jsonify({
                'status': 'error',
                'message': 'Missing required fields: template, name, phone'
            }), 400
        
        # Decode template
        template_data = base64.b64decode(data['template'])
        
        if len(template_data) != 512:
            return jsonify({
                'status': 'error',
                'message': f'Invalid template size: {len(template_data)} bytes'
            }), 400
        
        # Load database
        database = load_database()
        
        # Check if fingerprint already exists
        matched_user, similarity = find_best_match(template_data, threshold=70)
        if matched_user:
            return jsonify({
                'status': 'error',
                'message': 'Fingerprint already registered',
                'existing_user': matched_user['name'],
                'similarity': similarity
            }), 400
        
        # Create new user entry
        new_user = {
            'id': len(database) + 1,
            'name': data['name'],
            'phone': data['phone'],
            'template': data['template'],
            'registered_at': datetime.now().isoformat()
        }
        
        database.append(new_user)
        save_database(database)
        
        print(f"✓ Registered: {new_user['name']} (ID: {new_user['id']})")
        
        return jsonify({
            'status': 'registered',
            'message': 'Fingerprint registered successfully',
            'user_id': new_user['id'],
            'user_name': new_user['name'],
            'user_phone': new_user['phone']
        })
    
    except Exception as e:
        print(f"Error: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@app.route('/users', methods=['GET'])
def list_users():
    """List all registered users"""
    database = load_database()
    users = [{
        'id': user['id'],
        'name': user['name'],
        'phone': user['phone'],
        'registered_at': user.get('registered_at', 'Unknown')
    } for user in database]
    
    return jsonify({
        'status': 'ok',
        'count': len(users),
        'users': users
    })

@app.route('/delete/<int:user_id>', methods=['DELETE'])
def delete_user(user_id):
    """Delete a user by ID"""
    database = load_database()
    
    # Find and remove user
    database = [u for u in database if u['id'] != user_id]
    save_database(database)
    
    return jsonify({
        'status': 'ok',
        'message': f'User {user_id} deleted'
    })

@app.route('/clear', methods=['POST'])
def clear_database():
    """Clear entire database (use with caution!)"""
    save_database([])
    return jsonify({
        'status': 'ok',
        'message': 'Database cleared'
    })

if __name__ == '__main__':
    print("\n========================================")
    print("  FINGERPRINT RECOGNITION SERVER")
    print("========================================")
    print(f"Database: {DATABASE_FILE}")
    print(f"Registered users: {len(load_database())}")
    print("Starting server...")
    print("========================================\n")
    
    # Run server
    app.run(host='0.0.0.0', port=5000, debug=True)
