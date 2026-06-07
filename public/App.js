// Main application component
class BroodinnoxApp {
    constructor() {
        this.currentUser = null;
        this.init();
    }
    
    async init() {
        await this.checkAuth();
        this.setupEventListeners();
        this.setupSocket();
        this.render();
    }
    
    async checkAuth() {
        try {
            const response = await fetch('/api/current-user');
            if (response.ok) {
                this.currentUser = await response.json();
                this.showDashboard();
            } else {
                this.showLogin();
            }
        } catch (error) {
            this.showLogin();
        }
    }
    
    setupSocket() {
        this.socket = io();
        
        this.socket.on('device_update', (data) => {
            if (window.updateDashboardData) {
                window.updateDashboardData(data);
            }
        });
        
        this.socket.on('new_alert', (alert) => {
            if (window.showNotification) {
                window.showNotification(alert);
            }
        });
    }
    
    setupEventListeners() {
        window.addEventListener('hashchange', () => this.handleRouting());
    }
    
    handleRouting() {
        const hash = window.location.hash;
        if (hash === '#dashboard' && this.currentUser) {
            this.showDashboard();
        } else if (hash === '#settings' && this.currentUser) {
            this.showSettings();
        } else if (hash === '#users' && this.currentUser?.role === 'admin') {
            this.showUserManagement();
        } else {
            this.showDashboard();
        }
    }
    
    showLogin() {
        document.getElementById('root').innerHTML = window.renderLogin();
        document.getElementById('loginForm')?.addEventListener('submit', (e) => this.handleLogin(e));
    }
    
    async handleLogin(e) {
        e.preventDefault();
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        
        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            
            if (response.ok) {
                const data = await response.json();
                this.currentUser = data.user;
                this.showDashboard();
            } else {
                alert('Invalid credentials');
            }
        } catch (error) {
            alert('Login failed');
        }
    }
    
    showDashboard() {
        if (window.Dashboard) {
            const dashboard = new window.Dashboard(this.currentUser);
            dashboard.render();
        }
    }
    
    showSettings() {
        // Settings view implementation
        document.getElementById('root').innerHTML = `
            <div class="container mt-4">
                <h2><i class="fas fa-cog"></i> Settings</h2>
                <div class="card">
                    <div class="card-body">
                        <p>Settings page coming soon...</p>
                    </div>
                </div>
            </div>
        `;
    }
    
    showUserManagement() {
        // User management view implementation
        document.getElementById('root').innerHTML = `
            <div class="container mt-4">
                <h2><i class="fas fa-users"></i> User Management</h2>
                <div class="card">
                    <div class="card-body">
                        <p>User management coming soon...</p>
                    </div>
                </div>
            </div>
        `;
    }
    
    render() {
        if (!this.currentUser) {
            this.showLogin();
        } else {
            this.showDashboard();
        }
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new BroodinnoxApp();
});
