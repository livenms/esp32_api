/**
 * Broodinnox Dashboard Server
 * Author: Muyirama Sezerano Liven
 *
 * MQTT topics match firmware exactly:
 *   broodinnox/{DEVICE_ID}/data              <- periodic sensor payload
 *   broodinnox/{DEVICE_ID}/status            <- quick status update
 *   broodinnox/{DEVICE_ID}/control/relay     -> ON | OFF | AUTO
 *   broodinnox/{DEVICE_ID}/control/max_temp  -> integer string
 *   broodinnox/{DEVICE_ID}/control/min_temp  -> integer string
 *   broodinnox/{DEVICE_ID}/control/total_days -> integer string
 *   broodinnox/{DEVICE_ID}/control/sensor    -> DS1:ON | DS1:OFF | DS2:ON …
 *   broodinnox/{DEVICE_ID}/control/factory_reset -> RESET
 *   broodinnox/{DEVICE_ID}/control/animal_preset -> Chicken | Pig | Turkey | Duck
 */

const express   = require('express');
const mqtt      = require('mqtt');
const cors      = require('cors');
const path      = require('path');
const http      = require('http');
const { Server } = require('socket.io');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, { cors: { origin: '*', methods: ['GET', 'POST'] } });

const PORT       = process.env.PORT       || 3000;
const MQTT_BROKER = process.env.MQTT_BROKER || 'mqtt://broker.hivemq.com';
const DEVICE_ID  = process.env.DEVICE_ID   || 'BROODIINNOX-001';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── In-memory device state (mirrors firmware globals) ──────────────────────
let deviceState = {
  device_id:   DEVICE_ID,
  device_name: 'Broodinnox',
  // Brooding progress
  day:         0,
  total_days:  30,
  // Temperature
  ave_temp:    null,
  max_temp:    36,
  min_temp:    32,
  sensor1:     null,
  sensor2:     null,
  sensor3:     null,
  sensor4:     null,
  s1_enabled:  true,
  s2_enabled:  true,
  s3_enabled:  true,
  s4_enabled:  true,
  // Control
  relay_state:     false,  // true = ON
  manual_control:  false,  // true = MANUAL, false = AUTO
  failsafe_mode:   false,
  sensor_error:    false,
  mismatch_error:  false,
  // Weekly reduction
  weekly_reduce_enabled: true,
  weekly_reduce_deg:     3,
  last_reduction_day:    0,
  // Signal & connectivity
  signal_quality: 0,
  error:          '',
  // Server-side metadata
  status:   'offline',
  lastSeen: null,
  timestamp: null,
};

// Circular buffer for chart history
const MAX_HISTORY = 2000;
let history = [];   // { ts, ave_temp, sensor1, sensor2, sensor3, sensor4, relay_state }

// ── MQTT Topics ──────────────────────────────────────────────────────────────
const T = {
  data:           `broodinnox/${DEVICE_ID}/data`,
  status:         `broodinnox/${DEVICE_ID}/status`,
  ctrl_relay:     `broodinnox/${DEVICE_ID}/control/relay`,
  ctrl_max_temp:  `broodinnox/${DEVICE_ID}/control/max_temp`,
  ctrl_min_temp:  `broodinnox/${DEVICE_ID}/control/min_temp`,
  ctrl_total_days:`broodinnox/${DEVICE_ID}/control/total_days`,
  ctrl_sensor:    `broodinnox/${DEVICE_ID}/control/sensor`,
  ctrl_factory:   `broodinnox/${DEVICE_ID}/control/factory_reset`,
  ctrl_animal:    `broodinnox/${DEVICE_ID}/control/animal_preset`,
};

// ── MQTT Client ───────────────────────────────────────────────────────────────
const mqttClient = mqtt.connect(MQTT_BROKER, {
  clientId:        `broodinnox-srv-${Math.random().toString(16).slice(3)}`,
  clean:           true,
  connectTimeout:  8000,
  reconnectPeriod: 3000,
  keepalive:       60,
});

mqttClient.on('connect', () => {
  console.log(`✅ MQTT connected → ${MQTT_BROKER}`);
  mqttClient.subscribe([T.data, T.status], (err) => {
    if (err) console.error('❌ Subscribe error:', err);
    else     console.log(`📡 Subscribed: ${T.data}, ${T.status}`);
  });
});

