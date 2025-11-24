const express = require('express');
const mqtt = require('mqtt');
const WebSocket = require('ws');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// MQTT Configuration
const MQTT_CONFIG = {
    broker: 'broker.hivemq.com',
    port: 1883,
    topics: {
        data: 'broodinnox/data',
        relay: 'broodinnox/control/relay',
        maxTemp: 'broodinnox/control/max_temp',
        minTemp: 'broodinnox/control/min_temp',
        totalDays: 'broodinnox/control/total_days',
        sensorControl: 'broodinnox/control/sensor',
        weeklyReduce: 'broodinnox/control/weekly_reduce',
        reduceNow: 'broodinnox/control/reduce_now',
        mode: 'broodinnox/control/mode'
    }
};

// Store connected clients and latest data
const clients = new Set();
let latestData = null;
let mqttClient = null;

// Initialize MQTT connection
function connectMQTT() {
    try {
        mqttClient = mqtt.connect(`mqtt://${MQTT_CONFIG.broker}:${MQTT_CONFIG.port}`, {
            clientId: 'broodinnox_server_' + Math.random().toString(16).substr(2, 8),
            clean: true,
            connectTimeout: 4000,
            reconnectPeriod: 1000,
        });

        mqttClient.on('connect', () => {
            console.log('✅ Connected to MQTT broker');
            
            // Subscribe to all topics
            Object.values(MQTT_CONFIG.topics).forEach(topic => {
                mqttClient.subscribe(topic, (err) => {
                    if (!err) {
                        console.log(`✅ Subscribed to ${topic}`);
                    } else {
                        console.error(`❌ Failed to subscribe to ${topic}:`, err);
                    }
                });
            });
        });

        mqttClient.on('message', (topic, message) => {
            const payload = message.toString();
            console.log(`📨 MQTT Message [${topic}]: ${payload}`);
            
            // Store data from the main data topic
            if (topic === MQTT_CONFIG.topics.data) {
                try {
                    latestData = JSON.parse(payload);
                    // Broadcast to all WebSocket clients
                    broadcastToClients({
                        type: 'data',
                        data: latestData,
                        timestamp: new Date().toISOString()
                    });
                } catch (error) {
                    console.error('Error parsing MQTT data:', error);
                }
            }
        });

        mqttClient.on('error', (error) => {
            console.error('❌ MQTT Error:', error);
        });

        mqttClient.on('close', () => {
            console.log('🔌 MQTT connection closed');
        });

        mqttClient.on('reconnect', () => {
            console.log('🔄 Reconnecting to MQTT...');
        });

    } catch (error) {
        console.error('Failed to initialize MQTT:', error);
        // Retry connection after 5 seconds
        setTimeout(connectMQTT, 5000);
    }
}

// WebSocket server for real-time updates
const wss = new WebSocket.Server({ noServer: true });

wss.on('connection', (ws) => {
    console.log('✅ New WebSocket connection');
    clients.add(ws);

    // Send latest data to new client
    if (latestData) {
        ws.send(JSON.stringify({
            type: 'data',
            data: latestData,
            timestamp: new Date().toISOString()
        }));
    }

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            handleClientMessage(data, ws);
        } catch (error) {
            console.error('Error parsing client message:', error);
        }
    });

    ws.on('close', () => {
        console.log('🔌 WebSocket connection closed');
        clients.delete(ws);
    });

    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        clients.delete(ws);
    });
});

// Handle messages from clients
function handleClientMessage(message, ws) {
    if (message.type === 'control' && mqttClient && mqttClient.connected) {
        const { topic, value } = message;
        
        if (Object.values(MQTT_CONFIG.topics).includes(topic)) {
            mqttClient.publish(topic, value.toString(), (err) => {
                if (err) {
                    console.error('Failed to publish MQTT message:', err);
                    ws.send(JSON.stringify({
                        type: 'error',
                        message: 'Failed to send command'
                    }));
                } else {
                    console.log(`📤 Published to ${topic}: ${value}`);
                    ws.send(JSON.stringify({
                        type: 'success',
                        message: 'Command sent successfully'
                    }));
                }
            });
        }
    }
}

// Broadcast data to all connected clients
function broadcastToClients(data) {
    const message = JSON.stringify(data);
    clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
}

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        mqtt: mqttClient ? mqttClient.connected : false,
        clients: clients.size,
        timestamp: new Date().toISOString()
    });
});

app.get('/api/data', (req, res) => {
    res.json({
        data: latestData,
        timestamp: new Date().toISOString()
    });
});

// Start server
const server = app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📱 Dashboard available at: http://localhost:${PORT}`);
    connectMQTT();
});

// Handle WebSocket upgrades
server.on('upgrade', (request, socket, head) => {
    wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
    });
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('🛑 Shutting down gracefully...');
    
    // Close MQTT connection
    if (mqttClient) {
        mqttClient.end();
    }
    
    // Close WebSocket connections
    clients.forEach(client => client.close());
    wss.close();
    
    // Close HTTP server
    server.close(() => {
        console.log('✅ Server shut down');
        process.exit(0);
    });
});
