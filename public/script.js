// Dashboard-specific functionality
console.log('📊 Dashboard module loaded');

class Dashboard {
    constructor() {
        this.initialized = false;
        this.metrics = {
            performance: 0,
            memory: 0,
            cpu: 0,
            requests: 0,
            uptime: 0
        };
        this.updateInterval = null;
    }

    // Initialize dashboard
    init() {
        if (this.initialized) return;
        
        console.log('📈 Initializing dashboard analytics...');
        
        // Set up real-time updates
        this.setupRealTimeUpdates();
        
        // Start metrics collection
        this.startMetricsCollection();
        
        this.initialized = true;
        console.log('✅ Dashboard analytics initialized');
        
        // Add dashboard controls to the page
        this.addDashboardControls();
    }

    // Set up real-time updates
    setupRealTimeUpdates() {
        // Update metrics every 5 seconds
        this.updateInterval = setInterval(() => {
            this.updateMetrics();
            this.updateLiveStats();
        }, 5000);
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
            requests: 120 + Math.floor(Math.random() * 100),
            uptime: 99.5 + Math.random() * 0.5
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
        
        // Update server stats in footer
        const memoryElement = document.getElementById('memoryUsage');
        if (memoryElement) {
            memoryElement.textContent = `${Math.round(this.metrics.memory * 2)} MB`;
        }
    }

    // Add dashboard controls to the page
    addDashboardControls() {
        // Check if controls already exist
        if (document.getElementById('dashboardControls')) return;
        
        // Create controls container
        const controls = document.createElement('div');
        controls.id = 'dashboardControls';
        controls.style.cssText = `
            position: fixed;
            bottom: 80px;
            right: 20px;
            background: white;
            padding: 15px;
            border-radius: 10px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.1);
            z-index: 1000;
            display: flex;
            flex-direction: column;
            gap: 10px;
        `;
        
        // Add buttons
        const exportBtn = document.createElement('button');
        exportBtn.textContent = '📥 Export Report';
        exportBtn.style.cssText = `
            background: #48bb78;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 5px;
            cursor: pointer;
            font-size: 14px;
            display: flex;
            align-items: center;
            gap: 8px;
        `;
        exportBtn.onclick = () => this.exportDashboardReport();
        
        const refreshBtn = document.createElement('button');
        refreshBtn.textContent = '🔄 Force Refresh';
        refreshBtn.style.cssText = `
            background: #667eea;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 5px;
            cursor: pointer;
            font-size: 14px;
            display: flex;
            align-items: center;
            gap: 8px;
        `;
        refreshBtn.onclick = () => this.forceRefresh();
        
        const monitorBtn = document.createElement('button');
        monitorBtn.textContent = '📊 Performance';
        monitorBtn.style.cssText = `
            background: #ed8936;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 5px;
            cursor: pointer;
            font-size: 14px;
            display: flex;
            align-items: center;
            gap: 8px;
        `;
        monitorBtn.onclick = () => this.showPerformanceMonitor();
        
        controls.appendChild(exportBtn);
        controls.appendChild(refreshBtn);
        controls.appendChild(monitorBtn);
        
        document.body.appendChild(controls);
        
        console.log('✅ Dashboard controls added');
    }

