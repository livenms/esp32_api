// Main application script

// DOM Elements
const userCount = document.getElementById('userCount');
const revenue = document.getElementById('revenue');
const projectCount = document.getElementById('projectCount');
const uptime = document.getElementById('uptime');
const filesContainer = document.getElementById('filesContainer');
const refreshFilesBtn = document.getElementById('refreshFiles');
const deployBtn = document.getElementById('deployBtn');
const restartBtn = document.getElementById('restartBtn');
const viewLogsBtn = document.getElementById('viewLogs');
const lastDeploy = document.getElementById('lastDeploy');

// File type mapping
const fileTypeIcons = {
    'js': { icon: 'js', class: 'js', name: 'JavaScript' },
    'html': { icon: 'html', class: 'html', name: 'HTML' },
    'css': { icon: 'css', class: 'css', name: 'CSS' },
    'json': { icon: 'json', class: 'json', name: 'JSON' },
    'yaml': { icon: 'yaml', class: 'yaml', name: 'YAML' },
    'config': { icon: 'config', class: 'config', name: 'Config' }
};

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Dashboard application loaded');
    
    // Load dashboard data
    loadDashboardData();
    
    // Load files list
    loadFiles();
    
    // Set up event listeners
    setupEventListeners();
    
    // Update last deployment time
    updateLastDeployTime();
});

// Load dashboard statistics
async function loadDashboardData() {
    try {
        console.log('📊 Loading dashboard data...');
        
        // In a real app, this would be an API call
        // For now, we'll simulate with mock data
        const mockData = {
            users: 245,
            revenue: '$15,432',
            projects: 18,
            uptime: '99.9%'
        };
        
        // Animate the numbers
        animateCounter(userCount, mockData.users);
        revenue.textContent = mockData.revenue;
        animateCounter(projectCount, mockData.projects);
        uptime.textContent = mockData.uptime;
        
    } catch (error) {
        console.error('Error loading dashboard data:', error);
        showError('Failed to load dashboard data');
    }
}

// Load files list
async function loadFiles() {
    try {
        console.log('📁 Loading files list...');
        
        // Clear existing files
        filesContainer.innerHTML = '';
        
        // Simulate API call
        const files = await fetchFiles();
        
        // Render each file
        files.forEach(file => {
            const fileItem = createFileElement(file);
            filesContainer.appendChild(fileItem);
        });
        
    } catch (error) {
        console.error('Error loading files:', error);
        showError('Failed to load files');
    }
}

// Fetch files from API (simulated)
async function fetchFiles() {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    return [
        { name: 'server.js', type: 'js', size: '1.2KB' },
        { name: 'package.json', type: 'json', size: '0.8KB' },
        { name: 'render.yaml', type: 'yaml', size: '0.5KB' },
        { name: '.node-version', type: 'config', size: '0.1KB' },
        { name: 'public/index.html', type: 'html', size: '1.5KB' },
        { name: 'public/style.css', type: 'css', size: '2.1KB' },
        { name: 'public/script.js', type: 'js', size: '3.2KB' },
        { name: 'public/dashboard.js', type: 'js', size: '4.8KB' }
    ];
}

// Create file element
function createFileElement(file) {
    const fileType = fileTypeIcons[file.type] || fileTypeIcons.config;
    
    const div = document.createElement('div');
    div.className = 'file-item';
    div.innerHTML = `
        <div class="file-icon ${fileType.class}">
            <i class="fas fa-file-code"></i>
        </div>
        <div class="file-info">
            <h4>${file.name}</h4>
            <p>${fileType.name} • ${file.size}</p>
        </div>
    `;
    
    // Add click event
    div.addEventListener('click', () => {
        showFileDetails(file);
    });
    
    return div;
}

// Show file details
function showFileDetails(file) {
    console.log(`📄 Selected file: ${file.name}`);
    
    // Create modal or show in a dedicated panel
    alert(`File: ${file.name}\nType: ${file.type}\nSize: ${file.size}\n\nThis would open a file viewer in a real application.`);
}

// Set up event listeners
function setupEventListeners() {
    // Refresh files button
    refreshFilesBtn.addEventListener('click', () => {
        console.log('🔄 Refreshing files...');
        loadFiles();
        showNotification('Files refreshed successfully');
    });
    
    // Deploy button
    deployBtn.addEventListener('click', () => {
        console.log('🚀 Initiating deployment...');
        deployApplication();
    });
    
    // Restart server button
    restartBtn.addEventListener('click', () => {
        console.log('🔄 Restarting server...');
        restartServer();
    });
    
    // View logs button
    viewLogsBtn.addEventListener('click', () => {
        console.log('📋 Viewing logs...');
        viewLogs();
    });
}

