const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mqtt = require('mqtt');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
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
app.use(helmet({
  contentSecurityPolicy: false,
}));
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Real device storage (only devices that send MQTT data)
const devicesStore = new Map();

// MQTT Client - Mosquito Test Broker
const MQTT_BROKER = process.env.MQTT_BROKER || 'mqtt://test.mosquitto.org';
const mqttClient = mqtt.connect(MQTT_BROKER, {
  port: 1883,
  keepalive: 60,
  reconnectPeriod: 1000
});

mqttClient.on('connect', () => {
  console.log('✅ Connected to Mosquito MQTT broker');
  mqttClient.subscribe('broodinnox/+/data');
  mqttClient.subscribe('broodinnox/+/status');
  mqttClient.subscribe('broodinnox/+/telemetry');
  console.log('📡 Subscribed to broodinnox/# topics - Waiting for real device data...');
});

mqttClient.on('error', (error) => {
  console.error('❌ MQTT connection error:', error.message);
});

mqttClient.on('message', (topic, message) => {
  const parts = topic.split('/');
  const deviceId = parts[1];
  const messageType = parts[2];
  
  try {
    const data = JSON.parse(message.toString());
    console.log(`📨 [REAL DATA] Received from ${deviceId} on ${messageType}:`, data);
    
    if (messageType === 'data' || messageType === 'telemetry') {
      // Update or create device in store with REAL data
      const existingDevice = devicesStore.get(deviceId) || {
        id: deviceId,
        name: deviceId,
        first_seen: new Date(),
        is_online: true
      };
      
      const updatedDevice = {
        ...existingDevice,
        id: deviceId,
        name: data.device_name || data.name || deviceId,
        is_online: true,
        last_update: new Date(),
        avg_temp: data.avgTemp || data.avg_temp || data.average_temperature,
        sensor1: data.sensor1 || data.temp1,
        sensor2: data.sensor2 || data.temp2,
        sensor3: data.sensor3 || data.temp3,
        sensor4: data.sensor4 || data.temp4,
        relay_state: data.relayState || data.relay_state || data.relay,
        relay_mode: data.relayMode || data.relay_mode || data.mode,
        current_day: data.currentDay || data.current_day || data.day,
        total_days: data.totalDays || data.total_days || data.total_days,
        max_temp: data.maxTemp || data.max_temp || data.max_temperature,
        min_temp: data.minTemp || data.min_temp || data.min_temperature,
        signal_quality: data.signalQuality || data.signal_quality || data.rssi || data.signal,
        sensor_error: data.sensorError || data.sensor_error || false,
        mismatch_error: data.mismatchError || data.mismatch_error || false,
        failsafe: data.failsafe || false,
        is_locked: data.isLocked || data.is_locked || false,
        // Store all raw data for debugging
        raw_data: data
      };
      
      devicesStore.set(deviceId, updatedDevice);
      console.log(`✅ Device ${deviceId} updated with REAL data - Temp: ${updatedDevice.avg_temp}°C`);
      
      // Emit real-time update to all connected clients
      io.emit('device_update', { deviceId, ...updatedDevice });
      
      // Check for alerts based on real data
      checkAndSendAlerts(deviceId, updatedDevice);
      
    } else if (messageType === 'status') {
      const existingDevice = devicesStore.get(deviceId);
      if (existingDevice) {
        existingDevice.is_online = data.online === true || data.online === 'true';
        existingDevice.is_locked = data.locked === true || data.locked === 'true';
        existingDevice.last_status = new Date();
        devicesStore.set(deviceId, existingDevice);
        
        io.emit('status_update', { 
          deviceId, 
          online: existingDevice.is_online, 
          locked: existingDevice.is_locked 
        });
        console.log(`📊 Device ${deviceId} status: ${existingDevice.is_online ? 'ONLINE' : 'OFFLINE'}`);
      }
    }
  } catch (error) {
    console.error('❌ Error parsing MQTT message:', error.message);
  }
});

