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
        if (data.sensors.temp3 &&
