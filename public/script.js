// WebSocket and application state
let ws = null;
let isConnected = false;
let reconnectAttempts = 0;
const maxReconnectAttempts = 5;
const reconnectDelay = 3000;

// Chart configuration
let tempChart = null;
let tempData = {
    labels: [],
    datasets: [{
        label: 'Temperature (°C)',
        data: [],
        borderColor: '#3498db',
        backgroundColor: 'rgba(52, 152, 219, 0.1)',
        tension: 0.4,
        fill: true
    }]
};

// Initialize the dashboard
document.addEventListener('DOMContentLoaded', function() {
    initializeChart();
    setupEventListeners();
    connectWebSocket();
    updateTime();
    setInterval(updateTime, 1000);
});

// Initialize temperature chart
function initializeChart() {
    const ctx = document.getElementById('temp-chart').getContext('2d');
    tempChart = new Chart(ctx, {
        type: 'line',
        data: tempData,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    min: 20,
                    max: 40,
                    grid: {
                        color: 'rgba(0,0,0,0.1)'
                    }
                },
                x: {
                    grid: {
                        display: false
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                }
            }
        }
    });
}

// Setup all event listeners
function setupEventListeners() {
    // Temperature controls
    document.getElementById('inc-max-temp').addEventListener('click', () => adjustTemperature('max', 1));
    document.getElementById('dec-max-temp').addEventListener('click', () => adjustTemperature('max', -1));
    document.getElementById('inc-min-temp').addEventListener('click', () => adjustTemperature('min', 1));
    document.getElementById('dec-min-temp').addEventListener('click', () => adjustTemperature('min', -1));
    
    // Heater controls
    document.getElementById('auto-mode-btn').addEventListener('click', () => setHeaterMode('AUTO'));
    document.getElementById('manual-mode-btn').addEventListener('click', () => setHeaterMode('MANUAL'));
    document.getElementById('heater-on-btn').addEventListener('click', () => setHeaterState('ON'));
    document.getElementById('heater-off-btn').addEventListener('click', () => setHeaterState('OFF'));
    
    // System mode controls
    document.getElementById('online-mode-btn').addEventListener('click', () => setSystemMode('ONLINE'));
    document.getElementById('offline-mode-btn').addEventListener('click', () => setSystemMode('OFFLINE'));
    
    // Other controls
    document.getElementById('reduce-now-btn').addEventListener('click', forceReduceTemp);
    document.getElementById('weekly-reduce-toggle').addEventListener('change', toggleWeeklyReduce);
    
    // Total days control
    document.getElementById('inc-total-days').addEventListener('click', () => adjustTotalDays(1));
    document.getElementById('dec-total-days').addEventListener('click', () => adjustTotalDays(-1));
    
    // Sensor toggles
    document.getElementById('sensor1-toggle').addEventListener('change', () => toggleSensor(1));
    document.getElementById('sensor2-toggle').addEventListener('change', () => toggleSensor(2));
    document.getElementById('sensor3-toggle').addEventListener('change', () => toggleSensor(3));
    document.getElementById('sensor4-toggle').addEventListener('change', () => toggleSensor(4));
}

// Connect to WebSocket server
function connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    
    try {
        ws = new WebSocket(wsUrl);
        
        ws.onopen = () => {
            console.log('✅ Connected to server');
            isConnected = true;
            reconnectAttempts = 0;
            updateConnectionStatus(true);
        };
        
        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                handleServerMessage(data);
            } catch (error) {
                console.error('Error parsing server message:', error);
            }
        };
        
        ws.onclose = () => {
            console.log('🔌 Disconnected from server');
            isConnected = false;
            updateConnectionStatus(false);
            
            // Attempt to reconnect
            if (reconnectAttempts < maxReconnectAttempts) {
                reconnectAttempts++;
                console.log(`🔄 Attempting to reconnect... (${reconnectAttempts}/${maxReconnectAttempts})`);
                setTimeout(connectWebSocket, reconnectDelay);
            }
        };
        
        ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            isConnected = false;
            updateConnectionStatus(false);
        };
        
    } catch (error) {
        console.error('Failed to connect to WebSocket:', error);
        isConnected = false;
        updateConnectionStatus(false);
    }
}

