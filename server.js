const express = require('express');
const session = require('express-session');
const sqlite3 = require('sqlite3').verbose();
const mqtt = require('mqtt');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'broodinnox-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000
    }
}));

// Database setup
const db = new sqlite3.Database(process.env.DATABASE_PATH || './database/broodinnox.db');

// Initialize database tables
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        email TEXT,
        role TEXT DEFAULT 'user',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_login DATETIME
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS temperature_data (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        device_id TEXT,
        temperature REAL,
        humidity REAL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS device_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        device_id TEXT UNIQUE,
        max_temp REAL DEFAULT 36,
        min_temp REAL DEFAULT 32,
        total_days INTEGER DEFAULT 30,
        relay_mode TEXT DEFAULT 'AUTO',
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS alerts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        device_id TEXT,
        alert_type TEXT,
        message TEXT,
        severity TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        resolved BOOLEAN DEFAULT 0
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS system_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        action TEXT,
        ip_address TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Insert default admin user
    const adminPassword = bcrypt.hashSync('admin123', 10);
    db.run(`INSERT OR IGNORE INTO users (username, password, email, role) 
            VALUES (?, ?, ?, ?)`, 
            ['admin', adminPassword, 'admin@broodinnox.com', 'admin']);

    // Insert default device settings
    db.run(`INSERT OR IGNORE INTO device_settings (device_id, max_temp, min_temp, total_days) 
            VALUES (?, ?, ?, ?)`, 
            ['broodinnox_001', 36, 32, 30]);
});

// MQTT Configuration for Mosquito Test
const MQTT_BROKER = process.env.MQTT_BROKER || 'mqtt://mosquito.test';
const MQTT_PORT = process.env.MQTT_PORT || 1883;

console.log(`Connecting to MQTT broker: ${MQTT_BROKER}:${MQTT_PORT}`);

