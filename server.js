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
        users: 245,
        revenue: '$15,432',
        growth: '+12.5%',
        activeProjects: 18,
        serverStatus: 'online',
        uptime: '99.9%',
        lastUpdated: new Date().toISOString()
    });
});

app.get('/api/files', (req, res) => {
    const files = [
        { name: 'server.js', type: 'js', size: '1.2KB' },
        { name: 'package.json', type: 'json', size: '0.8KB' },
        { name: 'render.yaml', type: 'yaml', size: '0.5KB' },
        { name: '.node-version', type: 'config', size: '0.1KB' },
        { name: 'public/index.html', type: 'html', size: '1.5KB' },
        { name: 'public/style.css', type: 'css', size: '2.1KB' },
        { name: 'public/script.js', type: 'js', size: '3.2KB' },
        { name: 'public/dashboard.js', type: 'js', size: '4.8KB' }
    ];
    res.json(files);
});

app.post('/api/deploy', (req, res) => {
    const { action } = req.body;
    
    if (action === 'restart') {
        res.json({ 
            success: true, 
            message: 'Server restart initiated',
            timestamp: new Date().toISOString()
        });
    } else {
        res.json({ 
            success: true, 
            message: 'Deployment action completed',
            timestamp: new Date().toISOString()
        });
    }
});

// Serve main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📁 Serving static files from: ${path.join(__dirname, 'public')}`);
});