// Animate counter
function animateCounter(element, target) {
    let current = 0;
    const increment = target / 50; // Animate over 50 steps
    const timer = setInterval(() => {
        current += increment;
        if (current >= target) {
            element.textContent = target;
            clearInterval(timer);
        } else {
            element.textContent = Math.floor(current);
        }
    }, 30);
}

// Deploy application
async function deployApplication() {
    try {
        showLoading('Deploying application...');
        
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Update last deployment time
        updateLastDeployTime();
        
        showNotification('✅ Application deployed successfully!');
        
    } catch (error) {
        console.error('Deployment error:', error);
        showError('Deployment failed');
    }
}

// Restart server
async function restartServer() {
    try {
        const confirmed = confirm('Are you sure you want to restart the server?');
        if (!confirmed) return;
        
        showLoading('Restarting server...');
        
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        showNotification('✅ Server restarted successfully!');
        
    } catch (error) {
        console.error('Restart error:', error);
        showError('Server restart failed');
    }
}

// View logs
function viewLogs() {
    const logWindow = window.open('', 'Server Logs', 'width=800,height=600');
    if (logWindow) {
        logWindow.document.write(`
            <html>
            <head>
                <title>Server Logs</title>
                <style>
                    body { 
                        font-family: monospace; 
                        background: #1a202c; 
                        color: #e2e8f0; 
                        padding: 20px; 
                        margin: 0; 
                    }
                    .log-entry { 
                        margin-bottom: 10px; 
                        padding: 10px; 
                        border-left: 3px solid #48bb78; 
                        background: rgba(255,255,255,0.05); 
                    }
                    .timestamp { color: #a0aec0; }
                    .info { color: #48bb78; }
                    .warning { color: #ed8936; }
                    .error { color: #f56565; }
                </style>
            </head>
            <body>
                <h2>📋 Server Logs</h2>
                <div id="logs"></div>
                <script>
                    const logs = [
                        { time: '10:30:22', level: 'info', message: 'Server started on port 3000' },
                        { time: '10:35:15', level: 'info', message: 'Dashboard API request received' },
                        { time: '10:40:08', level: 'warning', message: 'High memory usage detected' },
                        { time: '10:45:33', level: 'info', message: 'File system scan completed' },
                        { time: '10:50:17', level: 'info', message: 'User session created' },
                        { time: '10:55:42', level: 'error', message: 'Database connection timeout' }
                    ];
                    
                    const container = document.getElementById('logs');
                    logs.forEach(log => {
                        const div = document.createElement('div');
                        div.className = 'log-entry';
                        div.innerHTML = \`
                            <span class="timestamp">[\${log.time}]</span>
                            <span class="\${log.level}">\${log.level.toUpperCase()}</span>
                            <span>\${log.message}</span>
                        \`;
                        container.appendChild(div);
                    });
                </script>
            </body>
            </html>
        `);
    }
}

// Update last deployment time
function updateLastDeployTime() {
    const now = new Date();
    const formatted = now.toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit',
        second: '2-digit'
    });
    lastDeploy.textContent = `Today at ${formatted}`;
}

// Show notification
function showNotification(message) {
    // Create notification element
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #48bb78;
        color: white;
        padding: 15px 25px;
        border-radius: 10px;
        box-shadow: 0 4px 15px rgba(0,0,0,0.2);
        z-index: 1000;
        animation: slideIn 0.3s ease;
    `;
    
    // Add keyframes for animation
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
    `;
    document.head.appendChild(style);
    
    notification.textContent = message;
    document.body.appendChild(notification);
    
    // Remove after 3 seconds
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 300);
    }, 3000);
}

// Show loading state
function showLoading(message) {
    const loading = document.createElement('div');
    loading.id = 'loading-overlay';
    loading.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.7);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        z-index: 9999;
        color: white;
        font-size: 18px;
    `;
    
    loading.innerHTML = `
        <div class="spinner"></div>
        <div style="margin-top: 20px;">${message}</div>
    `;
    
    // Add spinner styles
    const spinnerStyle = document.createElement('style');
    spinnerStyle.textContent = `
        .spinner {
            width: 50px;
            height: 50px;
            border: 5px solid rgba(255,255,255,0.3);
            border-radius: 50%;
            border-top-color: white;
            animation: spin 1s ease-in-out infinite;
        }
        
        @keyframes spin {
            to { transform: rotate(360deg); }
        }
    `;
    document.head.appendChild(spinnerStyle);
    
    document.body.appendChild(loading);
    
    // Return function to hide loading
    return () => {
        document.body.removeChild(loading);
        document.head.removeChild(spinnerStyle);
    };
}

// Show error message
function showError(message) {
    alert(`❌ Error: ${message}`);
}

// Export functions for use in dashboard.js
window.dashboardUtils = {
    loadDashboardData,
    loadFiles,
    deployApplication,
    restartServer,
    showNotification
};
