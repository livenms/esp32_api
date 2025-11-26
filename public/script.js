// WebSocket and application state
let ws = null;
let isConnected = false;
let reconnectAttempts = 0;
const maxReconnectAttempts = 10;
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
    
    // Date controls
    document.getElementById('update-date-btn').addEventListener('click', updateStartDate);
    document.getElementById('start-date-picker').addEventListener('change', function() {
        document.getElementById('update-date-btn').disabled = false;
    });
    
    // Manual date controls
    document.getElementById('inc-start-year').addEventListener('click', () => adjustStartDate('year', 1));
    document.getElementById('dec-start-year').addEventListener('click', () => adjustStartDate('year', -1));
    document.getElementById('inc-start-month').addEventListener('click', () => adjustStartDate('month', 1));
    document.getElementById('dec-start-month').addEventListener('click', () => adjustStartDate('month', -1));
    document.getElementById('inc-start-day').addEventListener('click', () => adjustStartDate('day', 1));
    document.getElementById('dec-start-day').addEventListener('click', () => adjustStartDate('day', -1));
}

// Connect to WebSocket server
function connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    
    try {
        console.log(`🔗 Connecting to WebSocket: ${wsUrl}`);
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
        
        ws.onclose = (event) => {
            console.log('🔌 Disconnected from server:', event.code, event.reason);
            isConnected = false;
            updateConnectionStatus(false);
            
            // Attempt to reconnect
            if (reconnectAttempts < maxReconnectAttempts) {
                reconnectAttempts++;
                const delay = reconnectDelay * Math.pow(1.5, reconnectAttempts - 1);
                console.log(`🔄 Attempting to reconnect in ${delay}ms... (${reconnectAttempts}/${maxReconnectAttempts})`);
                setTimeout(connectWebSocket, delay);
            } else {
                console.error('❌ Max reconnection attempts reached');
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
    // Update device information
    if (data.device_id) {
        document.getElementById('device-id').textContent = data.device_id;
        document.getElementById('footer-device-id').textContent = data.device_id;
    }
    
    if (data.device_name) {
        document.title = `Broodinnox - ${data.device_name}`;
    }
    
    // Update temperature
    if (data.temperature !== undefined) {
        document.getElementById('current-temp').textContent = data.temperature.toFixed(1);
        updateChart(data.temperature);
    }
    
    // Update day information
    if (data.cycle_day !== undefined) {
        document.getElementById('current-day').textContent = `Day ${data.cycle_day}`;
    }
    
    if (data.total_days !== undefined) {
        document.getElementById('total-days').textContent = `${data.total_days} Days`;
        document.getElementById('total-days-value').textContent = data.total_days;
    }
    
    // Update temperature settings
    if (data.max_temp !== undefined) {
        document.getElementById('max-temp').textContent = `${data.max_temp}°C`;
        document.getElementById('max-temp-value').textContent = data.max_temp;
    }
    
    if (data.min_temp !== undefined) {
        document.getElementById('min-temp').textContent = `${data.min_temp}°C`;
        document.getElementById('min-temp-value').textContent = data.min_temp;
    }
    
    // Update heater status
    if (data.relay_status) {
        const heaterStatus = document.getElementById('heater-status');
        heaterStatus.textContent = data.relay_status;
        heaterStatus.style.color = data.relay_status === 'ON' ? '#e74c3c' : '#2c3e50';
    }
    
    // Update heater mode
    if (data.relay_mode) {
        document.getElementById('heater-mode').textContent = data.relay_mode;
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
        if (data.sensors.s1_active !== undefined) {
            document.getElementById('sensor1-toggle').checked = data.sensors.s1_active;
        }
        if (data.sensors.s2_active !== undefined) {
            document.getElementById('sensor2-toggle').checked = data.sensors.s2_active;
        }
        if (data.sensors.s3_active !== undefined) {
            document.getElementById('sensor3-toggle').checked = data.sensors.s3_active;
        }
        if (data.sensors.s4_active !== undefined) {
            document.getElementById('sensor4-toggle').checked = data.sensors.s4_active;
        }
        
        updateSensorDisplay();
    }
    
    // Update weekly reduction toggle
    if (data.weekly_reduce_enabled !== undefined) {
        document.getElementById('weekly-reduce-toggle').checked = data.weekly_reduce_enabled;
    }
    
    // Update system mode
    if (data.mode) {
        document.getElementById('system-status').textContent = data.mode;
        // Update button states based on mode
        const onlineBtn = document.getElementById('online-mode-btn');
        const offlineBtn = document.getElementById('offline-mode-btn');
        if (data.mode === 'ONLINE') {
            onlineBtn.classList.add('active');
            offlineBtn.classList.remove('active');
        } else {
            onlineBtn.classList.remove('active');
            offlineBtn.classList.add('active');
        }
    }
    
    // Update start date information
    updateStartDateDisplay(data);
    
    // Update error status
    if (data.error && data.error !== "OK") {
        document.getElementById('error-message').textContent = data.error;
        document.getElementById('error-alert').style.display = 'flex';
    } else {
        document.getElementById('error-alert').style.display = 'none';
    }
    
    // Update last update time
    document.getElementById('last-update-value').textContent = new Date().toLocaleTimeString();
    
    // Update WiFi status
    if (data.rssi !== undefined) {
        const wifiStatus = document.getElementById('wifi-status');
        wifiStatus.textContent = `Connected (${data.rssi} dBm)`;
        wifiStatus.style.color = data.rssi > -70 ? '#27ae60' : data.rssi > -80 ? '#f39c12' : '#e74c3c';
    }
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
        
        if (sensorElement && toggle) {
            if (toggle.checked) {
                sensorElement.classList.add('active');
                sensorElement.classList.remove('inactive');
            } else {
                sensorElement.classList.add('inactive');
                sensorElement.classList.remove('active');
            }
        }
    }
}

// Update start date display
function updateStartDateDisplay(data) {
    if (data.start_date) {
        // If start_date is provided in the data
        document.getElementById('current-start-date').textContent = data.start_date;
    } else if (data.starting_year && data.starting_month && data.starting_day) {
        // If individual components are provided
        const formattedDate = `${data.starting_year}-${data.starting_month.toString().padStart(2, '0')}-${data.starting_day.toString().padStart(2, '0')}`;
        document.getElementById('current-start-date').textContent = formattedDate;
        
        // Update manual controls
        document.getElementById('start-year-value').textContent = data.starting_year;
        document.getElementById('start-month-value').textContent = data.starting_month;
        document.getElementById('start-day-value').textContent = data.starting_day;
        
        // Update date picker
        document.getElementById('start-date-picker').value = formattedDate;
        document.getElementById('update-date-btn').disabled = true;
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
        if (serverStatus) serverStatus.textContent = 'Connected';
        if (serverStatus) serverStatus.style.color = '#27ae60';
        if (mqttStatus) mqttStatus.textContent = 'Connected';
        if (mqttStatus) mqttStatus.style.color = '#27ae60';
    } else {
        statusElement.className = 'connection-status disconnected';
        textElement.textContent = `Disconnected from Server (Retrying ${reconnectAttempts}/${maxReconnectAttempts})`;
        if (serverStatus) serverStatus.textContent = 'Disconnected';
        if (serverStatus) serverStatus.style.color = '#e74c3c';
        if (mqttStatus) mqttStatus.textContent = 'Disconnected';
        if (mqttStatus) mqttStatus.style.color = '#e74c3c';
    }
}

// Update current time
function updateTime() {
    const now = new Date();
    const timeElement = document.getElementById('current-time-value');
    if (timeElement) {
        timeElement.textContent = 
            now.getHours().toString().padStart(2, '0') + ':' + 
            now.getMinutes().toString().padStart(2, '0') + ':' + 
            now.getSeconds().toString().padStart(2, '0');
    }
}

// Send control command to server
function sendControlCommand(topic, value) {
    if (isConnected && ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
            type: 'control',
            topic: topic,
            value: value
        }));
        console.log(`📤 Sent control command: ${topic} = ${value}`);
    } else {
        showNotification('Not connected to server', 'error');
        console.error('WebSocket not connected, cannot send command');
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
    const container = document.querySelector('.container');
    if (container) {
        container.insertBefore(notification, document.querySelector('.dashboard'));
        
        // Remove after 3 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 3000);
    }
}

