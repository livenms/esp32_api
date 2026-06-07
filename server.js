/**
 * BROODINNOX Dashboard Server
 * Author: Muyirama Sezerano Liven
 */

const express  = require('express');
const mqtt     = require('mqtt');
const cors     = require('cors');
const path     = require('path');
const http     = require('http');
const { Server } = require('socket.io');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, { cors: { origin: '*', methods: ['GET', 'POST'] } });

const PORT        = process.env.PORT        || 3000;
const MQTT_BROKER = process.env.MQTT_BROKER || 'mqtt://broker.hivemq.com';
const DEVICE_ID   = process.env.DEVICE_ID  || 'BROODIINNOX-001';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

let deviceData = {
  device_id: DEVICE_ID, device_name: 'Broodinnox',
  ave_temp: null, sensor1: null, sensor2: null, sensor3: null, sensor4: null,
  max_temp: 36, min_temp: 32, day: 0, total_days: 30,
  relay_state: false, manual_control: false,
  failsafe_mode: false, sensor_error: false, mismatch_error: false,
  s1_enabled: true, s2_enabled: true, s3_enabled: true, s4_enabled: true,
  weekly_reduce_enabled: true, weekly_reduce_deg: 3, last_reduction_day: 0,
  signal_quality: 0, error: '', status: 'offline', lastSeen: null, timestamp: null,
  device_active: true   // subscription state — true = active, false = locked
};

const MAX_HISTORY = 2000;
let history = [];

const T = {
  data:            `broodinnox/${DEVICE_ID}/data`,
  status:          `broodinnox/${DEVICE_ID}/status`,
  ctrl_relay:      `broodinnox/${DEVICE_ID}/control/relay`,
  ctrl_max_temp:   `broodinnox/${DEVICE_ID}/control/max_temp`,
  ctrl_min_temp:   `broodinnox/${DEVICE_ID}/control/min_temp`,
  ctrl_total_days: `broodinnox/${DEVICE_ID}/control/total_days`,
  ctrl_sensor:     `broodinnox/${DEVICE_ID}/control/sensor`,
  ctrl_factory:    `broodinnox/${DEVICE_ID}/control/factory_reset`,
  ctrl_preset:        `broodinnox/${DEVICE_ID}/control/animal_preset`,
  ctrl_subscription:  `broodinnox/${DEVICE_ID}/control/subscription`,
};

const mqttClient = mqtt.connect(MQTT_BROKER, {
  clientId: `broodinnox-srv-${Math.random().toString(16).slice(3)}`,
  clean: true, connectTimeout: 8000, reconnectPeriod: 3000,
});

mqttClient.on('connect', () => {
  console.log(`MQTT connected -> ${MQTT_BROKER}`);
  [T.data, T.status].forEach(t => mqttClient.subscribe(t, e => {
    if (e) console.error('subscribe failed:', t); else console.log('subscribed:', t);
  }));
});

mqttClient.on('message', (topic, raw) => {
  let payload;
  try { payload = JSON.parse(raw.toString()); } catch { return; }

  if (topic === T.data) {
    deviceData = { ...deviceData, ...payload, status: 'online', lastSeen: new Date().toISOString() };
    const t = typeof payload.ave_temp === 'number' ? payload.ave_temp : null;
    if (t !== null && t > -900) {
      history.push({ ts: payload.timestamp ? payload.timestamp * 1000 : Date.now(), temp: t, relay: payload.relay_state, day: payload.day });
      if (history.length > MAX_HISTORY) history = history.slice(-MAX_HISTORY);
    }
    io.emit('deviceUpdate', deviceData);
  } else if (topic === T.status) {
    deviceData = { ...deviceData, ...payload, status: 'online', lastSeen: new Date().toISOString() };
    io.emit('deviceUpdate', deviceData);
  }
});

mqttClient.on('error', e => console.error('MQTT error:', e.message));
mqttClient.on('offline', () => console.log('MQTT offline'));
mqttClient.on('reconnect', () => console.log('MQTT reconnecting...'));

