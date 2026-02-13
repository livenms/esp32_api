// Socket.IO connection
const socket = io();

// Chart instance
let tempChart = null;
let chartData = [];

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  initializeChart();
  setupEventListeners();
  loadDeviceData();
});

// Socket.IO event handlers
socket.on('connect', () => {
  console.log('✅ Connected to server');
  updateConnectionStatus(true);
});

socket.on('disconnect', () => {
  console.log('❌ Disconnected from server');
  updateConnectionStatus(false);
});

socket.on('deviceUpdate', (data) => {
  console.log('📨 Device update received:', data);
  updateDashboard(data);
});

socket.on('historicalData', (data) => {
  console.log('📊 Historical data received:', data.length, 'points');
  chartData = data;
  updateChart();
});

// Update connection status
function updateConnectionStatus(connected) {
  const statusBadge = document.getElementById('deviceStatus');
  const statusText = statusBadge.querySelector('.status-text');
  
  if (connected) {
    statusBadge.classList.add('online');
    statusBadge.classList.remove('offline');
    statusText.textContent = 'Connected';
  } else {
    statusBadge.classList.remove('online');
    statusBadge.classList.add('offline');
    statusText.textContent = 'Disconnected';
  }
}

// Load initial device data
async function loadDeviceData() {
  try {
    const response = await fetch('/api/device');
    const data = await response.json();
    updateDashboard(data);
    
    // Load historical data
    const historyResponse = await fetch('/api/history?limit=100');
    const historyData = await historyResponse.json();
    chartData = historyData;
    updateChart();
  } catch (error) {
    console.error('❌ Error loading device data:', error);
    showToast('Failed to load device data', 'error');
  }
}

// Update dashboard with device data
function updateDashboard(data) {
  // Device info
  document.getElementById('deviceId').textContent = data.device_id || '-';
  document.getElementById('deviceName').textContent = data.device_name || '-';
  
  // Temperature
  const currentTemp = parseFloat(data.temperature);
  document.getElementById('currentTemp').textContent = 
    isNaN(currentTemp) ? '--' : currentTemp.toFixed(1);
  
  const maxTemp = parseInt(data.max_temp);
  const minTemp = parseInt(data.min_temp);
  
  document.getElementById('maxTemp').textContent = maxTemp || '--';
  document.getElementById('minTemp').textContent = minTemp || '--';
  
  // Update temperature status badge
  updateTempStatus(currentTemp, minTemp, maxTemp);
  
  // Individual sensors
  if (data.sensors) {
    updateSensor('sensor1', data.sensors.temp1, data.sensors.s1_active);
    updateSensor('sensor2', data.sensors.temp2, data.sensors.s2_active);
    updateSensor('sensor3', data.sensors.temp3, data.sensors.s3_active);
    updateSensor('sensor4', data.sensors.temp4, data.sensors.s4_active);
    
    // Update sensor toggles
    document.getElementById('s1Toggle').checked = data.sensors.s1_active;
    document.getElementById('s2Toggle').checked = data.sensors.s2_active;
    document.getElementById('s3Toggle').checked = data.sensors.s3_active;
    document.getElementById('s4Toggle').checked = data.sensors.s4_active;
  }
  
  // Stats
  document.getElementById('currentDay').textContent = data.cycle_day || 0;
  document.getElementById('totalDays').textContent = data.total_days || 0;
  document.getElementById('relayStatus').textContent = data.relay_status || 'OFF';
  document.getElementById('relayMode').textContent = data.relay_mode || 'AUTO';
  document.getElementById('animalType').textContent = data.animal_type || '-';
  
  // System info
  document.getElementById('systemMode').textContent = data.mode || '-';
  document.getElementById('errorStatus').textContent = data.error || 'OK';
  
  // Update error status color
  const errorElement = document.getElementById('errorStatus');
  if (data.error === 'OK') {
    errorElement.style.color = 'var(--success)';
  } else {
    errorElement.style.color = 'var(--error)';
  }
  
  // Last update
  if (data.lastSeen) {
    const lastUpdate = new Date(data.lastSeen);
    document.getElementById('lastUpdate').textContent = 
      lastUpdate.toLocaleTimeString();
  }
  
  // Update device status based on data
  if (data.status === 'online') {
    updateConnectionStatus(true);
  }
  
  // Update sliders
  if (maxTemp) {
    document.getElementById('maxTempSlider').value = maxTemp;
    document.getElementById('maxTempDisplay').textContent = maxTemp + '°C';
  }
  if (minTemp) {
    document.getElementById('minTempSlider').value = minTemp;
    document.getElementById('minTempDisplay').textContent = minTemp + '°C';
  }
  if (data.total_days) {
    document.getElementById('totalDaysSlider').value = data.total_days;
    document.getElementById('totalDaysDisplay').textContent = data.total_days + ' days';
  }
  
  // Weekly reduce toggle
  document.getElementById('weeklyReduce').checked = data.weekly_reduce_enabled !== false;
  
  // Add to chart data if temperature is valid
  if (!isNaN(currentTemp) && data.timestamp) {
    chartData.push({
      timestamp: data.timestamp,
      temperature: currentTemp,
      cycle_day: data.cycle_day,
      relay_status: data.relay_status
    });
    
    // Keep only last 1000 points
    if (chartData.length > 1000) {
      chartData = chartData.slice(-1000);
    }
    
    updateChart();
  }
}