// Handle messages from server
function handleServerMessage(message) {
    switch (message.type) {
        case 'data':
            updateDashboard(message.data);
            break;
        case 'success':
            showNotification(message.message, 'success');
            break;
        case 'error':
            showNotification(message.message, 'error');
            break;
    }
}

// Update dashboard with received data
function updateDashboard(data) {
    // Update temperature
    if (data.temperature) {
        document.getElementById('current-temp').textContent = data.temperature.toFixed(1);
        updateChart(data.temperature);
    }
    
    // Update day information
    if (data.cycle_day) {
        document.getElementById('current-day').textContent = `Day ${data.cycle_day}`;
    }
    
    if (data.total_days) {
        document.getElementById('total-days').textContent = `${data.total_days} Days`;
        document.getElementById('total-days-value').textContent = data.total_days;
    }
    
    // Update temperature settings
    if (data.max_temp) {
        document.getElementById('max-temp').textContent = `${data.max_temp}°C`;
        document.getElementById('max-temp-value').textContent = data.max_temp;
    }
    
    if (data.min_temp) {
        document.getElementById('min-temp').textContent = `${data.min_temp}°C`;
        document.getElementById('min-temp-value').textContent = data.min_temp;
    }
    
    // Update heater status
    if (data.relay_status) {
        const heaterStatus = document.getElementById('heater-status');
        heaterStatus.textContent = data.relay_status;
        heaterStatus.style.color = data.relay_status === 'ON' ? '#e74c3c' : '#2c3e50';
    }
    
    // Update sensor data
    if (data.sensors) {
        if (data.sensors.temp1 && data.sensors.temp1 !== "NaN") {
            document.getElementById('sensor1-temp').textContent = parseFloat(data.sensors.temp1).toFixed(1);
        }
        if (data.sensors.temp2 && data.sensors.temp2 !== "NaN") {
            document.getElementById('sensor2-temp').textContent = parseFloat(data.sensors.temp2).toFixed(1);
        }
        if (data.sensors.temp3 && data.sensors.temp3 !== "NaN") {
            document.getElementById('sensor3-temp').textContent = parseFloat(data.sensors.temp3).toFixed(1);
        }
        if (data.sensors.temp4 && data.sensors.temp4 !== "NaN") {
            document.getElementById('sensor4-temp').textContent = parseFloat(data.sensors.temp4).toFixed(1);
        }
        
        // Update sensor active states
        document.getElementById('sensor1-toggle').checked = data.sensors.s1_active;
        document.getElementById('sensor2-toggle').checked = data.sensors.s2_active;
        document.getElementById('sensor3-toggle').checked = data.sensors.s3_active;
        document.getElementById('sensor4-toggle').checked = data.sensors.s4_active;
        
        updateSensorDisplay();
    }
    
    // Update weekly reduction toggle
    if (data.weekly_reduce_enabled !== undefined) {
        document.getElementById('weekly-reduce-toggle').checked = data.weekly_reduce_enabled;
    }
    
    // Update system mode
    if (data.mode) {
        document.getElementById('system-status').textContent = data.mode;
    }
    
    // Update error status
    if (data.error && data.error !== "OK") {
        document.getElementById('error-message').textContent = data.error;
        document.getElementById('error-alert').style.display = 'flex';
    } else {
        document.getElementById('error-alert').style.display = 'none';
    }
    
    // Update last update time
    document.getElementById('last-update-value').textContent = new Date().toLocaleTimeString();
}

// Update temperature chart
function updateChart(temperature) {
    const now = new Date();
    const timeLabel = now.getHours() + ':' + now.getMinutes().toString().padStart(2, '0');
    
    tempData.labels.push(timeLabel);
    tempData.datasets[0].data.push(temperature);
    
    // Keep only last 20 data points
    if (tempData.labels.length > 20) {
        tempData.labels.shift();
        tempData.datasets[0].data.shift();
    }
    
    tempChart.update();
}

// Update sensor display based on active state
function updateSensorDisplay() {
    for (let i = 1; i <= 4; i++) {
        const sensorElement = document.querySelector(`.sensor-item:nth-child(${i})`);
        const toggle = document.getElementById(`sensor${i}-toggle`);
        
        if (toggle.checked) {
            sensorElement.classList.add('active');
            sensorElement.classList.remove('inactive');
        } else {
            sensorElement.classList.add('inactive');
            sensorElement.classList.remove('active');
        }
    }
}