io.on('connection', socket => {
  socket.emit('deviceUpdate', deviceData);
  socket.emit('historyData', history);
  socket.on('disconnect', () => {});
});

setInterval(() => {
  if (deviceData.lastSeen && Date.now() - new Date(deviceData.lastSeen).getTime() > 30000 && deviceData.status !== 'offline') {
    deviceData.status = 'offline';
    io.emit('deviceUpdate', deviceData);
  }
}, 5000);

app.get('/api/health', (_req, res) => res.json({ status: 'healthy', mqtt_connected: mqttClient.connected, device_status: deviceData.status, uptime_s: Math.round(process.uptime()) }));
app.get('/api/device', (_req, res) => res.json(deviceData));
app.get('/api/history', (req, res) => { const limit = Math.min(parseInt(req.query.limit)||200, MAX_HISTORY); res.json(history.slice(-limit)); });

app.post('/api/control/relay', (req, res) => {
  const { command } = req.body;
  if (!['ON','OFF','AUTO'].includes(command)) return res.status(400).json({ error: 'command must be ON, OFF, or AUTO' });
  mqttClient.publish(T.ctrl_relay, command);
  res.json({ ok: true, command });
});

app.post('/api/control/temperature', (req, res) => {
  const { max_temp, min_temp } = req.body;
  let sent = 0;
  if (max_temp !== undefined && max_temp > 0 && max_temp <= 50) { mqttClient.publish(T.ctrl_max_temp, String(max_temp)); sent++; }
  if (min_temp !== undefined && min_temp >= 10)                  { mqttClient.publish(T.ctrl_min_temp, String(min_temp)); sent++; }
  if (!sent) return res.status(400).json({ error: 'No valid values' });
  res.json({ ok: true });
});

app.post('/api/control/total-days', (req, res) => {
  const { total_days } = req.body;
  if (!total_days || total_days < 1 || total_days > 365) return res.status(400).json({ error: 'total_days must be 1-365' });
  mqttClient.publish(T.ctrl_total_days, String(total_days));
  res.json({ ok: true });
});

app.post('/api/control/sensor', (req, res) => {
  const { sensor, state } = req.body;
  if (![1,2,3,4].includes(Number(sensor))) return res.status(400).json({ error: 'sensor must be 1-4' });
  if (!['ON','OFF'].includes(state))        return res.status(400).json({ error: 'state must be ON or OFF' });
  mqttClient.publish(T.ctrl_sensor, `DS${sensor}:${state}`);
  res.json({ ok: true });
});

app.post('/api/control/preset', (req, res) => {
  const { animal } = req.body;
  const valid = ['Chicken','Pig','Turkey','Duck'];
  if (!valid.includes(animal)) return res.status(400).json({ error: `animal must be one of: ${valid.join(', ')}` });
  mqttClient.publish(T.ctrl_preset, animal);
  res.json({ ok: true });
});

app.post('/api/control/factory-reset', (_req, res) => {
  mqttClient.publish(T.ctrl_factory, 'RESET');
  res.json({ ok: true });
});

// Subscription activation / deactivation
// body: { command: "ACTIVATE" | "DEACTIVATE" }
app.post('/api/control/subscription', (req, res) => {
  const { command } = req.body;
  if (!['ACTIVATE', 'DEACTIVATE'].includes(command))
    return res.status(400).json({ error: 'command must be ACTIVATE or DEACTIVATE' });
  mqttClient.publish(T.ctrl_subscription, command);
  res.json({ ok: true, command });
});

app.delete('/api/history', (_req, res) => { history = []; res.json({ ok: true }); });
app.get('*', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

server.listen(PORT, () => {
  console.log(`Broodinnox Dashboard  ->  http://localhost:${PORT}`);
  console.log(`MQTT: ${MQTT_BROKER}  |  Device: ${DEVICE_ID}`);
});

process.on('SIGTERM', () => { server.close(() => { mqttClient.end(); process.exit(0); }); });
