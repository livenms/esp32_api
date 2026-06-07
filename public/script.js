// Global helper functions
window.showNotification = function(alert) {
    const notification = document.createElement('div');
    notification.className = `alert alert-${alert.severity === 'warning' ? 'warning' : 'info'} position-fixed`;
    notification.style.top = '20px';
    notification.style.right = '20px';
    notification.style.zIndex = '9999';
    notification.innerHTML = `
        <strong>${alert.alert_type}:</strong> ${alert.message}
        <small class="d-block">${new Date().toLocaleTimeString()}</small>
    `;
    document.body.appendChild(notification);
    
    setTimeout(() => notification.remove(), 5000);
};

window.updateDashboardData = function(data) {
    if (window.dashboard) {
        window.dashboard.updateUI(data);
    }
};

// Logout function
window.logout = async function() {
    try {
        await fetch('/api/logout', { method: 'POST' });
        window.location.reload();
    } catch (error) {
        console.error('Logout failed:', error);
    }
};

// Export data function
window.exportData = async function() {
    try {
        const response = await fetch('/api/export-data');
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `broodinnox_data_${new Date().toISOString()}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    } catch (error) {
        console.error('Export failed:', error);
    }
};