// Check for offline devices (no data for 60 seconds)
setInterval(() => {
  const now = new Date();
  for (let [deviceId, device] of devicesStore) {
    if (device.last_update && (now - device.last_update) > 60000) {
      if (device.is_online !== false) {
        device.is_online = false;
        devicesStore.set(deviceId, device);
        io.emit('status_update', { deviceId, online: false });
        console.log(`⚠️ Device ${deviceId} went OFFLINE (no data for 60s)`);
        
        // Send offline alert
        io.emit('new_alert', { 
          deviceId, 
          type: 'device_offline', 
          severity: 'high', 
          message: `Device ${device.name || deviceId} is offline - No data received` 
        });
      }
    }
  }
}, 10000);

// Function to check and send alerts based on real data
function checkAndSendAlerts(deviceId, device) {
  const alerts = [];
  
  // Temperature alerts
  if (device.avg_temp > 0) {
    if (device.avg_temp > device.max_temp) {
      alerts.push({ 
        type: 'high_temp', 
        severity: 'high', 
        message: `⚠️ HIGH TEMP: ${device.avg_temp}°C exceeds maximum ${device.max_temp}°C` 
      });
    }
    if (device.avg_temp < device.min_temp) {
      alerts.push({ 
        type: 'low_temp', 
        severity: 'high', 
        message: `⚠️ LOW TEMP: ${device.avg_temp}°C below minimum ${device.min_temp}°C` 
      });
    }
  }
  
  // Sensor errors
  if (device.sensor_error) {
    alerts.push({ 
      type: 'sensor_error', 
      severity: 'critical', 
      message: `🔴 SENSOR FAILURE: One or more sensors not responding` 
    });
  }
  
  // Mismatch error
  if (device.mismatch_error) {
    alerts.push({ 
      type: 'mismatch_error', 
      severity: 'high', 
      message: `🔄 SENSOR MISMATCH: Temperature variation between sensors is too high` 
    });
  }
  
  // Failsafe mode
  if (device.failsafe) {
    alerts.push({ 
      type: 'failsafe_mode', 
      severity: 'critical', 
      message: `🛡️ FAILSAFE ACTIVE: Device operating in emergency mode` 
    });
  }
  
  // Signal quality alerts
  if (device.signal_quality > 0 && device.signal_quality < 25) {
    alerts.push({ 
      type: 'weak_signal', 
      severity: 'medium', 
      message: `📡 WEAK SIGNAL: Signal quality at ${device.signal_quality}%` 
    });
  }
  
  // Send each alert
  alerts.forEach(alert => {
    console.log(`🔔 ALERT [${deviceId}]: ${alert.message}`);
    io.emit('new_alert', { deviceId, ...alert });
  });
}

// API Routes - Only show real devices that have sent data
app.get('/api/devices', (req, res) => {
  try {
    const devices = Array.from(devicesStore.values());
    console.log(`📋 Returning ${devices.length} real devices`);
    res.json(devices);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch devices' });
  }
});

app.get('/api/devices/:deviceId', (req, res) => {
  try {
    const device = devicesStore.get(req.params.deviceId);
    if (!device) {
      return res.status(404).json({ error: 'Device not found - No data received yet' });
    }
    res.json(device);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch device' });
  }
});