// Control functions
function adjustTemperature(type, change) {
    const currentElement = document.getElementById(`${type}-temp-value`);
    if (!currentElement) return;
    
    let currentValue = parseInt(currentElement.textContent);
    let newValue = currentValue + change;
    
    // Apply constraints
    if (type === 'max') {
        const minTempElement = document.getElementById('min-temp-value');
        if (minTempElement) {
            const minTemp = parseInt(minTempElement.textContent);
            if (newValue <= minTemp) {
                newValue = minTemp + 1;
            }
        }
        if (newValue > 45) newValue = 45;
    } else {
        const maxTempElement = document.getElementById('max-temp-value');
        if (maxTempElement) {
            const maxTemp = parseInt(maxTempElement.textContent);
            if (newValue >= maxTemp) {
                newValue = maxTemp - 1;
            }
        }
        if (newValue < 10) newValue = 10;
    }
    
    currentElement.textContent = newValue;
    sendControlCommand(
        `broodinnox/BROODINNOX-001/control/${type}_temp`,
        newValue.toString()
    );
}

function setHeaterMode(mode) {
    sendControlCommand('broodinnox/BROODINNOX-001/control/relay', mode === 'AUTO' ? 'AUTO' : 'MANUAL');
}

function setHeaterState(state) {
    sendControlCommand('broodinnox/BROODINNOX-001/control/relay', state);
}

