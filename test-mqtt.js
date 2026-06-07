// test-mqtt.js - Test Mosquito MQTT Connection
const mqtt = require('mqtt');
require('dotenv').config();

const MQTT_BROKER = process.env.MQTT_BROKER || 'mqtt://mosquito.test';
const MQTT_PORT = process.env.MQTT_PORT || 1883;

console.log(`Testing connection to: ${MQTT_BROKER}:${MQTT_PORT}`);

const client = mqtt.connect(MQTT_BROKER, {
    port: MQTT_PORT,
    clientId: `test_client_${Math.random().toString(16).substr(2, 8)}`,
    connectTimeout: 10000
});

client.on('connect', () => {
    console.log('✅ Successfully connected to Mosquito broker!');
    
    // Test publish
    const testTopic = 'broodinnox/test';
    client.publish(testTopic, JSON.stringify({
        message: 'Connection test',
        timestamp: new Date().toISOString()
    }), { qos: 1 }, (err) => {
        if (!err) {
            console.log(`📤 Test message published to ${testTopic}`);
        }
    });
    
    // Test subscribe
    client.subscribe('broodinnox/+/status', { qos: 1 }, (err) => {
        if (!err) {
            console.log('📡 Subscribed to broodinnox topics');
        }
    });
    
    setTimeout(() => {
        client.end();
        console.log('Test completed');
        process.exit(0);
    }, 2000);
});

client.on('error', (err) => {
    console.error('❌ Connection error:', err.message);
    console.log('\nTroubleshooting tips:');
    console.log('1. Check if mosquito.test is reachable');
    console.log('2. Verify the broker address is correct');
    console.log('3. Check if port 1883 is open');
    console.log('4. Try using IP address instead of hostname');
    process.exit(1);
});

client.on('close', () => {
    console.log('Connection closed');
});
