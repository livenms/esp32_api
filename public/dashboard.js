class Dashboard {
    constructor(user) {
        this.user = user;
        this.deviceStatus = null;
        this.tempChart = null;
        this.updateInterval = null;
    }
    
    render() {
        const html = `
            <div class="container-fluid">
                <!-- Navbar -->
                <nav class="navbar navbar-expand-lg navbar-dark bg-dark">
                    <div class="container-fluid">
                        <a class="navbar-brand" href="#">
                            <i class="fas fa-egg"></i> Broodinnox Pro
                        </a>
                        <div class="navbar-nav ms-auto">
                            <span class="nav-link">
                                <i class="fas fa-user"></i> ${this.user.username}
                            </span>
                            <a class="nav-link" href="#" onclick="app.logout()">
                                <i class="fas fa-sign-out-alt"></i> Logout
                            </a>
                        </div>
                    </div>
                </nav>
                
                <!-- Main Content -->
                <div class="container mt-4">
                    <!-- Stats Cards -->
                    <div class="row mb-4">
                        <div class="col-md-3">
                            <div class="card stat-card">
                                <div class="card-body">
                                    <i class="fas fa-thermometer-half stat-icon"></i>
                                    <h5 class="card-title">Temperature</h5>
                                    <h2 id="temperature" class="stat-value">--°C</h2>
                                </div>
                            </div>
                        </div>
                        <div class="col-md-3">
                            <div class="card stat-card">
                                <div class="card-body">
                                    <i class="fas fa-tint stat-icon"></i>
                                    <h5 class="card-title">Humidity</h5>
                                    <h2 id="humidity" class="stat-value">--%</h2>
                                </div>
                            </div>
                        </div>
                        <div class="col-md-3">
                            <div class="card stat-card">
                                <div class="card-body">
                                    <i class="fas fa-fire stat-icon"></i>
                                    <h5 class="card-title">Heater</h5>
                                    <h2 id="heaterStatus" class="stat-value">--</h2>
                                </div>
                            </div>
                        </div>
                        <div class="col-md-3">
                            <div class="card stat-card">
                                <div class="card-body">
                                    <i class="fas fa-calendar stat-icon"></i>
                                    <h5 class="card-title">Day</h5>
                                    <h2 id="currentDay" class="stat-value">0/0</h2>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Charts and Controls Row -->
                    <div class="row">
                        <!-- Temperature Chart -->
                        <div class="col-md-8">
                            <div class="card">
                                <div class="card-header">
                                    <h5><i class="fas fa-chart-line"></i> Temperature History</h5>
                                </div>
                                <div class="card-body">
                                    <canvas id="tempChart"></canvas>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Control Panel -->
                        <div class="col-md-4">
                            <div class="card">
                                <div class="card-header">
                                    <h5><i class="fas fa-sliders-h"></i> Controls</h5>
                                </div>
                                <div class="card-body">
                                    <div class="mb-3">
                                        <label>Max Temperature (°C)</label>
                                        <input type="number" id="maxTemp" class="form-control" step="1">
                                    </div>
                                    <div class="mb-3">
                                        <label>Min Temperature (°C)</label>
                                        <input type="number" id="minTemp" class="form-control" step="1">
                                    </div>
                                    <div class="mb-3">
                                        <label>Total Days</label>
                                        <input type="number" id="totalDays" class="form-control">
                                    </div>
                                    <div class="d-grid gap-2">
                                        <button class="btn btn-success" onclick="dashboard.setRelay('ON')">
                                            <i class="fas fa-power-off"></i> Heater ON
                                        </button>
                                        <button class="btn btn-danger" onclick="dashboard.setRelay('OFF')">
                                            <i class="fas fa-power-off"></i> Heater OFF
                                        </button>
                                        <button class="btn btn-primary" onclick="dashboard.setRelay('AUTO')">
                                            <i class="fas fa-robot"></i> Auto Mode
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Alerts Section -->
                    <div class="row mt-4">
                        <div class="col-12">
                            <div class="card">
                                <div class="card-header">
                                    <h5><i class="fas fa-bell"></i> Recent Alerts</h5>
                                </div>
                                <div class="card-body">
                                    <div id="alertsList"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.getElementById('root').innerHTML = html;
        this.initChart();
        this.loadData();
        this.startAutoRefresh();
    }
    
    initChart() {
        const ctx = document.getElementById('tempChart').getContext('2d');
        this.tempChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Temperature (°C)',
                    data: [],
                    borderColor: 'rgb(75, 192, 192)',
                    backgroundColor: 'rgba(75, 192, 192, 0.2)',
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                scales: {
                    y: {
                        beginAtZero: false,
                        title: { display: true, text: 'Temperature (°C)' }
                    }
                }
            }
        });
    }
    
    async loadData() {
        try {
            // Load device status
            const statusRes = await fetch('/api/status');
            const status = await statusRes.json();
            this.updateUI(status);
            
            // Load historical data
            const historyRes = await fetch('/api/historical-data?limit=50');
            const history = await historyRes.json();
            this.updateChart(history);
            
            // Load settings
            const settingsRes = await fetch('/api/settings');
            const settings = await settingsRes.json();
            document.getElementById('maxTemp').value = settings.max_temp;
            document.getElementById('minTemp').value = settings.min_temp;
            document.getElementById('totalDays').value = settings.total_days;
            
            // Load alerts
            const alertsRes = await fetch('/api/alerts');
            const alerts = await alertsRes.json();
            this.updateAlerts(alerts);
        } catch (error) {
            console.error('Error loading data:', error);
        }
    }
    
    updateUI(status) {
        document.getElementById('temperature').textContent = 
            status.temperature ? `${status.temperature.toFixed(1)}°C` : '--°C';
        document.getElementById('humidity').textContent = 
            status.humidity ? `${status.humidity.toFixed(1)}%` : '--%';
        document.getElementById('heaterStatus').textContent = status.relay_status || 'OFF';
        document.getElementById('currentDay').textContent = 
            `${status.cycle_day || 0}/${status.total_days || 30}`;
        
        // Update heater status color
        const heaterElem = document.getElementById('heaterStatus');
        if (status.relay_status === 'ON') {
            heaterElem.style.color = '#dc3545';
        } else {
            heaterElem.style.color = '#28a745';
        }
    }
    
    updateChart(data) {
        if (!this.tempChart) return;
        
        const labels = data.map(d => new Date(d.timestamp).toLocaleTimeString());
        const temps = data.map(d => d.temperature);
        
        this.tempChart.data.labels = labels;
        this.tempChart.data.datasets[0].data = temps;
        this.tempChart.update();
    }
    
    updateAlerts(alerts) {
        const alertsList = document.getElementById('alertsList');
        
        if (alerts.length === 0) {
            alertsList.innerHTML = '<p class="text-muted">No active alerts</p>';
            return;
        }
        
        alertsList.innerHTML = alerts.map(alert => `
            <div class="alert alert-${alert.severity === 'warning' ? 'warning' : 'info'} alert-dismissible">
                <strong>${alert.alert_type}:</strong> ${alert.message}
                <small class="text-muted d-block">${new Date(alert.timestamp).toLocaleString()}</small>
            </div>
        `).join('');
    }
    
    async setRelay(mode) {
        try {
            const response = await fetch('/api/control/relay', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mode })
            });
            
            if (response.ok) {
                this.showNotification(`Heater set to ${mode}`, 'success');
                setTimeout(() => this.loadData(), 500);
            }
        } catch (error) {
            this.showNotification('Failed to control relay', 'error');
        }
    }
    
    showNotification(message, type) {
        const notification = document.createElement('div');
        notification.className = `alert alert-${type === 'success' ? 'success' : 'danger'} position-fixed`;
        notification.style.top = '20px';
        notification.style.right = '20px';
        notification.style.zIndex = '9999';
        notification.innerHTML = message;
        document.body.appendChild(notification);
        
        setTimeout(() => notification.remove(), 3000);
    }
    
    startAutoRefresh() {
        if (this.updateInterval) clearInterval(this.updateInterval);
        this.updateInterval = setInterval(() => this.loadData(), 5000);
    }
    
    stopAutoRefresh() {
        if (this.updateInterval) clearInterval(this.updateInterval);
    }
}

// Make dashboard globally available
window.Dashboard = Dashboard;
