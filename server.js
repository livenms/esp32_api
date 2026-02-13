const express = require('express');
const mqtt = require('mqtt');
const cors = require('cors');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;
const MQTT_BROKER = process.env.MQTT_BROKER || 'mqtt://test.mosquitto.org';
const DEVICE_ID = process.env.DEVICE_ID || 'BROODIINNOX-001';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// In-memory storage for device data
let deviceData = {
  device_id: DEVICE_ID,
  device_name: 'Broodinnox',
  temperature: 0,
  cycle_day: 0,
  total_days: 30,
  max_temp: 36,
  min_temp: 32,
  relay_status: 'OFF',
  relay_mode: 'AUTO',
  error: 'OK',
  weekly_reduce_enabled: true,
  mode: 'OFFLINE',
  animal_type: 'Chicken',
  sensors: {
    temp1: 'N/A',
    temp2: 'N/A',
    temp3: 'N/A',
    temp4: 'N/A',
    s1_active: true,
    s2_active: true,
    s3_active: true,
    s4_active: true
  },
  timestamp: Date.now(),
  lastSeen: null,
  status: 'offline'
};

let historicalData = [];
const MAX_HISTORY = 1000; // Store last 1000 readings

// MQTT Client Setup
const mqttClient = mqtt.connect(MQTT_BROKER, {
  clientId: `broodinnox-dashboard-${Math.random().toString(16).slice(3)}`,
  clean: true,
  connectTimeout: 4000,
  reconnectPeriod: 1000,
});

// MQTT Topics
const topics = {
  data: `broodinnox/${DEVICE_ID}/data`,
  status: `broodinnox/${DEVICE_ID}/status`,
  discovery: `broodinnox/${DEVICE_ID}/discovery`,
  control_relay: `broodinnox/${DEVICE_ID}/control/relay`,
  control_max_temp: `broodinnox/${DEVICE_ID}/control/max_temp`,
  control_min_temp: `broodinnox/${DEVICE_ID}/control/min_temp`,
  control_total_days: `broodinnox/${DEVICE_ID}/control/total_days`,
  control_sensor: `broodinnox/${DEVICE_ID}/control/sensor`,
  control_weekly_reduce: `broodinnox/${DEVICE_ID}/control/weekly_reduce`,
  control_reduce_now: `broodinnox/${DEVICE_ID}/control/reduce_now`,
  control_mode: `broodinnox/${DEVICE_ID}/control/mode`
};

// MQTT Event Handlers
mqttClient.on('connect', () => {
  console.log('✅ Connected to MQTT broker:', MQTT_BROKER);
  console.log('🆔 Device ID:', DEVICE_ID);
  
  // Subscribe to all topics
  Object.values(topics).forEach(topic => {
    mqttClient.subscribe(topic, (err) => {
      if (err) {
        console.error(`❌ Failed to subscribe to ${topic}:`, err);
      } else {
        console.log(`📡 Subscribed to: ${topic}`);
      }
    });
  });
  
  // Request device discovery
  mqttClient.publish(topics.discovery, JSON.stringify({ request: 'info' }));
});

mqttClient.on('message', (topic, message) => {
  try {
    const data = JSON.parse(message.toString());
    console.log(`📨 MQTT Message [${topic}]:`, data);
    
    if (topic === topics.data) {
      // Update device data
      deviceData = {
        ...deviceData,
        ...data,
        lastSeen: new Date().toISOString(),
        status: 'online'
      };
      
      // Store in history
      historicalData.push({
        timestamp: data.timestamp || Date.now(),
        temperature: data.temperature,
        cycle_day: data.cycle_day,
        relay_status: data.relay_status
      });
      
      // Trim history if too large
      if (historicalData.length > MAX_HISTORY) {
        historicalData = historicalData.slice(-MAX_HISTORY);
      }
      
      // Broadcast to all connected clients
      io.emit('deviceUpdate', deviceData);
      
    } else if (topic === topics.status) {
      deviceData.status = data.status || 'offline';
      deviceData.mode = data.mode || deviceData.mode;
      deviceData.lastSeen = new Date().toISOString();
      io.emit('deviceUpdate', deviceData);
      
    } else if (topic === topics.discovery) {
      console.log('🔍 Device Discovery:', data);
      deviceData = { ...deviceData, ...data };
      io.emit('deviceUpdate', deviceData);
    }
    
  } catch (error) {
    console.error('❌ Error parsing MQTT message:', error);
  }
});

