// API Service
const API = {
    baseURL: '/api',
    
    async request(endpoint, options = {}) {
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };
        
        const response = await fetch(`${this.baseURL}${endpoint}`, {
            ...options,
            headers
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Request failed');
        }
        
        return response.json();
    },
    
    get(endpoint) {
        return this.request(endpoint);
    },
    
    post(endpoint, data) {
        return this.request(endpoint, {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }
};

// Main App
const App = {
    socket: null,
    currentView: 'dashboard',
    
    init() {
        this.setupSocket();
        this.showDashboard();
    },
    
    setupSocket() {
        this.socket = io();
        
        this.socket.on('connect', () => {
            console.log('✅ WebSocket connected');
            this.updateMQTTStatus(true);
        });
        
        this.socket.on('disconnect', () => {
            console.log('❌ WebSocket disconnected');
            this.updateMQTTStatus(false);
        });
        
        this.socket.on('devices_list', (devices) => {
            if (window.Dashboard) {
                window.Dashboard.devices = devices;
                window.Dashboard.renderDevices();
            }
        });
        
        this.socket.on('device_update', (data) => {
            console.log('📡 Real-time device update:', data.deviceId, 'Temp:', data.avg_temp);
            if (window.Dashboard && typeof window.Dashboard.updateDeviceData === 'function') {
                window.Dashboard.updateDeviceData(data);
            }
            if (window.DeviceDetail && typeof window.DeviceDetail.updateRealTimeData === 'function') {
                window.DeviceDetail.updateRealTimeData(data);
            }
        });
        
        this.socket.on('status_update', (data) => {
            if (window.Dashboard && typeof window.Dashboard.updateDeviceStatus === 'function') {
                window.Dashboard.updateDeviceStatus(data);
            }
        });
        
        this.socket.on('new_alert', (alert) => {
            this.showToast(`🔔 ${alert.message}`, 'warning');
            if (window.Dashboard && typeof window.Dashboard.addAlert === 'function') {
                window.Dashboard.addAlert(alert);
            }
        });
    },
    
    updateMQTTStatus(connected) {
        const statusElement = document.getElementById('mqtt-status');
        if (statusElement) {
            statusElement.innerHTML = connected ? 
                '<span class="status-dot"></span> MQTT Connected' : 
                '<span class="status-dot" style="background:#ef4444"></span> MQTT Disconnected';
        }
    },
    
    showDashboard() {
        const container = document.getElementById('app');
        container.innerHTML = Dashboard.render();
        Dashboard.init(this.socket);
        this.currentView = 'dashboard';
    },
    
    showDeviceDetail(deviceId) {
        const container = document.getElementById('app');
        container.innerHTML = DeviceDetail.render();
        DeviceDetail.init(deviceId, this.socket);
        this.currentView = 'detail';
    },
    
    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 5000);
    }
};

