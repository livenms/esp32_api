const socket = io();
let chartInstance = null;
let tempHistory = [];

// Initialize chart
function initChart() {
    const ctx = document.getElementById('tempChart').getContext('2d');
    chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: Array.from({length: 20}, (_, i) => i + 1),
            datasets: [{
                label: 'Average Temperature (°C)',
                data: [],
                borderColor: '#f9b43a',
                backgroundColor: 'rgba(249, 180, 58, 0.1)',
                tension: 0.3,
                fill: true,
                pointBackgroundColor: '#ffd966'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { labels: { color: '#ddd' } }
            },
            scales: {
                y: {
                    grid: { color: '#2e4a42' },
                    title: { display: true, text: '°C', color: '#ccc' }
                }
            }
        }
    });
}

// Update UI with device data
function updateUI(data) {
    // Temperature display
    const avgTemp = data.ave_temp !== null && !isNaN(data.ave_temp) ? data.ave_temp.toFixed(1) : '--';
    document.getElementById('avgTemp').innerHTML = avgTemp;
    
    // Setpoints
    document.getElementById('maxTempVal').innerText = data.max_temp;
    document.getElementById('minTempVal').innerText = data.min_temp;
    document.getElementById('totalDaysVal').innerText = data.total_days;
    document.getElementById('currentDay').innerText = data.day;
    document.getElementById('totalDaysSpan').innerText = data.total_days;
    
    // Sliders
    document.getElementById('maxTempSlider').value = data.max_temp;
    document.getElementById('minTempSlider').value = data.min_temp;
    document.getElementById('totalDaysSlider').value = data.total_days;
    
    // Relay state
    const relayText = data.relay_state ? '🔥 ON (Heating)' : '❄️ OFF';
    document.getElementById('relayStateText').innerHTML = relayText;
    
    // Mode buttons
    const autoBtn = document.getElementById('relayAutoBtn');
    const onBtn = document.getElementById('relayOnBtn');
    const offBtn = document.getElementById('relayOffBtn');
    
    if (!data.manual_control) {
        autoBtn.classList.add('toggle-active');
        onBtn.classList.remove('toggle-active');
        offBtn.classList.remove('toggle-active');
    } else {
        autoBtn.classList.remove('toggle-active');
        if (data.relay_state) onBtn.classList.add('toggle-active');
        else offBtn.classList.add('toggle-active');
    }
    
    // Status indicators
    document.getElementById('failsafeStatus').innerHTML = data.failsafe_mode ? '⚠️ ACTIVE' : 'Normal';
    document.getElementById('signalQuality').innerHTML = data.signal_quality || '0';
    document.getElementById('weeklyReduceStatus').innerHTML = data.weekly_reduce_enabled ? '✅ Enabled' : 'Disabled';
    document.getElementById('deviceStatus').innerHTML = data.relay_state ? 'HEATING' : 'IDLE';
    
    // Sensors grid
    const sensors = [
        {label: 'DS1', temp: data.sensor1, enabled: data.s1_enabled},
        {label: 'DS2', temp: data.sensor2, enabled: data.s2_enabled},
        {label: 'DS3', temp: data.sensor3, enabled: data.s3_enabled},
        {label: 'DS4', temp: data.sensor4, enabled: data.s4_enabled}
    ];
    
    const sensorsHtml = sensors.map(s => {
        const val = (s.temp !== null && !isNaN(s.temp)) ? s.temp.toFixed(1) + '°C' : (s.enabled ? 'ERR' : 'Disabled');
        return `<div class="sensor-chip">
                    <div class="sensor-label">${s.label}</div>
                    <div class="sensor-value" style="color:${s.enabled ? '#ffd966' : '#7f8c8d'}">${val}</div>
                </div>`;
    }).join('');
    document.getElementById('sensorList').innerHTML = sensorsHtml;
    
    // Warnings
    let warnings = [];
    if (data.sensor_error) warnings.push('⚠️ Sensor failure detected');
    if (data.mismatch_error) warnings.push('⚠️ Temperature mismatch between sensors');
    if (data.failsafe_mode) warnings.push('🔥 FAILSAFE ACTIVE: Heater forced ON');
    document.getElementById('sensorWarnings').innerHTML = warnings.join(' | ') || 'All sensors nominal';
    
    // Sensor toggle panel
    const togglePanel = document.getElementById('sensorTogglePanel');
    const sensorsToggle = [
        {id: 'DS1', enabled: data.s1_enabled, idx: 1},
        {id: 'DS2', enabled: data.s2_enabled, idx: 2},
        {id: 'DS3', enabled: data.s3_enabled, idx: 3},
        {id: 'DS4', enabled: data.s4_enabled, idx: 4}
    ];
    
    togglePanel.innerHTML = sensorsToggle.map(s => {
        return `<div class="toggle-btn ${s.enabled ? 'toggle-active' : ''}" onclick="toggleSensor('${s.id}', ${!s.enabled})">
                    ${s.id} ${s.enabled ? 'ON' : 'OFF'}
                </div>`;
    }).join('');
    
    // Last seen
    if (data.timestamp) {
        const d = new Date(data.timestamp * 1000);
        document.getElementById('lastSeen').innerHTML = d.toLocaleTimeString();
    }
    
    // Update chart
    if (data.ave_temp !== null && !isNaN(data.ave_temp)) {
        tempHistory.push(data.ave_temp);
        if (tempHistory.length > 20) tempHistory.shift();
        if (chartInstance) {
            chartInstance.data.datasets[0].data = [...tempHistory];
            chartInstance.update();
        }
    }
}

// Control functions
function sendControl(command, value) {
    fetch(`/api/control/${command}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value })
    }).catch(err => console.error('Control error:', err));
}

function toggleSensor(sensorId, enable) {
    const cmd = `${sensorId}:${enable ? 'ON' : 'OFF'}`;
    sendControl('sensor', cmd);
}

// Socket events
socket.on('connect', () => {
    console.log('Connected to server');
    document.getElementById('mqttStatus').innerHTML = '🟢 Online';
    document.getElementById('mqttStatus').style.color = '#2ecc71';
});

socket.on('disconnect', () => {
    console.log('Disconnected from server');
    document.getElementById('mqttStatus').innerHTML = '🔴 Offline';
    document.getElementById('mqttStatus').style.color = '#e74c3c';
});

socket.on('device_update', (data) => {
    updateUI(data);
});

// Event listeners
document.getElementById('relayAutoBtn').onclick = () => sendControl('relay', 'AUTO');
document.getElementById('relayOnBtn').onclick = () => sendControl('relay', 'ON');
document.getElementById('relayOffBtn').onclick = () => sendControl('relay', 'OFF');

document.getElementById('maxTempSlider').oninput = (e) => {
    const val = parseInt(e.target.value);
    document.getElementById('maxTempVal').innerText = val;
    sendControl('max_temp', val);
};

document.getElementById('minTempSlider').oninput = (e) => {
    const val = parseInt(e.target.value);
    document.getElementById('minTempVal').innerText = val;
    sendControl('min_temp', val);
};

document.getElementById('totalDaysSlider').oninput = (e) => {
    const val = parseInt(e.target.value);
    document.getElementById('totalDaysVal').innerText = val;
    sendControl('total_days', val);
};

document.getElementById('applyPresetBtn').onclick = () => {
    const animal = document.getElementById('animalPreset').value;
    sendControl('animal', animal);
};

document.getElementById('factoryResetBtn').onclick = () => {
    if (confirm('⚠️ FACTORY RESET will restore defaults and reboot device. Continue?')) {
        sendControl('factory_reset', 'RESET');
    }
};

// Initialize
initChart();