mqttClient.on('error', (error) => {
  console.error('❌ MQTT Error:', error);
});

mqttClient.on('offline', () => {
  console.log('⚠️ MQTT Client offline');
});

mqttClient.on('reconnect', () => {
  console.log('🔄 Reconnecting to MQTT broker...');
});

// Socket.IO for real-time updates
io.on('connection', (socket) => {
  console.log('🔌 Client connected:', socket.id);
  
  // Send current device data immediately
  socket.emit('deviceUpdate', deviceData);
  socket.emit('historicalData', historicalData);
  
  socket.on('disconnect', () => {
    console.log('🔌 Client disconnected:', socket.id);
  });
});

// REST API Endpoints

// Get current device data
app.get('/api/device', (req, res) => {
  res.json(deviceData);
});

// Get historical data
app.get('/api/history', (req, res) => {
  const limit = parseInt(req.query.limit) || 100;
  res.json(historicalData.slice(-limit));
});

// Control endpoints
app.post('/api/control/relay', (req, res) => {
  const { command } = req.body; // ON, OFF, or AUTO
  if (!['ON', 'OFF', 'AUTO'].includes(command)) {
    return res.status(400).json({ error: 'Invalid command. Use ON, OFF, or AUTO' });
  }
  
  mqttClient.publish(topics.control_relay, command);
  res.json({ success: true, command, topic: topics.control_relay });
});

app.post('/api/control/temperature', (req, res) => {
  const { max_temp, min_temp } = req.body;
  
  if (max_temp !== undefined) {
    mqttClient.publish(topics.control_max_temp, max_temp.toString());
  }
  
  if (min_temp !== undefined) {
    mqttClient.publish(topics.control_min_temp, min_temp.toString());
  }
  
  res.json({ success: true, max_temp, min_temp });
});

app.post('/api/control/total-days', (req, res) => {
  const { total_days } = req.body;
  
  if (!total_days || total_days < 1 || total_days > 365) {
    return res.status(400).json({ error: 'Invalid total_days. Must be between 1 and 365' });
  }
  
  mqttClient.publish(topics.control_total_days, total_days.toString());
  res.json({ success: true, total_days });
});

app.post('/api/control/sensor', (req, res) => {
  const { sensor, state } = req.body; // sensor: 1-4, state: ON/OFF
  
  if (!sensor || sensor < 1 || sensor > 4) {
    return res.status(400).json({ error: 'Invalid sensor number. Use 1-4' });
  }
  
  if (!['ON', 'OFF'].includes(state)) {
    return res.status(400).json({ error: 'Invalid state. Use ON or OFF' });
  }
  
  const message = `${sensor}:${state}`;
  mqttClient.publish(topics.control_sensor, message);
  res.json({ success: true, sensor, state });
});

app.post('/api/control/weekly-reduce', (req, res) => {
  const { enabled } = req.body;
  const command = enabled ? 'ON' : 'OFF';
  
  mqttClient.publish(topics.control_weekly_reduce, command);
  res.json({ success: true, enabled });
});

app.post('/api/control/reduce-now', (req, res) => {
  mqttClient.publish(topics.control_reduce_now, 'NOW');
  res.json({ success: true, message: 'Temperature reduction triggered' });
});

app.post('/api/control/mode', (req, res) => {
  const { mode } = req.body; // ONLINE or OFFLINE
  
  if (!['ONLINE', 'OFFLINE'].includes(mode)) {
    return res.status(400).json({ error: 'Invalid mode. Use ONLINE or OFFLINE' });
  }
  
  mqttClient.publish(topics.control_mode, mode);
  res.json({ success: true, mode });
});

// Clear historical data
app.delete('/api/history', (req, res) => {
  historicalData = [];
  res.json({ success: true, message: 'Historical data cleared' });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    mqtt_connected: mqttClient.connected,
    device_status: deviceData.status,
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// Serve frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
server.listen(PORT, () => {
  console.log('🚀 Broodinnox Dashboard Server Started');
  console.log(`📊 Dashboard: http://localhost:${PORT}`);
  console.log(`🔌 WebSocket: ws://localhost:${PORT}`);
  console.log(`📡 MQTT Broker: ${MQTT_BROKER}`);
  console.log(`🆔 Device ID: ${DEVICE_ID}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('⚠️ SIGTERM received, shutting down gracefully...');
  server.close(() => {
    mqttClient.end();
    console.log('✅ Server closed');
    process.exit(0);
  });
});
