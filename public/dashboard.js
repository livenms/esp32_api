// Dashboard-specific functionality

// Dashboard initialization
class Dashboard {
    constructor() {
        this.initialized = false;
        this.metrics = {
            performance: 0,
            memory: 0,
            cpu: 0,
            requests: 0
        };
    }

    // Initialize dashboard
    init() {
        if (this.initialized) return;
        
        console.log('📈 Initializing dashboard analytics...');
        
        // Set up real-time updates
        this.setupRealTimeUpdates();
        
        // Start metrics collection
        this.startMetricsCollection();
        
        // Set up chart if needed
        this.setupCharts();
        
        this.initialized = true;
        console.log('✅ Dashboard analytics initialized');
    }

    // Set up real-time updates
    setupRealTimeUpdates() {
        // Simulate real-time data updates
        setInterval(() => {
            this.updateMetrics();
            this.updateLiveStats();
        }, 5000); // Update every 5 seconds
    }

    // Start collecting metrics
    startMetricsCollection() {
        console.log('📊 Starting metrics collection...');
        
        // Initial metrics
        this.updateMetrics();
        
        // Update every minute
        setInterval(() => {
            this.updateMetrics();
        }, 60000);
    }

    // Update metrics
    updateMetrics() {
        // Simulate metrics data
        this.metrics = {
            performance: 85 + Math.random() * 15,
            memory: 45 + Math.random() * 30,
            cpu: 20 + Math.random() * 40,
            requests: 120 + Math.floor(Math.random() * 100)
        };
        
        console.log('📈 Metrics updated:', this.metrics);
    }

    // Update live stats display
    updateLiveStats() {
        // Update any live stat elements if they exist
        const liveStatsElement = document.getElementById('liveStats');
        if (liveStatsElement) {
            liveStatsElement.innerHTML = `
                <div class="live-stat">
                    <span class="stat-label">Performance:</span>
                    <span class="stat-value">${this.metrics.performance.toFixed(1)}%</span>
                </div>
                <div class="live-stat">
                    <span class="stat-label">Memory Usage:</span>
                    <span class="stat-value">${this.metrics.memory.toFixed(1)}%</span>
                </div>
                <div class="live-stat">
                    <span class="stat-label">CPU Load:</span>
                    <span class="stat-value">${this.metrics.cpu.toFixed(1)}%</span>
                </div>
                <div class="live-stat">
                    <span class="stat-label">Requests/min:</span>
                    <span class="stat-value">${this.metrics.requests}</span>
                </div>
            `;
        }
    }

    // Set up charts (placeholder for chart library integration)
    setupCharts() {
        console.log('📊 Setting up dashboard charts...');
        
        // This would integrate with a charting library like Chart.js
        // For now, we'll just log that charts would be initialized
        
        // Check if Chart.js is available
        if (typeof Chart !== 'undefined') {
            this.initializeRealChart();
        } else {
            console.log('ℹ️ Chart.js not loaded. Skipping chart initialization.');
        }
    }

