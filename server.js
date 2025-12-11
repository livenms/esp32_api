const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/src', express.static(path.join(__dirname, 'src')));

// API Routes
app.get('/api/status', (req, res) => {
  res.json({
    status: 'online',
    version: '1.0.0',
    device: 'Broodinnox Web Interface',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/device/:id', (req, res) => {
  const deviceId = req.params.id;
  res.json({
    device_id: deviceId,
    name: 'Broodinnox Smart Brooder',
    type: 'poultry_brooder',
    firmware: '2.0',
    supported_animals: ['Chicken', 'Pig', 'Turkey', 'Duck']
  });
});

// Serve main HTML
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌐 Open http://localhost:${PORT}`);
});