mqttClient.on('message', (topic, raw) => {
  let payload;
  try { payload = JSON.parse(raw.toString()); }
  catch (e) { console.warn('Non-JSON MQTT msg on', topic); return; }

  const now = new Date().toISOString();

  if (topic === T.data) {
    // Map firmware JSON keys → deviceState
    deviceState = {
      ...deviceState,
      device_id:   payload.device_id   ?? deviceState.device_id,
      device_name: payload.device_name ?? deviceState.device_name,
      day:         payload.day         ?? deviceState.day,
      total_days:  payload.total_days  ?? deviceState.total_days,
      ave_temp:    payload.ave_temp === -999 ? null : (payload.ave_temp ?? deviceState.ave_temp),
      max_temp:    payload.max_temp    ?? deviceState.max_temp,
      min_temp:    payload.min_temp    ?? deviceState.min_temp,
      sensor1:     payload.sensor1     ?? null,
      sensor2:     payload.sensor2     ?? null,
      sensor3:     payload.sensor3     ?? null,
      sensor4:     payload.sensor4     ?? null,
      s1_enabled:  payload.s1_enabled  ?? deviceState.s1_enabled,
      s2_enabled:  payload.s2_enabled  ?? deviceState.s2_enabled,
      s3_enabled:  payload.s3_enabled  ?? deviceState.s3_enabled,
      s4_enabled:  payload.s4_enabled  ?? deviceState.s4_enabled,
      relay_state:    payload.relay_state    ?? deviceState.relay_state,
      manual_control: payload.manual_control ?? deviceState.manual_control,
      failsafe_mode:  payload.failsafe_mode  ?? deviceState.failsafe_mode,
      sensor_error:   payload.sensor_error   ?? deviceState.sensor_error,
      mismatch_error: payload.mismatch_error ?? deviceState.mismatch_error,
      weekly_reduce_enabled: payload.weekly_reduce_enabled ?? deviceState.weekly_reduce_enabled,
      weekly_reduce_deg:     payload.weekly_reduce_deg     ?? deviceState.weekly_reduce_deg,
      last_reduction_day:    payload.last_reduction_day    ?? deviceState.last_reduction_day,
      signal_quality: payload.signal_quality ?? deviceState.signal_quality,
      error:          payload.error          ?? '',
      status:         'online',
      lastSeen:       now,
      timestamp:      payload.timestamp ?? Math.floor(Date.now() / 1000),
    };

    // Push to history ring buffer
    history.push({
      ts:       deviceState.timestamp,
      ave_temp: deviceState.ave_temp,
      s1:       deviceState.sensor1,
      s2:       deviceState.sensor2,
      s3:       deviceState.sensor3,
      s4:       deviceState.sensor4,
      relay:    deviceState.relay_state,
    });
    if (history.length > MAX_HISTORY) history = history.slice(-MAX_HISTORY);

  } else if (topic === T.status) {
    // Quick status update from firmware
    deviceState = {
      ...deviceState,
      relay_state:    payload.relay_state === 'ON',
      manual_control: payload.manual_control === 'MANUAL',
      day:            payload.day         ?? deviceState.day,
      total_days:     payload.total_days  ?? deviceState.total_days,
      max_temp:       payload.max_temp    ?? deviceState.max_temp,
      min_temp:       payload.min_temp    ?? deviceState.min_temp,
      ave_temp:       payload.ave_temp === -999 ? null : (payload.ave_temp ?? deviceState.ave_temp),
      failsafe_mode:  payload.failsafe   ?? deviceState.failsafe_mode,
      signal_quality: payload.signal_quality ?? deviceState.signal_quality,
      status:   'online',
      lastSeen: now,
    };
  }

  io.emit('state', deviceState);
});

mqttClient.on('error',   (e) => console.error('❌ MQTT error:', e.message));
mqttClient.on('offline', ()  => { console.warn('⚠️  MQTT offline'); deviceState.status = 'offline'; io.emit('state', deviceState); });
mqttClient.on('reconnect', () => console.log('🔄 MQTT reconnecting…'));

// ── Helpers ───────────────────────────────────────────────────────────────────
function publish(topic, payload) {
  if (!mqttClient.connected) return false;
  mqttClient.publish(topic, String(payload));
  return true;
}

// ── REST API ──────────────────────────────────────────────────────────────────

