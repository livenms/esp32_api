const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const mqtt = require('mqtt');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

// MQTT Configuration
const MQTT_BROKER = 'mqtt://test.mosquitto.org:1883';
const DEVICE_ID = 'BROODIINNOX-001';

// Topics
const TOPICS = {
    data: `broodinnox/${DEVICE_ID}/data`,
    status: `broodinnox/${DEVICE_ID}/status`,
    relay: `broodinnox/${DEVICE_ID}/control/relay`,
    maxTemp: `broodinnox/${DEVICE_ID}/control/max_temp`,
    minTemp: `broodinnox/${DEVICE_ID}/control/min_temp`,
    totalDays: `broodinnox/${DEVICE_ID}/control/total_days`,
    sensorControl: `broodinnox/${DEVICE_ID}/control/sensor`,
    factoryReset: `broodinnox/${DEVICE_ID}/control/factory_reset`,
    animalPreset: `broodinnox/${DEVICE_ID}/control/animal_preset`
};

// MQTT Client
let mqttClient = null;
let latestData = {
    device_id: DEVICE_ID,
    device_name: "Broodinnox",
    timestamp: null,
    day: 1,
    total_days: 30,
    max_temp: 36,
    min_temp: 32,
    ave_temp: null,
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
    weekly_reduce_enabled: true
};

// Connect to MQTT broker
function connectMQTT() {
    mqttClient = mqtt.connect(MQTT_BROKER);
    
    mqttClient.on('connect', () => {
        console.log('Connected to MQTT broker');
        // Subscribe to topics
        mqttClient.subscribe(TOPICS.data);
        mqttClient.subscribe(TOPICS.status);
        console.log('Subscribed to device topics');
    });
    
    mqttClient.on('message', (topic, message) => {
        try {
            const data = JSON.parse(message.toString());
            
            if (topic === TOPICS.data || topic === TOPICS.status) {
                // Update latest data
                Object.assign(latestData, data);
                
                // Emit to all connected web clients
                io.emit('device_update', latestData);
                console.log('Device update sent to clients', { 
                    timestamp: new Date().toISOString(),
                    avgTemp: latestData.ave_temp 
                });
            }
        } catch (error) {
            console.error('MQTT message parsing error:', error);
        }
    });
    
    mqttClient.on('error', (error) => {
        console.error('MQTT connection error:', error);
        setTimeout(connectMQTT, 5000);
    });
}

// Serve static files
app.use(express.static('public'));
app.use(express.json());

// API endpoints
app.get('/api/latest', (req, res) => {
    res.json(latestData);
});

app.post('/api/control/:command', (req, res) => {
    const { command } = req.params;
    const { value, topic } = req.body;
    
    if (mqttClient && mqttClient.connected) {
        let mqttTopic, payload;
        
        switch(command) {
            case 'relay':
                mqttTopic = TOPICS.relay;
                payload = value;
                break;
            case 'max_temp':
                mqttTopic = TOPICS.maxTemp;
                payload = value.toString();
                break;
            case 'min_temp':
                mqttTopic = TOPICS.minTemp;
                payload = value.toString();
                break;
            case 'total_days':
                mqttTopic = TOPICS.totalDays;
                payload = value.toString();
                break;
            case 'sensor':
                mqttTopic = TOPICS.sensorControl;
                payload = value;
                break;
            case 'animal':
                mqttTopic = TOPICS.animalPreset;
                payload = value;
                break;
            case 'factory_reset':
                mqttTopic = TOPICS.factoryReset;
                payload = 'RESET';
                break;
            default:
                return res.status(400).json({ error: 'Invalid command' });
        }
        
        mqttClient.publish(mqttTopic, payload);
        res.json({ success: true, command, value });
    } else {
        res.status(503).json({ error: 'MQTT not connected' });
    }
});

// Socket.io connection handling
io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);
    
    // Send latest data immediately
    socket.emit('device_update', latestData);
    
    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Dashboard server running on port ${PORT}`);
    connectMQTT();
});
