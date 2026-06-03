const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mqtt = require('mqtt');
const cors = require('cors');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// MQTT Configuration
const MQTT_BROKER = process.env.MQTT_BROKER || 'test.mosquitto.org';
const MQTT_PORT = process.env.MQTT_PORT || 1883;
const DEVICE_ID = process.env.DEVICE_ID || 'BROODIINNOX-001';

// MQTT Topics
const topics = {
  data: `broodinnox/${DEVICE_ID}/data`,
  status: `broodinnox/${DEVICE_ID}/status`,
  relay: `broodinnox/${DEVICE_ID}/control/relay`,
  max_temp: `broodinnox/${DEVICE_ID}/control/max_temp`,
  min_temp: `broodinnox/${DEVICE_ID}/control/min_temp`,
  total_days: `broodinnox/${DEVICE_ID}/control/total_days`,
  sensor_control: `broodinnox/${DEVICE_ID}/control/sensor`,
  factory_reset: `broodinnox/${DEVICE_ID}/control/factory_reset`,
  animal_preset: `broodinnox/${DEVICE_ID}/control/animal_preset`
};

// MQTT Client
const mqttClient = mqtt.connect(`mqtt://${MQTT_BROKER}:${MQTT_PORT}`);

let latestData = {
  device_id: DEVICE_ID,
  day: 0,
  total_days: 30,
  max_temp: 36,
  min_temp: 32,
  ave_temp: 0,
  relay_state: false,
  manual_control: false,
  failsafe_mode: false,
  sensor_error: false,
  mismatch_error: false,
  signal_quality: 0,
  sensor1: null,
  sensor2: null,
  sensor3: null,
  sensor4: null,
  s1_enabled: true,
  s2_enabled: true,
  s3_enabled: true,
  s4_enabled: true,
  timestamp: null,
  error: "",
  connected: false
};

// MQTT Connection
mqttClient.on('connect', () => {
  console.log('Connected to MQTT broker');
  
  // Subscribe to topics
  mqttClient.subscribe(topics.data);
  mqttClient.subscribe(topics.status);
  
  console.log('Subscribed to:', topics.data);
  console.log('Subscribed to:', topics.status);
  
  latestData.connected = true;
  io.emit('connection_status', { connected: true });
});

mqttClient.on('message', (topic, message) => {
  const payload = message.toString();
  console.log(`Received on ${topic}:`, payload);
  
  try {
    const data = JSON.parse(payload);
    
    if (topic === topics.data) {
      latestData = { ...latestData, ...data };
      latestData.timestamp = new Date();
      io.emit('sensor_data', latestData);
    } else if (topic === topics.status) {
      io.emit('status_update', data);
    }
  } catch (error) {
    console.error('Error parsing MQTT message:', error);
  }
});

mqttClient.on('error', (error) => {
  console.error('MQTT Error:', error);
  latestData.connected = false;
  io.emit('connection_status', { connected: false });
});

// API Routes
app.get('/api/status', (req, res) => {
  res.json({
    connected: latestData.connected,
    device_id: DEVICE_ID,
    last_update: latestData.timestamp
  });
});

app.get('/api/data', (req, res) => {
  res.json(latestData);
});

app.post('/api/control/relay', (req, res) => {
  const { state } = req.body;
  if (state === 'ON' || state === 'OFF' || state === 'AUTO') {
    mqttClient.publish(topics.relay, state);
    res.json({ success: true, state });
  } else {
    res.status(400).json({ error: 'Invalid state' });
  }
});

app.post('/api/control/max_temp', (req, res) => {
  const { value } = req.body;
  const temp = parseInt(value);
  if (temp >= 20 && temp <= 50) {
    mqttClient.publish(topics.max_temp, temp.toString());
    res.json({ success: true, max_temp: temp });
  } else {
    res.status(400).json({ error: 'Invalid temperature' });
  }
});

app.post('/api/control/min_temp', (req, res) => {
  const { value } = req.body;
  const temp = parseInt(value);
  if (temp >= 10 && temp <= 49) {
    mqttClient.publish(topics.min_temp, temp.toString());
    res.json({ success: true, min_temp: temp });
  } else {
    res.status(400).json({ error: 'Invalid temperature' });
  }
});

app.post('/api/control/total_days', (req, res) => {
  const { value } = req.body;
  const days = parseInt(value);
  if (days >= 1 && days <= 365) {
    mqttClient.publish(topics.total_days, days.toString());
    res.json({ success: true, total_days: days });
  } else {
    res.status(400).json({ error: 'Invalid days' });
  }
});

app.post('/api/control/sensor', (req, res) => {
  const { sensor, enabled } = req.body;
  if (sensor >= 1 && sensor <= 4) {
    const command = `DS${sensor}:${enabled ? 'ON' : 'OFF'}`;
    mqttClient.publish(topics.sensor_control, command);
    res.json({ success: true, sensor, enabled });
  } else {
    res.status(400).json({ error: 'Invalid sensor' });
  }
});

app.post('/api/control/animal_preset', (req, res) => {
  const { animal } = req.body;
  const validAnimals = ['Chicken', 'Pig', 'Turkey', 'Duck'];
  if (validAnimals.includes(animal)) {
    mqttClient.publish(topics.animal_preset, animal);
    res.json({ success: true, animal });
  } else {
    res.status(400).json({ error: 'Invalid animal' });
  }
});

app.post('/api/control/factory_reset', (req, res) => {
  mqttClient.publish(topics.factory_reset, 'RESET');
  res.json({ success: true, message: 'Factory reset command sent' });
});

// Socket.io connection
io.on('connection', (socket) => {
  console.log('New client connected');
  socket.emit('sensor_data', latestData);
  socket.emit('connection_status', { connected: latestData.connected });
  
  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Device ID: ${DEVICE_ID}`);
  console.log(`MQTT Broker: ${MQTT_BROKER}`);
});
