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
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Database setup
const db = new sqlite3.Database('./database/broodinnox.db');

// Initialize database tables
db.serialize(() => {
    // Users table
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        email TEXT,
        role TEXT DEFAULT 'user',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_login DATETIME
    )`);

    // Temperature data table
    db.run(`CREATE TABLE IF NOT EXISTS temperature_data (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        device_id TEXT,
        temperature REAL,
        humidity REAL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Device settings table
    db.run(`CREATE TABLE IF NOT EXISTS device_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        device_id TEXT UNIQUE,
        max_temp REAL DEFAULT 36,
        min_temp REAL DEFAULT 32,
        total_days INTEGER DEFAULT 30,
        relay_mode TEXT DEFAULT 'AUTO',
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Alerts table
    db.run(`CREATE TABLE IF NOT EXISTS alerts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        device_id TEXT,
        alert_type TEXT,
        message TEXT,
        severity TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        resolved BOOLEAN DEFAULT 0
    )`);

    // System logs table
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

// MQTT Configuration
const MQTT_BROKER = process.env.MQTT_BROKER || 'mqtt://broker.hivemq.com';
const mqttClient = mqtt.connect(MQTT_BROKER);

const MQTT_TOPICS = {
    data: 'broodinnox/data',
    relay: 'broodinnox/control/relay',
    max_temp: 'broodinnox/control/max_temp',
    min_temp: 'broodinnox/control/min_temp',
    total_days: 'broodinnox/control/total_days',
    sensor: 'broodinnox/control/sensor',
    status: 'broodinnox/status'
};

// Device status storage
let deviceStatus = {
    online: false,
    temperature: 0,
    humidity: 0,
    cycle_day: 0,
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

// MQTT Connection
mqttClient.on('connect', () => {
    console.log('✅ Connected to MQTT Broker');
    Object.values(MQTT_TOPICS).forEach(topic => {
        mqttClient.subscribe(topic, (err) => {
            if (!err) console.log(`📡 Subscribed to: ${topic}`);
        });
    });
});

mqttClient.on('message', (topic, message) => {
    const payload = message.toString();
    console.log(`📨 Message on ${topic}: ${payload}`);
    
    try {
        const data = JSON.parse(payload);
        
        if (topic === MQTT_TOPICS.data) {
            processDeviceData(data);
        }
    } catch (error) {
        console.error('Error parsing MQTT message:', error);
    }
});

function processDeviceData(data) {
    // Update device status
    deviceStatus = {
        online: true,
        temperature: data.temperature || 0,
        humidity: data.humidity || 0,
        cycle_day: data.cycle_day || 0,
        relay_status: data.relay_status || 'OFF',
        relay_mode: data.relay_mode || 'AUTO',
        last_update: new Date().toISOString(),
        sensors: data.sensors || {
            temp1: 'N/A', temp2: 'N/A', temp3: 'N/A', temp4: 'N/A',
            s1_active: false, s2_active: false, s3_active: false, s4_active: false
        }
    };
    
    // Store in database
    db.run(`INSERT INTO temperature_data (device_id, temperature, humidity) 
            VALUES (?, ?, ?)`,
            ['broodinnox_001', data.temperature, data.humidity]);
    
    // Check for alerts
    checkAlerts(data);
    
    // Emit real-time update via Socket.IO
    io.emit('device_update', deviceStatus);
}

function checkAlerts(data) {
    db.get(`SELECT max_temp, min_temp FROM device_settings WHERE device_id = ?`, 
           ['broodinnox_001'], (err, settings) => {
        if (err || !settings) return;
        
        const alerts = [];
        
        if (data.temperature > settings.max_temp + 2) {
            alerts.push({
                type: 'HIGH_TEMP',
                message: `Temperature ${data.temperature}°C exceeds max ${settings.max_temp}°C`,
                severity: 'warning'
            });
        } else if (data.temperature < settings.min_temp - 2) {
            alerts.push({
                type: 'LOW_TEMP',
                message: `Temperature ${data.temperature}°C below min ${settings.min_temp}°C`,
                severity: 'warning'
            });
        }
        
        alerts.forEach(alert => {
            db.run(`INSERT INTO alerts (device_id, alert_type, message, severity) 
                    VALUES (?, ?, ?, ?)`,
                    ['broodinnox_001', alert.type, alert.message, alert.severity]);
            io.emit('new_alert', alert);
        });
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

// Authentication
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
            
            // Update last login
            db.run(`UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?`, [user.id]);
            
            // Log action
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

// Device status endpoints
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
    
    mqttClient.publish(MQTT_TOPICS.relay, mode);
    
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
        mqttClient.publish(topicMap[setting], String(value));
        res.json({ success: true });
    } else {
        res.status(400).json({ error: 'Invalid setting' });
    }
});

// Data endpoints
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

app.get('/api/analytics', requireAuth, (req, res) => {
    db.get(`SELECT 
                AVG(temperature) as avg_temp,
                MAX(temperature) as max_temp,
                MIN(temperature) as min_temp,
                COUNT(*) as data_points
            FROM temperature_data 
            WHERE timestamp >= datetime('now', '-1 day')`, 
            (err, stats) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        res.json(stats || { avg_temp: 0, max_temp: 0, min_temp: 0, data_points: 0 });
    });
});

// User management (admin only)
app.get('/api/users', requireAuth, (req, res) => {
    if (req.session.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
    }
    
    db.all(`SELECT id, username, email, role, created_at, last_login FROM users`, 
           (err, rows) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        res.json(rows);
    });
});

app.delete('/api/users/:id', requireAuth, (req, res) => {
    if (req.session.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
    }
    
    if (req.params.id == req.session.userId) {
        return res.status(400).json({ error: 'Cannot delete your own account' });
    }
    
    db.run(`DELETE FROM users WHERE id = ?`, [req.params.id], (err) => {
        if (err) {
            return res.status(500).json({ error: 'Failed to delete user' });
        }
        res.json({ success: true });
    });
});

// Serve React app
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Socket.IO connection
io.on('connection', (socket) => {
    console.log('New client connected');
    socket.emit('device_update', deviceStatus);
    
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
    console.log(`📍 Server running on: http://localhost:${PORT}`);
    console.log(`🔐 Login: http://localhost:${PORT}/login`);
    console.log(`📊 Dashboard: http://localhost:${PORT}/dashboard`);
    console.log(`\n🔑 Default credentials: admin / admin123`);
    console.log(`${'='.repeat(70)}\n`);
});