const mqttClient = mqtt.connect(MQTT_BROKER, {
    port: MQTT_PORT,
    clientId: `broodinnox_server_${Math.random().toString(16).substr(2, 8)}`,
    keepalive: 60,
    reconnectPeriod: 1000,
    connectTimeout: 30 * 1000,
    // Uncomment if authentication is required
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
    telemetry: 'broodinnox/telemetry',
    command: 'broodinnox/command'
};

// Device status storage
let deviceStatus = {
    online: false,
    temperature: 0,
    humidity: 0,
    cycle_day: 0,
    total_days: 30,
    max_temp: 36,
    min_temp: 32,
    relay_status: 'OFF',
    relay_mode: 'AUTO',
    last_update: null,
    sensors: {
        temp1: 'N/A',
        temp2: 'N/A',
        temp3: 'N/A',
        temp4: 'N/A',
        s1_active: false,
        s2_active: false,
        s3_active: false,
        s4_active: false
    }
};

// MQTT Connection events
mqttClient.on('connect', () => {
    console.log('✅ Connected to Mosquito MQTT Broker');
    
    // Subscribe to all topics
    Object.values(MQTT_TOPICS).forEach(topic => {
        mqttClient.subscribe(topic, { qos: 1 }, (err) => {
            if (!err) {
                console.log(`📡 Subscribed to: ${topic}`);
            }
        });
    });
    
    // Publish server status
    mqttClient.publish('broodinnox/server/status', JSON.stringify({
        status: 'online',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    }));
});

mqttClient.on('error', (err) => {
    console.error('❌ MQTT Error:', err.message);
});

mqttClient.on('reconnect', () => {
    console.log('🔄 Reconnecting to Mosquito broker...');
});

mqttClient.on('offline', () => {
    console.log('📡 MQTT Client offline');
});

// MQTT Message handler
mqttClient.on('message', (topic, message) => {
    const payload = message.toString();
    console.log(`📨 Message received on ${topic}:`, payload);
    
    try {
        const data = JSON.parse(payload);
        
        switch(topic) {
            case MQTT_TOPICS.data:
                processDeviceData(data);
                break;
            case MQTT_TOPICS.status:
                handleDeviceStatus(data);
                break;
            case MQTT_TOPICS.telemetry:
                handleTelemetry(data);
                break;
            default:
                console.log(`Unhandled topic: ${topic}`);
        }
    } catch (error) {
        console.error('Error parsing MQTT message:', error);
    }
});

function processDeviceData(data) {
    // Update device status
    deviceStatus = {
        ...deviceStatus,
        online: true,
        temperature: data.temperature || data.temp || 0,
        humidity: data.humidity || 0,
        cycle_day: data.cycle_day || data.day || 0,
        total_days: data.total_days || deviceStatus.total_days,
        max_temp: data.max_temp || deviceStatus.max_temp,
        min_temp: data.min_temp || deviceStatus.min_temp,
        relay_status: data.relay_status || data.heater || 'OFF',
        relay_mode: data.relay_mode || 'AUTO',
        last_update: new Date().toISOString(),
        sensors: data.sensors || deviceStatus.sensors
    };
    
    // Store in database
    if (deviceStatus.temperature) {
        db.run(`INSERT INTO temperature_data (device_id, temperature, humidity) 
                VALUES (?, ?, ?)`,
                ['broodinnox_001', deviceStatus.temperature, deviceStatus.humidity]);
    }
    
    // Check for alerts
    checkAlerts(deviceStatus);
    
    // Emit real-time update
    io.emit('device_update', deviceStatus);
}

function handleDeviceStatus(data) {
    console.log('Device status update:', data);
    deviceStatus.online = data.status === 'online';
    io.emit('device_status', data);
}

function handleTelemetry(data) {
    console.log('Telemetry data:', data);
    // Process additional telemetry data
    io.emit('telemetry', data);
}

function checkAlerts(data) {
    const alerts = [];
    
    if (data.temperature > data.max_temp + 2) {
        alerts.push({
            type: 'HIGH_TEMP',
            message: `Temperature ${data.temperature}°C exceeds max ${data.max_temp}°C`,
            severity: 'warning'
        });
    } else if (data.temperature < data.min_temp - 2 && data.temperature > 0) {
        alerts.push({
            type: 'LOW_TEMP',
            message: `Temperature ${data.temperature}°C below min ${data.min_temp}°C`,
            severity: 'warning'
        });
    }
    
    if (data.humidity > 80) {
        alerts.push({
            type: 'HIGH_HUMIDITY',
            message: `High humidity: ${data.humidity}%`,
            severity: 'info'
        });
    }
    
    alerts.forEach(alert => {
        db.run(`INSERT INTO alerts (device_id, alert_type, message, severity) 
                VALUES (?, ?, ?, ?)`,
                ['broodinnox_001', alert.type, alert.message, alert.severity]);
        io.emit('new_alert', alert);
    });
}

// Authentication middleware
function requireAuth(req, res, next) {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Authentication required' });
    }
    next();
}

// API Routes
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    
    db.get(`SELECT * FROM users WHERE username = ?`, [username], (err, user) => {
        if (err || !user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        if (bcrypt.compareSync(password, user.password)) {
            req.session.userId = user.id;
            req.session.username = user.username;
            req.session.role = user.role;
            
            db.run(`UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?`, [user.id]);
            db.run(`INSERT INTO system_logs (user_id, action, ip_address) VALUES (?, ?, ?)`,
                   [user.id, 'login', req.ip]);
            
            res.json({ 
                success: true, 
                user: { id: user.id, username: user.username, role: user.role }
            });
        } else {
            res.status(401).json({ error: 'Invalid credentials' });
        }
    });
});

app.post('/api/register', (req, res) => {
    const { username, password, email } = req.body;
    
    if (!username || !password || password.length < 6) {
        return res.status(400).json({ error: 'Invalid username or password (min 6 chars)' });
    }
    
    const hashedPassword = bcrypt.hashSync(password, 10);
    
    db.run(`INSERT INTO users (username, password, email, role) VALUES (?, ?, ?, ?)`,
           [username, hashedPassword, email, 'user'], 
           function(err) {
        if (err) {
            return res.status(400).json({ error: 'Username already exists' });
        }
        res.json({ success: true, message: 'Registration successful' });
    });
});

app.post('/api/logout', (req, res) => {
    if (req.session.userId) {
        db.run(`INSERT INTO system_logs (user_id, action, ip_address) VALUES (?, ?, ?)`,
               [req.session.userId, 'logout', req.ip]);
    }
    req.session.destroy();
    res.json({ success: true });
});

app.get('/api/current-user', requireAuth, (req, res) => {
    res.json({
        id: req.session.userId,
        username: req.session.username,
        role: req.session.role
    });
});