    // Initialize a real chart if Chart.js is available
    initializeRealChart() {
        try {
            const ctx = document.getElementById('performanceChart');
            if (!ctx) return;
            
            new Chart(ctx, {
                type: 'line',
                data: {
                    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
                    datasets: [{
                        label: 'Performance',
                        data: [65, 78, 85, 82, 88, 92],
                        borderColor: '#667eea',
                        backgroundColor: 'rgba(102, 126, 234, 0.1)',
                        tension: 0.4
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: {
                            display: true
                        }
                    }
                }
            });
            
            console.log('✅ Performance chart initialized');
        } catch (error) {
            console.error('Error initializing chart:', error);
        }
    }

    // Export dashboard data
    exportDashboardData() {
        const data = {
            timestamp: new Date().toISOString(),
            metrics: this.metrics,
            files: window.dashboardUtils ? 'Available' : 'Not loaded',
            status: 'active'
        };
        
        // Create downloadable JSON
        const blob = new Blob([JSON.stringify(data, null, 2)], {
            type: 'application/json'
        });
        
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `dashboard-export-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        console.log('📥 Dashboard data exported');
    }

    // Generate report
    generateReport() {
        console.log('📋 Generating dashboard report...');
        
        const report = `
Dashboard Analytics Report
==========================
Generated: ${new Date().toLocaleString()}

Performance Metrics:
• Performance: ${this.metrics.performance.toFixed(1)}%
• Memory Usage: ${this.metrics.memory.toFixed(1)}%
• CPU Load: ${this.metrics.cpu.toFixed(1)}%
• Requests/min: ${this.metrics.requests}

System Status:
• Server: Online
• Database: Connected
• API: Responding
• Uptime: 99.9%

Recommendations:
${this.getRecommendations()}
        `;
        
        // Show report in a modal or new window
        const reportWindow = window.open('', 'Dashboard Report', 'width=600,height=400');
        if (reportWindow) {
            reportWindow.document.write(`
                <html>
                <head>
                    <title>Dashboard Report</title>
                    <style>
                        body { 
                            font-family: monospace; 
                            padding: 20px; 
                            line-height: 1.6;
                            background: #f7fafc;
                            color: #2d3748;
                        }
                        pre {
                            background: white;
                            padding: 20px;
                            border-radius: 10px;
                            border: 1px solid #e2e8f0;
                            white-space: pre-wrap;
                            word-wrap: break-word;
                        }
                        h1 { 
                            color: #667eea; 
                            border-bottom: 2px solid #667eea;
                            padding-bottom: 10px;
                        }
                    </style>
                </head>
                <body>
                    <h1>📊 Dashboard Analytics Report</h1>
                    <pre>${report}</pre>
                    <button onclick="window.print()" style="
                        background: #667eea;
                        color: white;
                        border: none;
                        padding: 10px 20px;
                        border-radius: 5px;
                        cursor: pointer;
                        margin-top: 20px;
                    ">
                        Print Report
                    </button>
                </body>
                </html>
            `);
        }
    }

    // Get recommendations based on metrics
    getRecommendations() {
        const recommendations = [];
        
        if (this.metrics.performance < 80) {
            recommendations.push('• Consider optimizing database queries');
        }
        
        if (this.metrics.memory > 70) {
            recommendations.push('• Memory usage is high. Consider adding more RAM or optimizing memory usage');
        }
        
        if (this.metrics.cpu > 60) {
            recommendations.push('• CPU usage is elevated. Consider load balancing or optimizing code');
        }
        
        if (recommendations.length === 0) {
            recommendations.push('• System is performing optimally. No actions required at this time.');
        }
        
        return recommendations.join('\n');
    }

    // Reset dashboard
    reset() {
        console.log('🔄 Resetting dashboard...');
        this.metrics = {
            performance: 0,
            memory: 0,
            cpu: 0,
            requests: 0
        };
        
        // Show reset notification
        if (window.dashboardUtils && window.dashboardUtils.showNotification) {
            window.dashboardUtils.showNotification('Dashboard reset complete');
        }
    }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('📈 Loading dashboard module...');
    
    // Create global dashboard instance
    window.dashboard = new Dashboard();
    
    // Initialize after a short delay to ensure other scripts are loaded
    setTimeout(() => {
        window.dashboard.init();
        
        // Add dashboard controls to the page if they don't exist
        addDashboardControls();
        
    }, 1000);
});

// Add dashboard controls to the page
function addDashboardControls() {
    // Check if controls already exist
    if (document.getElementById('dashboardControls')) return;
    
    // Create controls container
    const controls = document.createElement('div');
    controls.id = 'dashboardControls';
    controls.style.cssText = `
        position: fixed;
        bottom: 20px;
        left: 20px;
        background: white;
        padding: 15px;
        border-radius: 10px;
        box-shadow: 0 4px 15px rgba(0,0,0,0.1);
        z-index: 1000;
        display: flex;
        gap: 10px;
    `;
    
    // Add buttons
    const exportBtn = document.createElement('button');
    exportBtn.textContent = '📥 Export Data';
    exportBtn.style.cssText = `
        background: #48bb78;
        color: white;
        border: none;
        padding: 8px 16px;
        border-radius: 5px;
        cursor: pointer;
        font-size: 14px;
    `;
    exportBtn.onclick = () => window.dashboard.exportDashboardData();
    
    const reportBtn = document.createElement('button');
    reportBtn.textContent = '📋 Generate Report';
    reportBtn.style.cssText = `
        background: #667eea;
        color: white;
        border: none;
        padding: 8px 16px;
        border-radius: 5px;
        cursor: pointer;
        font-size: 14px;
    `;
    reportBtn.onclick = () => window.dashboard.generateReport();
    
    const resetBtn = document.createElement('button');
    resetBtn.textContent = '🔄 Reset';
    resetBtn.style.cssText = `
        background: #ed8936;
        color: white;
        border: none;
        padding: 8px 16px;
        border-radius: 5px;
        cursor: pointer;
        font-size: 14px;
    `;
    resetBtn.onclick = () => window.dashboard.reset();
    
    controls.appendChild(exportBtn);
    controls.appendChild(reportBtn);
    controls.appendChild(resetBtn);
    
    document.body.appendChild(controls);
    
    console.log('✅ Dashboard controls added');
}

// Dashboard API integration
const DashboardAPI = {
    // Get real-time metrics from server
    async getRealTimeMetrics() {
        try {
            const response = await fetch('/api/dashboard');
            if (!response.ok) throw new Error('API request failed');
            return await response.json();
        } catch (error) {
            console.error('Error fetching real-time metrics:', error);
            return null;
        }
    },
    
    // Subscribe to live updates
    subscribeToUpdates(callback) {
        // Simulate WebSocket connection
        setInterval(async () => {
            const data = await this.getRealTimeMetrics();
            if (data && callback) {
                callback(data);
            }
        }, 10000); // Update every 10 seconds
    }
};

// Make API available globally
window.DashboardAPI = DashboardAPI;

// Performance monitoring
class PerformanceMonitor {
    constructor() {
        this.metrics = [];
        this.startTime = Date.now();
    }
    
    startMeasurement(name) {
        return {
            name,
            start: Date.now(),
            end: null,
            duration: null
        };
    }
    
    endMeasurement(measurement) {
        measurement.end = Date.now();
        measurement.duration = measurement.end - measurement.start;
        this.metrics.push(measurement);
        
        // Log if duration is significant
        if (measurement.duration > 100) {
            console.warn(`⚠️ Slow operation detected: ${measurement.name} took ${measurement.duration}ms`);
        }
        
        return measurement.duration;
    }
    
    getPerformanceReport() {
        const totalTime = Date.now() - this.startTime;
        const avgDuration = this.metrics.reduce((sum, m) => sum + m.duration, 0) / this.metrics.length;
        
        return {
            totalOperations: this.metrics.length,
            totalTime,
            averageDuration: avgDuration,
            slowOperations: this.metrics.filter(m => m.duration > 100),
            metrics: this.metrics
        };
    }
}

// Initialize performance monitor
window.performanceMonitor = new PerformanceMonitor();

console.log('✅ Dashboard.js module loaded successfully');