// Dashboard Component
const Dashboard = {
    devices: [],
    socket: null,
    alerts: [],
    
    render() {
        return `
            <div class="dashboard">
                <div class="header">
                    <div class="header-content">
                        <div class="logo">
                            <h1>🐔 BROODINNOX</h1>
                            <p>Smart Brooding System - Real Device Data</p>
                        </div>
                        <div class="mqtt-status" id="mqtt-status">
                            <span class="status-dot"></span> Connecting...
                        </div>
                    </div>
                </div>
                <div id="alerts-panel" class="alerts-panel" style="max-width:1400px;margin:20px auto;padding:0 20px"></div>
                <div id="device-grid" class="device-grid">
                    <div class="loading">
                        <div class="spinner"></div>
                        <p>Waiting for real device data...</p>
                        <p style="font-size:14px;margin-top:10px">Make sure your ESP32 devices are publishing to:<br>
                        <code>broodinnox/{DEVICE_ID}/data</code> or <code>broodinnox/{DEVICE_ID}/telemetry</code></p>
                    </div>
                </div>
            </div>
        `;
    },
    
    init(socket) {
        this.socket = socket;
        this.loadDevices();
        this.loadAlerts();
        setInterval(() => this.loadDevices(), 10000);
    },
    
    async loadDevices() {
        try {
            const devices = await API.get('/devices');
            if (devices.length > 0) {
                this.devices = devices;
                this.renderDevices();
            }
        } catch (error) {
            console.error('Failed to load devices:', error);
        }
    },
    
    renderDevices() {
        const grid = document.getElementById('device-grid');
        
        if (this.devices.length === 0) {
            grid.innerHTML = `
                <div class="loading">
                    <div class="spinner"></div>
                    <p>No devices found. Waiting for real device data...</p>
                    <p style="font-size:14px;margin-top:10px">Devices will appear here automatically when they send MQTT data</p>
                </div>
            `;
            return;
        }
        
        grid.innerHTML = this.devices.map(device => this.createDeviceCard(device)).join('');
    },
    
    createDeviceCard(device) {
        const tempClass = device.avg_temp > device.max_temp ? 'temp-high' : 
                         (device.avg_temp < device.min_temp && device.avg_temp > 0) ? 'temp-low' : 'temp-normal';
        const signalStrength = this.getSignalStrength(device.signal_quality);
        const lastUpdate = device.last_update ? new Date(device.last_update).toLocaleTimeString() : 'Never';
        
        return `
            <div class="device-card" onclick="App.showDeviceDetail('${device.id}')">
                <div class="device-header">
                    <div class="device-title">
                        <h3>${this.escapeHtml(device.name)}</h3>
                        <div class="device-id">${device.id}</div>
                        <div style="font-size:10px;color:#999;margin-top:5px">Last: ${lastUpdate}</div>
                    </div>
                    <div class="status-badge ${device.is_online ? 'status-online' : 'status-offline'}">
                        ${device.is_online ? '● ONLINE' : '○ OFFLINE'}
                    </div>
                </div>
                <div class="temp-display">
                    <div class="temp-value ${tempClass}">${device.avg_temp > 0 ? device.avg_temp.toFixed(1) : '--'}°C</div>
                    <div style="font-size:12px;color:#666">
                        Target: ${device.min_temp}°C - ${device.max_temp}°C
                    </div>
                </div>
                <div class="device-stats">
                    <div class="stat">
                        <span class="stat-label">Relay</span>
                        <span class="stat-value">${device.relay_state ? 'ON' : 'OFF'}</span>
                    </div>
                    <div class="stat">
                        <span class="stat-label">Mode</span>
                        <span class="stat-value">${device.relay_mode === 'auto' ? 'Auto' : 'Manual'}</span>
                    </div>
                    <div class="stat">
                        <span class="stat-label">Day</span>
                        <span class="stat-value">${device.current_day || 0}/${device.total_days || 30}</span>
                    </div>
                    <div class="stat">
                        <span class="stat-label">Signal</span>
                        <div class="signal-bars">
                            ${signalStrength.map(active => 
                                `<div class="signal-bar ${active ? 'active' : ''}"></div>`
                            ).join('')}
                            <span style="margin-left:5px">${device.signal_quality || 0}%</span>
                        </div>
                    </div>
                </div>
                ${device.sensor_error ? '<div style="margin-top:10px;padding:8px;background:#fee2e2;border-radius:8px;font-size:12px;color:#dc2626">⚠️ Sensor Error Detected</div>' : ''}
                ${device.failsafe ? '<div style="margin-top:10px;padding:8px;background:#ffedd5;border-radius:8px;font-size:12px;color:#d97706">🛡️ Failsafe Mode Active</div>' : ''}
            </div>
        `;
    },
    
    getSignalStrength(quality) {
        const bars = quality >= 70 ? 4 : quality >= 40 ? 3 : quality >= 20 ? 2 : quality >= 5 ? 1 : 0;
        return [1,2,3,4].map(i => i <= bars);
    },
    
    updateDeviceData(data) {
        const index = this.devices.findIndex(d => d.id === data.deviceId);
        if (index !== -1) {
            this.devices[index] = { ...this.devices[index], ...data };
            this.renderDevices();
        } else {
            // New device discovered
            this.loadDevices();
        }
    },
    
    updateDeviceStatus(data) {
        const index = this.devices.findIndex(d => d.id === data.deviceId);
        if (index !== -1) {
            this.devices[index].is_online = data.online;
            this.devices[index].is_locked = data.locked;
            this.renderDevices();
        }
    },
    
    async loadAlerts() {
        // Alerts are shown in real-time via socket
    },
    
    addAlert(alert) {
        this.alerts.unshift(alert);
        this.renderAlerts();
        setTimeout(() => this.renderAlerts(), 5000);
    },
    
    renderAlerts() {
        const panel = document.getElementById('alerts-panel');
        if (this.alerts.length === 0) {
            panel.innerHTML = '';
            return;
        }
        
        panel.innerHTML = `
            <div class="detail-card" style="background:#fff3cd;border-left:4px solid #ffc107">
                <h3 style="color:#856404">⚠️ Recent Alerts (${this.alerts.length})</h3>
                ${this.alerts.slice(0, 5).map(alert => `
                    <div class="alert-item alert-${alert.severity}">
                        <strong>${alert.type.toUpperCase()}</strong>: ${alert.message}
                        <small style="display:block;margin-top:5px">${new Date().toLocaleTimeString()}</small>
                    </div>
                `).join('')}
            </div>
        `;
    },
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};