app.get('/api/status', requireAuth, (req, res) => {
    res.json(deviceStatus);
});

app.get('/api/settings', requireAuth, (req, res) => {
    db.get(`SELECT * FROM device_settings WHERE device_id = ?`, 
           ['broodinnox_001'], (err, settings) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        res.json(settings || { max_temp: 36, min_temp: 32, total_days: 30 });
    });
});

app.post('/api/settings', requireAuth, (req, res) => {
    const { max_temp, min_temp, total_days, relay_mode } = req.body;
    
    db.run(`UPDATE device_settings 
            SET max_temp = ?, min_temp = ?, total_days = ?, relay_mode = ?, updated_at = CURRENT_TIMESTAMP 
            WHERE device_id = ?`,
            [max_temp, min_temp, total_days, relay_mode, 'broodinnox_001'], 
            function(err) {
        if (err) {
            return res.status(500).json({ error: 'Failed to update settings' });
        }
        res.json({ success: true });
    });
});

app.post('/api/control/relay', requireAuth, (req, res) => {
    const { mode } = req.body;
    
    if (!['ON', 'OFF', 'AUTO'].includes(mode)) {
        return res.status(400).json({ error: 'Invalid mode' });
    }
    
    mqttClient.publish(MQTT_TOPICS.relay, mode, { qos: 1 });
    
    db.run(`INSERT INTO system_logs (user_id, action, ip_address) VALUES (?, ?, ?)`,
           [req.session.userId, `relay_control_${mode}`, req.ip]);
    
    res.json({ success: true, message: `Relay set to ${mode}` });
});

app.post('/api/control/setting', requireAuth, (req, res) => {
    const { setting, value } = req.body;
    
    const topicMap = {
        'max_temp': MQTT_TOPICS.max_temp,
        'min_temp': MQTT_TOPICS.min_temp,
        'total_days': MQTT_TOPICS.total_days,
        'sensor': MQTT_TOPICS.sensor
    };
    
    if (topicMap[setting]) {
        mqttClient.publish(topicMap[setting], String(value), { qos: 1 });
        res.json({ success: true });
    } else {
        res.status(400).json({ error: 'Invalid setting' });
    }
});

app.get('/api/historical-data', requireAuth, (req, res) => {
    const limit = req.query.limit || 100;
    
    db.all(`SELECT timestamp, temperature, humidity 
            FROM temperature_data 
            WHERE device_id = 'broodinnox_001' 
            ORDER BY timestamp DESC 
            LIMIT ?`, 
            [limit], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        res.json(rows.reverse());
    });
});

app.get('/api/alerts', requireAuth, (req, res) => {
    db.all(`SELECT * FROM alerts 
            WHERE resolved = 0 
            ORDER BY timestamp DESC 
            LIMIT 20`, 
            (err, rows) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        res.json(rows);
    });
});

app.post('/api/alerts/clear', requireAuth, (req, res) => {
    db.run(`UPDATE alerts SET resolved = 1 WHERE resolved = 0`, (err) => {
        if (err) {
            return res.status(500).json({ error: 'Failed to clear alerts' });
        }
        res.json({ success: true });
    });
});

app.get('/api/mqtt-status', requireAuth, (req, res) => {
    res.json({
        connected: mqttClient.connected,
        broker: MQTT_BROKER,
        topics: Object.values(MQTT_TOPICS)
    });
});

// Serve static files
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Socket.IO connection
io.on('connection', (socket) => {
    console.log('New client connected');
    socket.emit('device_update', deviceStatus);
    socket.emit('mqtt_status', { connected: mqttClient.connected });
    
    socket.on('disconnect', () => {
        console.log('Client disconnected');
    });
});

// Start server
const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
    console.log(`\n${'='.repeat(70)}`);
    console.log('🚀 BROODINNOX PRO - SMART BROODING SYSTEM');
    console.log('='.repeat(70));
    console.log(`📍 Server: http://localhost:${PORT}`);
    console.log(`🔐 Login: http://localhost:${PORT}/login`);
    console.log(`📡 MQTT Broker: ${MQTT_BROKER}:${MQTT_PORT}`);
    console.log(`🔑 Default: admin / admin123`);
    console.log(`${'='.repeat(70)}\n`);
});
