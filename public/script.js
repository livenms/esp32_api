// ────────────────────────────────────────────────
// Configuration – change only if you use different broker/topics
// ────────────────────────────────────────────────
const MQTT_BROKER    = 'wss://test.mosquitto.org:8081/mqtt';   // secure websocket port
const DEVICE_ID      = 'BROODIINNOX-001';
const BASE_TOPIC     = `broodinnox/${DEVICE_ID}/`;
const TOPIC_TELEMETRY = BASE_TOPIC + 'telemetry';
const TOPIC_STATUS    = BASE_TOPIC + 'status';

// ────────────────────────────────────────────────
let client = null;
let reconnectTimer = null;

function connectMQTT() {
  if (client) client.end();

  client = mqtt.connect(MQTT_BROKER, {
    clientId: 'web_dashboard_' + Math.random().toString(16).slice(3),
    clean: true,
    reconnectPeriod: 0   // we handle reconnect ourselves
  });

  client.on('connect', () => {
    document.getElementById('conn-status').textContent = 'Connected';
    document.getElementById('conn-status').style.color = '#3fb950';
    document.getElementById('alert').classList.add('hidden');

    client.subscribe(TOPIC_TELEMETRY);
    client.subscribe(TOPIC_STATUS);
    console.log('Subscribed to telemetry & status');
  });

  client.on('message', (topic, message) => {
    try {
      const payload = JSON.parse(message.toString());
      updateDashboard(payload, topic);
    } catch (e) {
      console.error('Invalid JSON:', e);
    }
  });

  client.on('error', (err) => {
    console.error('MQTT error:', err);
    document.getElementById('conn-status').textContent = 'Error';
    document.getElementById('conn-status').style.color = '#f85149';
  });

  client.on('close', () => {
    document.getElementById('conn-status').textContent = 'Disconnected';
    document.getElementById('conn-status').style.color = '#8b949e';
    document.getElementById('alert').classList.remove('hidden');

    // Auto reconnect
    clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(connectMQTT, 5000);
  });
}

function updateDashboard(data, topic) {
  const now = new Date().toLocaleTimeString();
  document.getElementById('last-update').textContent = now;

  if (topic.endsWith('/status')) {
    // status topic
    document.getElementById('device-enabled').textContent = data.status || 'Unknown';
    document.getElementById('device-enabled').style.color = 
      data.status === 'ENABLED' ? '#3fb950' : '#f85149';
  }

  if (topic.endsWith('/telemetry')) {
    // main telemetry
    document.getElementById('day').textContent = `${data.cycle_day || '?'} / ${data.total_days || '?'}`;
    
    const temp = data.temperature === 'N/A' ? '—.—' : Number(data.temperature).toFixed(1);
    document.getElementById('temp').textContent = temp + ' °C';

    document.getElementById('heater').textContent = data.heater || 'OFF';
    document.getElementById('heater').className = 'value big state ' + 
      (data.heater === 'ON' ? 'green' : 'red');

    document.getElementById('mode').textContent = data.relay_mode || '—';

    // Evening info
    let evening = '—';
    if (data.evening_cycle_active) {
      evening = data.evening_heater_on ? 'ON phase' : 'OFF phase';
    }
    document.getElementById('evening-phase').textContent = evening;

    // Sensors
    if (data.sensors) {
      document.getElementById('t1').textContent = data.sensors.temp1 !== 'NaN' ? Number(data.sensors.temp1).toFixed(1) : 'ERR';
      document.getElementById('t2').textContent = data.sensors.temp2 !== 'NaN' ? Number(data.sensors.temp2).toFixed(1) : 'ERR';
      document.getElementById('t3').textContent = data.sensors.temp3 !== 'NaN' ? Number(data.sensors.temp3).toFixed(1) : 'ERR';
      document.getElementById('t4').textContent = data.sensors.temp4 !== 'NaN' ? Number(data.sensors.temp4).toFixed(1) : 'ERR';
    }
  }
}

// Start connection
connectMQTT();
