const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static('public'));

// API Routes
app.get('/api/dashboard', (req, res) => {
    res.json({
        device_id: "BROODIINNOX-001",
        device_name: "Broodinnox",
        status: "online",
        users: 245,
        revenue: '$15,432',
        growth: '+12.5%',
        activeProjects: 18,
        serverStatus: 'online',
        uptime: '99.9%',
        lastUpdated: new Date().toISOString(),
        features: [
            "SMS Payment Control",
            "MQTT over GPRS",
            "RTC Power Loss Recovery",
            "Evening Safety Override",
            "Daytime Temperature Control",
            "Factory Reset"
        ]
    });
});

app.get('/api/files', (req, res) => {
    const files = [
        { name: 'server.js', type: 'js', size: '1.2KB', path: '/server.js' },
        { name: 'package.json', type: 'json', size: '0.8KB', path: '/package.json' },
        { name: 'render.yaml', type: 'yaml', size: '0.5KB', path: '/render.yaml' },
        { name: '.node-version', type: 'config', size: '0.1KB', path: '/.node-version' },
        { name: 'index.html', type: 'html', size: '1.5KB', path: '/public/index.html' },
        { name: 'style.css', type: 'css', size: '2.1KB', path: '/public/style.css' },
        { name: 'script.js', type: 'js', size: '3.2KB', path: '/public/script.js' },
        { name: 'dashboard.js', type: 'js', size: '4.8KB', path: '/public/dashboard.js' }
    ];
    res.json(files);
});

app.get('/api/stats', (req, res) => {
    const stats = {
        totalFiles: 8,
        folders: 1,
        javascriptFiles: 3,
        configFiles: 3,
        htmlFiles: 1,
        cssFiles: 1,
        lastUpdated: new Date().toLocaleDateString(),
        projectSize: '15.2KB',
        linesOfCode: 1250
    };
    res.json(stats);
});

app.post('/api/deploy', (req, res) => {
    const { action } = req.body;
    
    if (action === 'restart') {
        res.json({ 
            success: true, 
            message: 'Server restart initiated',
            timestamp: new Date().toISOString(),
            status: 'restarting'
        });
    } else if (action === 'deploy') {
        res.json({ 
            success: true, 
            message: 'Deployment started',
            timestamp: new Date().toISOString(),
            status: 'deploying'
        });
    } else {
        res.json({ 
            success: true, 
            message: 'Action completed',
            timestamp: new Date().toISOString(),
            status: 'completed'
        });
    }
});

app.get('/api/file-content/:filename', (req, res) => {
    const { filename } = req.params;
    const fileContents = {
        'server.js': `const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/api/dashboard', (req, res) => {
    res.json({
        users: 245,
        revenue: '$15,432',
        growth: '+12.5%',
        activeProjects: 18,
        serverStatus: 'online',
        uptime: '99.9%'
    });
});

app.listen(PORT, () => {
    console.log(\`Server running on port \${PORT}\`);
});`,

        'package.json': `{
  "name": "my-web-app",
  "version": "1.0.0",
  "description": "A complete web application with dashboard interface",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js",
    "test": "echo \\"No tests specified\\" && exit 0"
  },
  "dependencies": {
    "express": "^4.18.2"
  },
  "devDependencies": {
    "nodemon": "^3.0.1"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}`,

        'render.yaml': `services:
  - type: web
    name: my-web-app
    env: node
    buildCommand: npm install
    startCommand: node server.js
    envVars:
      - key: NODE_ENV
        value: production
    autoDeploy: true`,

        '.node-version': '18.17.1',

        'index.html': `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Web Dashboard</title>
    <link rel="stylesheet" href="style.css">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
</head>
<body>
    <div class="container">
        <!-- Main content loaded by JavaScript -->
    </div>
    <script src="script.js"></script>
    <script src="dashboard.js"></script>
</body>
</html>`,

        'style.css': `/* Main stylesheet */
:root {
    --primary-color: #4f46e5;
    --secondary-color: #7c3aed;
    --text-color: #1e293b;
    --bg-color: #f8fafc;
}

* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    background: var(--bg-color);
    color: var(--text-color);
    line-height: 1.6;
}`,

        'script.js': `// Main application script
document.addEventListener('DOMContentLoaded', function() {
    console.log('App loaded successfully!');
    
    // Initialize app
    initApp();
});

function initApp() {
    console.log('Initializing app...');
    // App initialization logic
}`,

        'dashboard.js': `// Dashboard-specific functionality
console.log('Dashboard module loaded');

class Dashboard {
    constructor() {
        this.initialized = false;
    }

    init() {
        console.log('Dashboard initialized');
        this.initialized = true;
    }
}

// Initialize dashboard
window.dashboard = new Dashboard();
window.dashboard.init();`
    };

    if (fileContents[filename]) {
        res.json({
            success: true,
            filename: filename,
            content: fileContents[filename],
            language: filename.split('.').pop()
        });
    } else {
        res.status(404).json({
            success: false,
            message: 'File not found'
        });
    }
});

// Serve main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        error: 'Not Found',
        message: `Cannot ${req.method} ${req.url}`
    });
});

// Error handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        error: 'Server Error',
        message: 'Something went wrong!'
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📁 Serving static files from: ${path.join(__dirname, 'public')}`);
    console.log(`🌐 API available at: http://localhost:${PORT}/api`);
});