    // Export dashboard report
    exportDashboardReport() {
        const report = `
Dashboard Analytics Report
==========================
Generated: ${new Date().toLocaleString()}

Performance Metrics:
• Performance: ${this.metrics.performance.toFixed(1)}%
• Memory Usage: ${this.metrics.memory.toFixed(1)}%
• CPU Load: ${this.metrics.cpu.toFixed(1)}%
• Requests/min: ${this.metrics.requests}
• Server Uptime: ${this.metrics.uptime.toFixed(2)}%

System Status:
• Server: Online
• Files Loaded: ${document.getElementById('totalFiles')?.textContent || 'Unknown'}
• Active Users: ${document.getElementById('activeUsers')?.textContent || 'Unknown'}
• Project Status: Active

Recommendations:
${this.getRecommendations()}
        `;
        
        const blob = new Blob([report], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `dashboard-report-${new Date().toISOString().split('T')[0]}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        this.showNotification('Dashboard report exported', 'success');
    }

    // Force refresh all data
    forceRefresh() {
        console.log('🔄 Force refreshing dashboard data...');
        
        // Reload all data
        if (window.loadDashboardData) window.loadDashboardData();
        if (window.loadFileStructure) window.loadFileStructure();
        if (window.loadStatistics) window.loadStatistics();
        
        this.updateMetrics();
        this.showNotification('All data refreshed', 'success');
    }

    // Show performance monitor
    showPerformanceMonitor() {
        const monitor = document.createElement('div');
        monitor.id = 'performanceMonitor';
        monitor.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: white;
            padding: 30px;
            border-radius: 15px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.2);
            z-index: 1001;
            min-width: 400px;
        `;
        
        monitor.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h3 style="margin: 0; color: #2d3748;">📊 Performance Monitor</h3>
                <button onclick="document.getElementById('performanceMonitor').remove()" style="background: none; border: none; font-size: 20px; cursor: pointer; color: #a0aec0;">&times;</button>
            </div>
            
            <div style="margin-bottom: 20px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                    <span>Performance:</span>
                    <span style="font-weight: bold; color: ${this.metrics.performance > 80 ? '#48bb78' : this.metrics.performance > 60 ? '#ed8936' : '#f44336'}">
                        ${this.metrics.performance.toFixed(1)}%
                    </span>
                </div>
                <div style="height: 10px; background: #e2e8f0; border-radius: 5px; overflow: hidden;">
                    <div style="height: 100%; width: ${this.metrics.performance}%; background: ${this.metrics.performance > 80 ? '#48bb78' : this.metrics.performance > 60 ? '#ed8936' : '#f44336'};"></div>
                </div>
            </div>
            
            <div style="margin-bottom: 20px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                    <span>Memory Usage:</span>
                    <span style="font-weight: bold; color: ${this.metrics.memory < 60 ? '#48bb78' : this.metrics.memory < 80 ? '#ed8936' : '#f44336'}">
                        ${this.metrics.memory.toFixed(1)}%
                    </span>
                </div>
                <div style="height: 10px; background: #e2e8f0; border-radius: 5px; overflow: hidden;">
                    <div style="height: 100%; width: ${this.metrics.memory}%; background: ${this.metrics.memory < 60 ? '#48bb78' : this.metrics.memory < 80 ? '#ed8936' : '#f44336'};"></div>
                </div>
            </div>
            
            <div style="margin-bottom: 20px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                    <span>CPU Load:</span>
                    <span style="font-weight: bold; color: ${this.metrics.cpu < 50 ? '#48bb78' : this.metrics.cpu < 75 ? '#ed8936' : '#f44336'}">
                        ${this.metrics.cpu.toFixed(1)}%
                    </span>
                </div>
                <div style="height: 10px; background: #e2e8f0; border-radius: 5px; overflow: hidden;">
                    <div style="height: 100%; width: ${this.metrics.cpu}%; background: ${this.metrics.cpu < 50 ? '#48bb78' : this.metrics.cpu < 75 ? '#ed8936' : '#f44336'};"></div>
                </div>
            </div>
            
            <div style="background: #f7fafc; padding: 15px; border-radius: 8px; margin-top: 20px;">
                <h4 style="margin: 0 0 10px 0; color: #2d3748;">Recommendations:</h4>
                <p style="margin: 0; color: #4a5568; font-size: 14px;">${this.getRecommendations().replace(/\n/g, '<br>')}</p>
            </div>
        `;
        
        document.body.appendChild(monitor);
    }

    // Get recommendations based on metrics
    getRecommendations() {
        const recommendations = [];
        
        if (this.metrics.performance < 80) {
            recommendations.push('• Consider optimizing database queries and caching');
        }
        
        if (this.metrics.memory > 70) {
            recommendations.push('• Memory usage is high. Consider adding more RAM or optimizing memory usage');
        }
        
        if (this.metrics.cpu > 60) {
            recommendations.push('• CPU usage is elevated. Consider load balancing or optimizing code execution');
        }
        
        if (recommendations.length === 0) {
            recommendations.push('• System is performing optimally. No actions required at this time.');
        }
        
        return recommendations.join('\n');
    }

    // Show notification
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: ${type === 'success' ? '#48bb78' : type === 'error' ? '#f44336' : type === 'warning' ? '#ff9800' : '#2196f3'};
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 1000;
            animation: slideIn 0.3s ease;
        `;
        
        notification.textContent = message;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 300);
        }, 3000);
    }

    // Clean up
    destroy() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
        
        const controls = document.getElementById('dashboardControls');
        if (controls) {
            controls.remove();
        }
        
        this.initialized = false;
        console.log('Dashboard destroyed');
    }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('📈 Loading dashboard module...');
    
    // Create global dashboard instance
    window.dashboard = new Dashboard();
    
    // Initialize after a short delay
    setTimeout(() => {
        window.dashboard.init();
    }, 1000);
});

// Performance monitoring utility
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