// Update temperature status badge
function updateTempStatus(current, min, max) {
  const badge = document.getElementById('tempStatus');
  
  if (isNaN(current) || isNaN(min) || isNaN(max)) {
    badge.textContent = 'N/A';
    badge.className = 'temp-badge';
    return;
  }
  
  if (current < min - 2) {
    badge.textContent = 'TOO COLD';
    badge.className = 'temp-badge danger';
  } else if (current < min) {
    badge.textContent = 'BELOW MIN';
    badge.className = 'temp-badge warning';
  } else if (current > max + 2) {
    badge.textContent = 'TOO HOT';
    badge.className = 'temp-badge danger';
  } else if (current > max) {
    badge.textContent = 'ABOVE MAX';
    badge.className = 'temp-badge warning';
  } else {
    badge.textContent = 'NORMAL';
    badge.className = 'temp-badge';
  }
}

// Update individual sensor display
function updateSensor(sensorId, value, isActive) {
  const sensor = document.getElementById(sensorId);
  const valueElement = sensor.querySelector('.sensor-value');
  
  if (!isActive) {
    sensor.classList.add('inactive');
    sensor.classList.remove('error');
    valueElement.textContent = 'DISABLED';
  } else if (value === 'NaN' || value === 'N/A' || isNaN(parseFloat(value))) {
    sensor.classList.add('error');
    sensor.classList.remove('inactive');
    valueElement.textContent = 'ERROR';
  } else {
    sensor.classList.remove('inactive', 'error');
    valueElement.textContent = parseFloat(value).toFixed(1) + '°C';
  }
}

// Initialize Chart.js
function initializeChart() {
  const ctx = document.getElementById('tempChart').getContext('2d');
  
  tempChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [{
        label: 'Temperature (°C)',
        data: [],
        borderColor: '#FF6B35',
        backgroundColor: 'rgba(255, 107, 53, 0.1)',
        borderWidth: 2,
        fill: true,
        tension: 0.4,
        pointRadius: 0,
        pointHoverRadius: 4,
        pointHoverBackgroundColor: '#FF6B35',
        pointHoverBorderColor: '#fff',
        pointHoverBorderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        intersect: false,
        mode: 'index'
      },
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          backgroundColor: '#1A2028',
          titleColor: '#A0AEC0',
          bodyColor: '#FFFFFF',
          borderColor: '#2D3748',
          borderWidth: 1,
          padding: 12,
          displayColors: false,
          callbacks: {
            title: (context) => {
              const date = new Date(context[0].label);
              return date.toLocaleString();
            },
            label: (context) => {
              return `Temperature: ${context.parsed.y.toFixed(1)}°C`;
            }
          }
        }
      },
      scales: {
        x: {
          type: 'time',
          time: {
            unit: 'minute',
            displayFormats: {
              minute: 'HH:mm',
              hour: 'HH:mm'
            }
          },
          grid: {
            color: '#2D3748',
            drawBorder: false
          },
          ticks: {
            color: '#718096',
            font: {
              family: 'JetBrains Mono',
              size: 10
            }
          }
        },
        y: {
          beginAtZero: false,
          grid: {
            color: '#2D3748',
            drawBorder: false
          },
          ticks: {
            color: '#718096',
            font: {
              family: 'JetBrains Mono',
              size: 10
            },
            callback: (value) => value + '°C'
          }
        }
      }
    }
  });
}

// Update chart with latest data
function updateChart() {
  if (!tempChart || chartData.length === 0) return;
  
  const labels = chartData.map(d => d.timestamp * 1000); // Convert to ms
  const temperatures = chartData.map(d => d.temperature);
  
  tempChart.data.labels = labels;
  tempChart.data.datasets[0].data = temperatures;
  tempChart.update('none'); // Update without animation for performance
}