// Send command to real device via MQTT
app.post('/api/devices/:deviceId/control/:command', (req, res) => {
  try {
    const { deviceId, command } = req.params;
    const { value } = req.body;
    
    // Check if device exists
    if (!devicesStore.has(deviceId)) {
      return res.status(404).json({ error: 'Device not found' });
    }
    
    const topic = `broodinnox/${deviceId}/control/${command}`;
    let payload = value;
    
    // Handle different command types
    if (command === 'relay') {
      payload = { state: value };
    } else if (command === 'max_temp' || command === 'min_temp') {
      payload = { temperature: parseFloat(value) };
    } else if (command === 'total_days') {
      payload = { days: parseInt(value) };
    } else if (command === 'animal_preset') {
      const presets = { 
        Chicken: { temp: 35, humidity: 60 },
        Pig: { temp: 32, humidity: 65 },
        Turkey: { temp: 33, humidity: 55 },
        Duck: { temp: 31, humidity: 70 }
      };
      payload = { preset: value, ...presets[value] };
    } else if (command === 'sensor') {
      payload = { command: value };
    } else if (command === 'factory_reset') {
      payload = { reset: true };
    } else if (command === 'device_active') {
      payload = { active: value === 'ACTIVE' };
    }
    
    // Publish to MQTT
    mqttClient.publish(topic, JSON.stringify(payload), (error) => {
      if (error) {
        console.error('❌ MQTT publish error:', error);
        return res.status(500).json({ error: 'Failed to send command via MQTT' });
      }
      console.log(`📤 Command sent to ${deviceId} on ${topic}:`, payload);
      res.json({ success: true, message: `Command ${command} sent to device` });
    });
    
  } catch (error) {
    console.error('Command error:', error);
    res.status(500).json({ error: 'Failed to send command' });
  }
});

// Get device temperature history (from memory)
const temperatureHistory = new Map();

// Store temperature readings for history
setInterval(() => {
  for (let [deviceId, device] of devicesStore) {
    if (device.avg_temp > 0) {
      if (!temperatureHistory.has(deviceId)) {
        temperatureHistory.set(deviceId, []);
      }
      const history = temperatureHistory.get(deviceId);
      history.push({
        timestamp: new Date(),
        avg_temp: device.avg_temp,
        sensor1: device.sensor1,
        sensor2: device.sensor2,
        sensor3: device.sensor3,
        sensor4: device.sensor4,
        relay_state: device.relay_state
      });
      
      // Keep last 1000 readings
      if (history.length > 1000) {
        history.shift();
      }
    }
  }
}, 5000);

app.get('/api/devices/:deviceId/history', (req, res) => {
  try {
    const { period } = req.query;
    let history = temperatureHistory.get(req.params.deviceId) || [];
    
    // Filter by period
    const now = new Date();
    let cutoffTime = new Date();
    
    switch(period) {
      case '24h':
        cutoffTime.setHours(now.getHours() - 24);
        break;
      case '7d':
        cutoffTime.setDate(now.getDate() - 7);
        break;
      case '30d':
        cutoffTime.setDate(now.getDate() - 30);
        break;
      default:
        cutoffTime.setHours(now.getHours() - 24);
    }
    
    const filtered = history.filter(h => new Date(h.timestamp) > cutoffTime);
    res.json(filtered);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

// WebSocket connections
io.on('connection', (socket) => {
  console.log('🔌 Web client connected');
  
  // Send current device list to new client
  const devices = Array.from(devicesStore.values());
  socket.emit('devices_list', devices);
  
  socket.on('subscribe_device', (deviceId) => {
    socket.join(`device_${deviceId}`);
    console.log(`📱 Client subscribed to device ${deviceId}`);
  });
  
  socket.on('disconnect', () => {
    console.log('🔌 Web client disconnected');
  });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`\n🚀 Broodinnox Dashboard Server Running`);
  console.log(`========================================`);
  console.log(`📡 Web Dashboard: http://localhost:${PORT}`);
  console.log(`🔌 MQTT Broker: ${MQTT_BROKER}`);
  console.log(`📡 Waiting for REAL device data on topics:`);
  console.log(`   - broodinnox/{DEVICE_ID}/data`);
  console.log(`   - broodinnox/{DEVICE_ID}/status`);
  console.log(`   - broodinnox/{DEVICE_ID}/telemetry`);
  console.log(`\n💡 Make sure your ESP32 devices are publishing to these topics`);
  console.log(`========================================\n`);
});