// Current state snapshot
app.get('/api/state', (_req, res) => res.json(deviceState));

// Temperature history (default last 200 points)
app.get('/api/history', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 200, MAX_HISTORY);
  res.json(history.slice(-limit));
});

// ── Control endpoints ─────────────────────────────────────────────────────────

// Relay:  { command: "ON"|"OFF"|"AUTO" }
app.post('/api/control/relay', (req, res) => {
  const { command } = req.body;
  if (!['ON','OFF','AUTO'].includes(command))
    return res.status(400).json({ error: 'command must be ON, OFF or AUTO' });
  const ok = publish(T.ctrl_relay, command);
  res.json({ success: ok, command });
});

// Temperature:  { max_temp: number, min_temp: number }
app.post('/api/control/temperature', (req, res) => {
  const { max_temp, min_temp } = req.body;
  if (max_temp !== undefined) {
    const v = parseInt(max_temp);
    if (isNaN(v) || v < 10 || v > 50)
      return res.status(400).json({ error: 'max_temp must be 10–50' });
    publish(T.ctrl_max_temp, v);
  }
  if (min_temp !== undefined) {
    const v = parseInt(min_temp);
    if (isNaN(v) || v < 10 || v > 50)
      return res.status(400).json({ error: 'min_temp must be 10–50' });
    publish(T.ctrl_min_temp, v);
  }
  res.json({ success: true, max_temp, min_temp });
});

// Total days:  { total_days: number }
app.post('/api/control/total-days', (req, res) => {
  const v = parseInt(req.body.total_days);
  if (isNaN(v) || v < 1 || v > 365)
    return res.status(400).json({ error: 'total_days must be 1–365' });
  const ok = publish(T.ctrl_total_days, v);
  res.json({ success: ok, total_days: v });
});

// Sensor:  { sensor: 1|2|3|4, state: "ON"|"OFF" }
app.post('/api/control/sensor', (req, res) => {
  const { sensor, state } = req.body;
  if (![1,2,3,4].includes(sensor))
    return res.status(400).json({ error: 'sensor must be 1–4' });
  if (!['ON','OFF'].includes(state))
    return res.status(400).json({ error: 'state must be ON or OFF' });
  const msg = `DS${sensor}:${state}`;
  const ok  = publish(T.ctrl_sensor, msg);
  res.json({ success: ok, message: msg });
});

// Animal preset:  { animal: "Chicken"|"Pig"|"Turkey"|"Duck" }
app.post('/api/control/animal', (req, res) => {
  const valid = ['Chicken','Pig','Turkey','Duck'];
  const { animal } = req.body;
  if (!valid.includes(animal))
    return res.status(400).json({ error: `animal must be one of: ${valid.join(', ')}` });
  const ok = publish(T.ctrl_animal, animal);
  res.json({ success: ok, animal });
});

// Factory reset
app.post('/api/control/factory-reset', (_req, res) => {
  const ok = publish(T.ctrl_factory, 'RESET');
  res.json({ success: ok });
});

// Clear server-side history
app.delete('/api/history', (_req, res) => {
  history = [];
  res.json({ success: true });
});

// Health / MQTT status
app.get('/api/health', (_req, res) => res.json({
  status:         'healthy',
  mqtt_connected: mqttClient.connected,
  device_status:  deviceState.status,
  history_points: history.length,
  uptime:         process.uptime(),
  timestamp:      new Date().toISOString(),
}));

// SPA fallback
app.get('*', (_req, res) =>
  res.sendFile(path.join(__dirname, 'public', 'index.html')));

// ── Socket.IO ─────────────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`🔌 Client connected: ${socket.id}`);
  socket.emit('state', deviceState);
  socket.emit('history', history.slice(-200));
  socket.on('disconnect', () => console.log(`🔌 Disconnected: ${socket.id}`));
});

// ── Start ─────────────────────────────────────────────────────────────────────
server.listen(PORT, () => {
  console.log('━'.repeat(50));
  console.log('🐣  Broodinnox Dashboard');
  console.log(`🌐  http://localhost:${PORT}`);
  console.log(`📡  MQTT: ${MQTT_BROKER}`);
  console.log(`🆔  Device: ${DEVICE_ID}`);
  console.log('━'.repeat(50));
});

process.on('SIGTERM', () => {
  server.close(() => { mqttClient.end(); process.exit(0); });
});