// Setup event listeners
function setupEventListeners() {
  // Slider inputs
  document.getElementById('maxTempSlider').addEventListener('input', (e) => {
    document.getElementById('maxTempDisplay').textContent = e.target.value + '°C';
  });
  
  document.getElementById('minTempSlider').addEventListener('input', (e) => {
    document.getElementById('minTempDisplay').textContent = e.target.value + '°C';
  });
  
  document.getElementById('totalDaysSlider').addEventListener('input', (e) => {
    document.getElementById('totalDaysDisplay').textContent = e.target.value + ' days';
  });
  
  // Chart range buttons
  document.querySelectorAll('.chart-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.chart-btn').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      
      const range = e.target.dataset.range;
      updateChartRange(range);
    });
  });
  
  // Weekly reduce toggle
  document.getElementById('weeklyReduce').addEventListener('change', async (e) => {
    try {
      const response = await fetch('/api/control/weekly-reduce', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: e.target.checked })
      });
      
      if (response.ok) {
        showToast(`Weekly reduction ${e.target.checked ? 'enabled' : 'disabled'}`);
      } else {
        throw new Error('Failed to update setting');
      }
    } catch (error) {
      console.error('Error:', error);
      showToast('Failed to update weekly reduction', 'error');
      e.target.checked = !e.target.checked;
    }
  });
}

// Update chart time range
function updateChartRange(range) {
  if (!tempChart) return;
  
  let unit, stepSize;
  
  switch (range) {
    case '1h':
      unit = 'minute';
      stepSize = 5;
      break;
    case '6h':
      unit = 'minute';
      stepSize = 30;
      break;
    case '24h':
      unit = 'hour';
      stepSize = 2;
      break;
    default:
      unit = 'minute';
      stepSize = 5;
  }
  
  tempChart.options.scales.x.time.unit = unit;
  tempChart.options.scales.x.time.stepSize = stepSize;
  tempChart.update();
}

// Control Functions

// Relay control
async function controlRelay(command) {
  try {
    const response = await fetch('/api/control/relay', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command })
    });
    
    if (response.ok) {
      showToast(`Heater ${command.toLowerCase()}`);
    } else {
      throw new Error('Failed to control relay');
    }
  } catch (error) {
    console.error('Error:', error);
    showToast('Failed to control heater', 'error');
  }
}

// Apply temperature and days settings
async function applySettings() {
  const maxTemp = parseInt(document.getElementById('maxTempSlider').value);
  const minTemp = parseInt(document.getElementById('minTempSlider').value);
  const totalDays = parseInt(document.getElementById('totalDaysSlider').value);
  
  // Validate
  if (minTemp >= maxTemp) {
    showToast('Min temperature must be less than max temperature', 'error');
    return;
  }
  
  try {
    // Update temperatures
    const tempResponse = await fetch('/api/control/temperature', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ max_temp: maxTemp, min_temp: minTemp })
    });
    
    // Update total days
    const daysResponse = await fetch('/api/control/total-days', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ total_days: totalDays })
    });
    
    if (tempResponse.ok && daysResponse.ok) {
      showToast('Settings applied successfully');
    } else {
      throw new Error('Failed to apply settings');
    }
  } catch (error) {
    console.error('Error:', error);
    showToast('Failed to apply settings', 'error');
  }
}

// Reduce temperature now
async function reduceNow() {
  try {
    const response = await fetch('/api/control/reduce-now', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (response.ok) {
      showToast('Temperature reduction triggered');
    } else {
      throw new Error('Failed to reduce temperature');
    }
  } catch (error) {
    console.error('Error:', error);
    showToast('Failed to reduce temperature', 'error');
  }
}

// Toggle sensor
async function toggleSensor(sensor, enabled) {
  try {
    const response = await fetch('/api/control/sensor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        sensor: sensor, 
        state: enabled ? 'ON' : 'OFF' 
      })
    });
    
    if (response.ok) {
      showToast(`Sensor ${sensor} ${enabled ? 'enabled' : 'disabled'}`);
    } else {
      throw new Error('Failed to toggle sensor');
    }
  } catch (error) {
    console.error('Error:', error);
    showToast('Failed to toggle sensor', 'error');
  }
}

// Toast notification
function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  const toastMessage = toast.querySelector('.toast-message');
  const toastIcon = toast.querySelector('.toast-icon');
  
  toastMessage.textContent = message;
  toast.className = 'toast';
  
  if (type === 'error') {
    toast.classList.add('error');
    toastIcon.textContent = '✗';
  } else if (type === 'warning') {
    toast.classList.add('warning');
    toastIcon.textContent = '⚠';
  } else {
    toastIcon.textContent = '✓';
  }
  
  toast.classList.add('show');
  
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

// Utility function to format timestamps
function formatTimestamp(timestamp) {
  const date = new Date(timestamp * 1000);
  return date.toLocaleString();
}
