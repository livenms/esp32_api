// MQTT Configuration - Updated for mosquito.test
const MQTT_BROKER = process.env.MQTT_BROKER || 'mqtt://mosquito.test';
const MQTT_PORT = process.env.MQTT_PORT || 1883;

// MQTT Client with mosquito.test configuration
const mqttClient = mqtt.connect(MQTT_BROKER, {
    port: MQTT_PORT,
    clientId: `broodinnox_server_${Math.random().toString(16).substr(2, 8)}`,
    keepalive: 60,
    reconnectPeriod: 1000,
    connectTimeout: 30 * 1000,
    // Add these if your broker requires authentication
    // username: process.env.MQTT_USERNAME,
    // password: process.env.MQTT_PASSWORD
});

const MQTT_TOPICS = {
    data: 'broodinnox/data',
    relay: 'broodinnox/control/relay',
    max_temp: 'broodinnox/control/max_temp',
    min_temp: 'broodinnox/control/min_temp',
    total_days: 'broodinnox/control/total_days',
    sensor: 'broodinnox/control/sensor',
    status: 'broodinnox/status',
    // Additional topics for mosquito.test
    telemetry: 'broodinnox/telemetry',
    command: 'broodinnox/command'
};

// Connection events
mqttClient.on('connect', () => {
    console.log('✅ Connected to Mosquito MQTT Broker (mosquito.test)');
    
    // Subscribe to all topics
    Object.values(MQTT_TOPICS).forEach(topic => {
        mqttClient.subscribe(topic, { qos: 1 }, (err) => {
            if (!err) {
                console.log(`📡 Subscribed to: ${topic}`);
            } else {
                console.error(`❌ Failed to subscribe to ${topic}:`, err);
            }
        });
    });
    
    // Publish online status
    mqttClient.publish('broodinnox/status', JSON.stringify({
        server: 'online',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    }), { qos: 1, retain: true });
});

mqttClient.on('error', (err) => {
    console.error('❌ MQTT Connection Error:', err);
});

mqttClient.on('reconnect', () => {
    console.log('🔄 Reconnecting to Mosquito broker...');
});

mqttClient.on('offline', () => {
    console.log('📡 MQTT Client offline');
});