// Device Detail Component
const DeviceDetail = {
    deviceId: null,
    device: null,
    socket: null,
    chart: null,
    currentPeriod: '24h',
    
    render() {
        return `
            <div class="dashboard">
                <div class="header">
                    <div class="header-content">
                        <div class="logo">
                            <h1>🐔 BROODINNOX</h1>
                            <p>Device Details - Real Time Monitoring</p>
                        </div>
                        <div class="mqtt-status" id="mqtt-status">
                            <span class="status-dot"></span> Connected
                        </div>
                    </div>
                </div>
                <div class="detail-container">
                    <a class="back-btn" onclick="App.showDashboard()">← Back to Dashboard</a>
                    <div id="device-detail-content">
                        <div class="loading"><div class="spinner"></div>Loading device data...</div>
                    </div>
                </div>
            </div>
        `;
    },
    
    async init(deviceId, socket) {
        this.deviceId = deviceId;
        this.socket = socket;
        
        this.socket.emit('subscribe_device', deviceId);
        await this.loadDeviceDetails();
        await this.loadTemperatureHistory();
        
        setInterval(() => this.loadDeviceDetails(), 5000);
        setInterval(() => this.loadTemperatureHistory(), 30000);
    },
    
    async loadDeviceDetails() {
        try {
            const device = await API.get(`/devices/${this.deviceId}`);
            this.device = device;
            this.renderDeviceDetails();
        } catch (error) {
            document.getElementById('device-detail-content').innerHTML = 
                '<div class="error">Failed to load device data. Make sure device is sending MQTT data.</div>';
        }
    },
    
    renderDeviceDetails() {
        const container = document.getElementById('device-detail-content');
        const d = this.device;
        
        if (!d) return;
        
        container.innerHTML = `
            <div class="detail-grid">
                <div class="detail-card">
                    <h3>🌡️ Real-Time Temperature Sensors</h3>
                    <div class="sensor-grid">
                        <div class="sensor-item">
                            <div class="sensor-label">Average Temperature</div>
                            <div class="sensor-value ${this.getTempClass(d.avg_temp)}">${d.avg_temp > 0 ? d.avg_temp.toFixed(1) : '--'}°C</div>
                        </div>
                        <div class="sensor-item">
                            <div class="sensor-label">Sensor 1</div>
                            <div class="sensor-value">${d.sensor1 > 0 ? d.sensor1.toFixed(1) : '--'}°C</div>
                        </div>
                        <div class="sensor-item">
                            <div class="sensor-label">Sensor 2</div>
                            <div class="sensor-value">${d.sensor2 > 0 ? d.sensor2.toFixed(1) : '--'}°C</div>
                        </div>
                        <div class="sensor-item">
                            <div class="sensor-label">Sensor 3</div>
                            <div class="sensor-value">${d.sensor3 > 0 ? d.sensor3.toFixed(1) : '--'}°C</div>
                        </div>
                        <div class="sensor-item">
                            <div class="sensor-label">Sensor 4</div>
                            <div class="sensor-value">${d.sensor4 > 0 ? d.sensor4.toFixed(1) : '--'}°C</div>
                        </div>
                    </div>
                </div>
                
                <div class="detail-card">
                    <h3>📊 Device Status</h3>
                    <div class="device-stats" style="grid-template-columns:1fr">
                        <div class="stat"><span class="stat-label">Relay State:</span><span class="stat-value">${d.relay_state ? 'ON' : 'OFF'}</span></div>
                        <div class="stat"><span class="stat-label">Control Mode:</span><span class="stat-value">${d.relay_mode === 'auto' ? 'Auto (Temperature Controlled)' : 'Manual'}</span></div>
                        <div class="stat"><span class="stat-label">Current Day:</span><span class="stat-value">${d.current_day || 0} / ${d.total_days || 30}</span></div>
                        <div class="stat"><span class="stat-label">Temperature Range:</span><span class="stat-value">${d.min_temp || 30}°C - ${d.max_temp || 35}°C</span></div>
                        <div class="stat"><span class="stat-label">Signal Quality:</span><span class="stat-value">${d.signal_quality || 0}%</span></div>
                        <div class="stat"><span class="stat-label">Sensor Error:</span><span class="stat-value">${d.sensor_error ? '⚠️ YES' : '✓ No'}</span></div>
                        <div class="stat"><span class="stat-label">Mismatch Error:</span><span class="stat-value">${d.mismatch_error ? '⚠️ YES' : '✓ No'}</span></div>
                        <div class="stat"><span class="stat-label">Failsafe Mode:</span><span class="stat-value">${d.failsafe ? '⚠️ Active' : '✓ Normal'}</span></div>
                        <div class="stat"><span class="stat-label">Last Update:</span><span class="stat-value">${d.last_update ? new Date(d.last_update).toLocaleString() : 'Never'}</span></div>
                    </div>
                </div>
            </div>
            
            <div class="control-panel">
                <h3>🎮 Remote Control (Sends MQTT Commands)</h3>
                
                <div class="control-group">
                    <h4>Relay Control</h4>
                    <div class="btn-group">
                        <button class="control-btn" onclick="DeviceDetail.sendCommand('relay', 'ON')">🔌 Turn ON</button>
                        <button class="control-btn" onclick="DeviceDetail.sendCommand('relay', 'OFF')">⭕ Turn OFF</button>
                        <button class="control-btn" onclick="DeviceDetail.sendCommand('relay', 'AUTO')">🤖 Set AUTO Mode</button>
                    </div>
                </div>
                
                <div class="control-group">
                    <h4>Temperature Settings</h4>
                    <div class="temp-input">
                        <input type="number" id="max-temp" placeholder="Max Temperature" step="0.5" value="${d.max_temp || 35}">
                        <button class="control-btn" onclick="DeviceDetail.sendCommand('max_temp', document.getElementById('max-temp').value)">Set Maximum</button>
                    </div>
                    <div class="temp-input" style="margin-top:10px">
                        <input type="number" id="min-temp" placeholder="Min Temperature" step="0.5" value="${d.min_temp || 30}">
                        <button class="control-btn" onclick="DeviceDetail.sendCommand('min_temp', document.getElementById('min-temp').value)">Set Minimum</button>
                    </div>
                </div>
                
                <div class="control-group">
                    <h4>🐔 Animal Presets</h4>
                    <div class="btn-group">
                        <button class="control-btn" onclick="DeviceDetail.sendCommand('animal_preset', 'Chicken')">🐔 Chicken (35°C)</button>
                        <button class="control-btn" onclick="DeviceDetail.sendCommand('animal_preset', 'Pig')">🐷 Pig (32°C)</button>
                        <button class="control-btn" onclick="DeviceDetail.sendCommand('animal_preset', 'Turkey')">🦃 Turkey (33°C)</button>
                        <button class="control-btn" onclick="DeviceDetail.sendCommand('animal_preset', 'Duck')">🦆 Duck (31°C)</button>
                    </div>
                </div>
                
                <div class="control-group">
                    <h4>Individual Sensor Control</h4>
                    <div class="btn-group">
                        <button class="control-btn" onclick="DeviceDetail.sendCommand('sensor', 'DS1:ON')">Sensor 1 ON</button>
                        <button class="control-btn" onclick="DeviceDetail.sendCommand('sensor', 'DS1:OFF')">Sensor 1 OFF</button>
                        <button class="control-btn" onclick="DeviceDetail.sendCommand('sensor', 'DS2:ON')">Sensor 2 ON</button>
                        <button class="control-btn" onclick="DeviceDetail.sendCommand('sensor', 'DS2:OFF')">Sensor 2 OFF</button>
                        <button class="control-btn" onclick="DeviceDetail.sendCommand('sensor', 'DS3:ON')">Sensor 3 ON</button>
                        <button class="control-btn" onclick="DeviceDetail.sendCommand('sensor', 'DS3:OFF')">Sensor 3 OFF</button>
                        <button class="control-btn" onclick="DeviceDetail.sendCommand('sensor', 'DS4:ON')">Sensor 4 ON</button>
                        <button class="control-btn" onclick="DeviceDetail.sendCommand('sensor', 'DS4:OFF')">Sensor 4 OFF</button>
                    </div>
                </div>
                
                <div class="control-group">
                    <h4>System Configuration</h4>
                    <div class="btn-group">
                        <input type="number" id="total-days" placeholder="Total Days" value="${d.total_days || 30}" style="padding:10px;border-radius:8px;border:1px solid #e5e7eb">
                        <button class="control-btn" onclick="DeviceDetail.sendCommand('total_days', document.getElementById('total-days').value)">Set Brooding Period</button>
                        <button class="control-btn" style="border-color:#dc2626;color:#dc2626" onclick="if(confirm('⚠️ Factory reset will erase all settings. Continue?')) DeviceDetail.sendCommand('factory_reset', 'RESET')">🏭 Factory Reset</button>
                    </div>
                </div>
            </div>
            
            <div class="chart-container">
                <div class="chart-header">
                    <h3>📈 Temperature History (Real Data)</h3>
                    <div class="period-buttons">
                        <button class="period-btn ${this.currentPeriod === '24h' ? 'active' : ''}" onclick="DeviceDetail.changePeriod('24h')">Last 24 Hours</button>
                        <button class="period-btn ${this.currentPeriod === '7d' ? 'active' : ''}" onclick="DeviceDetail.changePeriod('7d')">Last 7 Days</button>
                        <button class="period-btn ${this.currentPeriod === '30d' ? 'active' : ''}" onclick="DeviceDetail.changePeriod('30d')">Last 30 Days</button>
                    </div>
                </div>
                <canvas id="temp-chart"></canvas>
            </div>
        `;
    },
    
    async loadTemperatureHistory() {
        try {
            const data = await API.get(`/devices/${this.deviceId}/history?period=${this.currentPeriod}`);
            this.renderChart(data);
        } catch (error) {
            console.error('Failed to load temperature history:', error);
        }
    },
    
    renderChart(data) {
        const canvas = document.getElementById('temp-chart');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        const timestamps = data.map(d => new Date(d.timestamp).toLocaleTimeString());
        const avgTemps = data.map(d => d.avg_temp);
        const sensor1 = data.map(d => d.sensor1);
        const sensor2 = data.map(d => d.sensor2);
        
        if (this.chart) {
            this.chart.destroy();
        }
        
        this.chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: timestamps,
                datasets: [
                    {
                        label: 'Average Temperature',
                        data: avgTemps,
                        borderColor: '#10b981',
                        backgroundColor: 'rgba(16,185,129,0.1)',
                        tension: 0.4,
                        fill: true,
                        borderWidth: 2
                    },
                    {
                        label: 'Sensor 1',
                        data: sensor1,
                        borderColor: '#3b82f6',
                        backgroundColor: 'transparent',
                        tension: 0.4,
                        borderWidth: 1
                    },
                    {
                        label: 'Sensor 2',
                        data: sensor2,
                        borderColor: '#f59e0b',
                        backgroundColor: 'transparent',
                        tension: 0.4,
                        borderWidth: 1
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                plugins: {
                    legend: {
                        position: 'top',
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false
                    }
                },
                scales: {
                    y: {
                        title: {
                            display: true,
                            text: 'Temperature (°C)'
                        },
                        min: 0,
                        max: 50
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Time'
                        },
                        ticks: {
                            maxRotation: 45,
                            minRotation: 45
                        }
                    }
                }
            }
        });
    },
    
    async sendCommand(command, value) {
        try {
            await API.post(`/devices/${this.deviceId}/control/${command}`, { value });
            App.showToast(`✅ Command "${command}" sent to device`, 'success');
        } catch (error) {
            App.showToast(`❌ Failed to send command: ${error.message}`, 'error');
        }
    },
    
    changePeriod(period) {
        this.currentPeriod = period;
        this.loadTemperatureHistory();
        
        document.querySelectorAll('.period-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.textContent.includes(period === '24h' ? '24' : period === '7d' ? '7' : '30')) {
                btn.classList.add('active');
            }
        });
    },
    
    updateRealTimeData(data) {
        if (data.deviceId === this.deviceId && this.device) {
            const oldTemp = this.device.avg_temp;
            this.device = { ...this.device, ...data };
            this.renderDeviceDetails();
            
            if (Math.abs(oldTemp - data.avg_temp) > 1) {
                console.log(`🌡️ Temperature changed: ${oldTemp}°C → ${data.avg_temp}°C`);
            }
        }
    },
    
    getTempClass(temp) {
        if (this.device) {
            if (temp > this.device.max_temp) return 'temp-high';
            if (temp < this.device.min_temp && temp > 0) return 'temp-low';
        }
        return 'temp-normal';
    }
};

// Make available globally
window.Dashboard = Dashboard;
window.DeviceDetail = DeviceDetail;
window.App = App;

// Start the app when page loads
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
