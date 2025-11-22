from flask import Flask, request, jsonify, render_template_string
import json
import os

STATE_FILE = 'state.json'
app = Flask(__name__)
PORT = int(os.environ.get('PORT', 80))

# Load or default state
if os.path.exists(STATE_FILE):
    try:
        with open(STATE_FILE, 'r') as f:
            state = json.load(f)
    except Exception:
        state = {"server_message":"Hello from Flask","led_command":"OFF"}
else:
    state = {"server_message":"Hello from Flask","led_command":"OFF"}

def save_state():
    with open(STATE_FILE, 'w') as f:
        json.dump(state, f)

@app.route('/esp', methods=['GET'])
def esp():
    led = request.args.get('led', None)
    if led and led.upper() in ('ON','OFF'):
        state['led_command'] = led.upper()
        state['server_message'] = f"LED set to {state['led_command']} by query"
        save_state()
    return jsonify(state)

@app.route('/set', methods=['GET'])
def set_led():
    led = request.args.get('led', None)
    if not led or led.upper() not in ('ON', 'OFF'):
        return jsonify({'error':'use ?led=ON or ?led=OFF'}), 400
    state['led_command'] = led.upper()
    state['server_message'] = f"LED set to {state['led_command']} via /set"
    save_state()
    return jsonify(state)

@app.route('/')
def home():
    html = f"""
    <html><body>
      <h3>ESP Flask Server</h3>
      <p>Current LED: {state['led_command']}</p>
      <a href="/set?led=ON">Turn ON</a> |
      <a href="/set?led=OFF">Turn OFF</a>
      <hr/>
      <p>ESP GET endpoint: <code>/esp</code></p>
    </body></html>
    """
    return html

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=PORT)