function setSystemMode(mode) {
    sendControlCommand('broodinnox/BROODINNOX-001/control/mode', mode);
}

function forceReduceTemp() {
    sendControlCommand('broodinnox/BROODINNOX-001/control/reduce_now', 'NOW');
}

function toggleWeeklyReduce() {
    const toggle = document.getElementById('weekly-reduce-toggle');
    if (toggle) {
        const enabled = toggle.checked;
        sendControlCommand(
            'broodinnox/BROODINNOX-001/control/weekly_reduce',
            enabled ? 'ON' : 'OFF'
        );
    }
}

function adjustTotalDays(change) {
    const currentElement = document.getElementById('total-days-value');
    if (!currentElement) return;
    
    let currentValue = parseInt(currentElement.textContent);
    let newValue = currentValue + change;
    
    if (newValue < 1) newValue = 1;
    if (newValue > 365) newValue = 365;
    
    currentElement.textContent = newValue;
    sendControlCommand('broodinnox/BROODINNOX-001/control/total_days', newValue.toString());
}

function toggleSensor(sensorNum) {
    const toggle = document.getElementById(`sensor${sensorNum}-toggle`);
    if (toggle) {
        const enabled = toggle.checked;
        sendControlCommand(
            'broodinnox/BROODINNOX-001/control/sensor',
            `${sensorNum}:${enabled ? 'ON' : 'OFF'}`
        );
        updateSensorDisplay();
    }
}

// Date control functions
function updateStartDate() {
    const datePicker = document.getElementById('start-date-picker');
    const selectedDate = datePicker.value;
    
    if (selectedDate) {
        sendControlCommand('broodinnox/BROODINNOX-001/control/start_date', selectedDate);
        document.getElementById('update-date-btn').disabled = true;
        showNotification('Start date updated successfully', 'success');
    } else {
        showNotification('Please select a valid date', 'error');
    }
}

function adjustStartDate(type, change) {
    const currentElement = document.getElementById(`start-${type}-value`);
    if (!currentElement) return;
    
    let currentValue = parseInt(currentElement.textContent);
    let newValue = currentValue + change;
    
    // Apply constraints
    switch (type) {
        case 'year':
            if (newValue < 2020) newValue = 2020;
            if (newValue > 2030) newValue = 2030;
            break;
        case 'month':
            if (newValue < 1) newValue = 1;
            if (newValue > 12) newValue = 12;
            break;
        case 'day':
            if (newValue < 1) newValue = 1;
            if (newValue > 31) newValue = 31;
            break;
    }
    
    currentElement.textContent = newValue;
    
    // Format date as YYYY-MM-DD and send
    const year = document.getElementById('start-year-value').textContent;
    const month = document.getElementById('start-month-value').textContent.padStart(2, '0');
    const day = document.getElementById('start-day-value').textContent.padStart(2, '0');
    const formattedDate = `${year}-${month}-${day}`;
    
    sendControlCommand('broodinnox/BROODINNOX-001/control/start_date', formattedDate);
    showNotification('Start date updated successfully', 'success');
}