// Update connection status display
function updateConnectionStatus(connected) {
    const statusElement = document.getElementById('connection-status');
    const dotElement = document.getElementById('connection-dot');
    const textElement = document.getElementById('connection-text');
    const serverStatus = document.getElementById('server-status');
    const mqttStatus = document.getElementById('mqtt-status');
    
    if (connected) {
        statusElement.className = 'connection-status connected';
        textElement.textContent = 'Connected to Broodinnox Server';
        serverStatus.textContent = 'Connected';
        serverStatus.style.color = '#27ae60';
        mqttStatus.textContent = 'Connected';
        mqttStatus.style.color = '#27ae60';
    } else {
        statusElement.className = 'connection-status disconnected';
        textElement.textContent = 'Disconnected from Server';
        serverStatus.textContent = 'Disconnected';
        serverStatus.style.color = '#e74c3c';
        mqttStatus.textContent = 'Disconnected';
        mqttStatus.style.color = '#e74c3c';
    }
}

// Update current time
function updateTime() {
    const now = new Date();
    document.getElementById('current-time-value').textContent = 
        now.getHours().toString().padStart(2, '0') + ':' + 
        now.getMinutes().toString().padStart(2, '0') + ':' + 
        now.getSeconds().toString().padStart(2, '0');
}

// Send control command to server
function sendControlCommand(topic, value) {
    if (isConnected && ws) {
        ws.send(JSON.stringify({
            type: 'control',
            topic: topic,
            value: value
        }));
    } else {
        showNotification('Not connected to server', 'error');
    }
}

// Show notification
function showNotification(message, type) {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `alert alert-${type}`;
    notification.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-triangle'}"></i>
        <span>${message}</span>
    `;
    
    // Add to page
    document.querySelector('.container').insertBefore(notification, document.querySelector('.dashboard'));
    
    // Remove after 3 seconds
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

// Control functions
function adjustTemperature(type, change) {
    const currentElement = document.getElementById(`${type}-temp-value`);
    let currentValue = parseInt(currentElement.textContent);
    let newValue = currentValue + change;
    
    // Apply constraints
    if (type === 'max') {
        if (newValue <= parseInt(document.getElementById('min-temp-value').textContent)) {
            newValue = parseInt(document.getElementById('min-temp-value').textContent) + 1;
        }
        if (newValue > 45) newValue = 45;
    } else {
        if (newValue >= parseInt(document.getElementById('max-temp-value').textContent)) {
            newValue = parseInt(document.getElementById('max-temp-value').textContent) - 1;
        }
        if (newValue < 10) newValue = 10;
    }
    
    currentElement.textContent = newValue;
    sendControlCommand(
        type === 'max' ? 'broodinnox/control/max_temp' : 'broodinnox/control/min_temp',
        newValue.toString()
    );
}

function setHeaterMode(mode) {
    sendControlCommand('broodinnox/control/relay', mode === 'AUTO' ? 'AUTO' : 'MANUAL');
}

function setHeaterState(state) {
    sendControlCommand('broodinnox/control/relay', state);
}

function setSystemMode(mode) {
    sendControlCommand('broodinnox/control/mode', mode);
}

function forceReduceTemp() {
    sendControlCommand('broodinnox/control/reduce_now', 'NOW');
}

function toggleWeeklyReduce() {
    const enabled = document.getElementById('weekly-reduce-toggle').checked;
    sendControlCommand(
        'broodinnox/control/weekly_reduce',
        enabled ? 'ON' : 'OFF'
    );
}

function adjustTotalDays(change) {
    const currentElement = document.getElementById('total-days-value');
    let currentValue = parseInt(currentElement.textContent);
    let newValue = currentValue + change;
    
    if (newValue < 1) newValue = 1;
    if (newValue > 365) newValue = 365;
    
    currentElement.textContent = newValue;
    sendControlCommand('broodinnox/control/total_days', newValue.toString());
}

function toggleSensor(sensorNum) {
    const enabled = document.getElementById(`sensor${sensorNum}-toggle`).checked;
    sendControlCommand(
        'broodinnox/control/sensor',
        `${sensorNum}:${enabled ? 'ON' : 'OFF'}`
    );
    updateSensorDisplay();
}
