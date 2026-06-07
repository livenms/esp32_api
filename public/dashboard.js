/**
 * Dashboard Rendering - Broodinnox System
 * Displays real-time system status and control interfaces
 */

function renderDashboard() {
  const d = window.latestData || {};

  const el = document.getElementById("content");
  if (!el) return;

  el.innerHTML = `
    <!-- SYSTEM OVERVIEW CARD -->
    <div class="card">
      <h3>📊 System Overview</h3>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px;">
        <div>
          <p style="color: var(--text-secondary); font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Incubation Progress</p>
          <p style="font-size: 24px; font-weight: 700; color: var(--primary-color);">${d.day ?? "-"}/<strong>${d.total_days ?? "-"}</strong> Days</p>
        </div>
        <div>
          <p style="color: var(--text-secondary); font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Average Temperature</p>
          <p style="font-size: 24px; font-weight: 700;"><span class="value" style="font-size: 20px;">${d.ave_temp ?? "--"} °C</span></p>
        </div>
        <div>
          <p style="color: var(--text-secondary); font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">System Status</p>
          <p style="font-size: 14px;">
            <strong>Heater:</strong> <span style="color: ${d.relay_state ? 'var(--success)' : 'var(--text-secondary)'}; font-weight: 600;">${d.relay_state ? "● ON" : "● OFF"}</span>
            <br/>
            <strong>Mode:</strong> <span style="font-weight: 600;">${d.manual_control ? "🎮 MANUAL" : "🤖 AUTO"}</span>
            <br/>
            <strong>Lock:</strong> <span style="color: ${d.device_locked ? 'var(--danger)' : 'var(--success)'}; font-weight: 600;">${d.device_locked ? "🔒 LOCKED" : "🔓 ACTIVE"}</span>
          </p>
        </div>
      </div>
    </div>

    <!-- HEATER CONTROL CARD -->
    <div class="card">
      <h3>⚡ Heater Control</h3>
      <p style="margin-bottom: 16px; color: var(--text-secondary); font-size: 13px;">Manage the heating system for optimal incubation</p>
      <div class="control-group">
        <button onclick="setRelay('ON')" style="flex: 1; min-width: 120px;">Turn ON</button>
        <button onclick="setRelay('OFF')" style="flex: 1; min-width: 120px;">Turn OFF</button>
        <button onclick="setRelay('AUTO')" style="flex: 1; min-width: 120px;">Auto Mode</button>
      </div>
    </div>

    <!-- TEMPERATURE CONTROL CARD -->
    <div class="card">
      <h3>🌡️ Temperature Settings</h3>
      <p style="margin-bottom: 16px; color: var(--text-secondary); font-size: 13px;">Set temperature thresholds for the incubator</p>
      
      <div class="input-group">
        <input id="maxT" type="number" placeholder="Max Temperature (°C)" step="0.1"/>
        <button onclick="setMaxTemp()" style="flex: 0 0 auto;">Apply Max</button>
      </div>

      <div class="input-group">
        <input id="minT" type="number" placeholder="Min Temperature (°C)" step="0.1"/>
        <button onclick="setMinTemp()" style="flex: 0 0 auto;">Apply Min</button>
      </div>

      <p style="background-color: var(--surface); padding: 12px; border-radius: 6px; margin-top: 12px; font-size: 13px;">
        <strong>Current Range:</strong> ${d.min_temp ?? "-"}°C to ${d.max_temp ?? "-"}°C
      </p>
    </div>

    <!-- SENSOR CONTROL CARD -->
    <div class="card">
      <h3>📡 Sensor Management</h3>
      <p style="margin-bottom: 16px; color: var(--text-secondary); font-size: 13px;">Enable or disable temperature sensors</p>
      
      <div class="control-group">
        <button onclick="toggleSensor('DS1')">DS1: ${d.s1_enabled ? "✓ ON" : "OFF"}</button>
        <button onclick="toggleSensor('DS2')">DS2: ${d.s2_enabled ? "✓ ON" : "OFF"}</button>
        <button onclick="toggleSensor('DS3')">DS3: ${d.s3_enabled ? "✓ ON" : "OFF"}</button>
        <button onclick="toggleSensor('DS4')">DS4: ${d.s4_enabled ? "✓ ON" : "OFF"}</button>
      </div>

      <p style="background-color: var(--surface); padding: 12px; border-radius: 6px; font-size: 13px;">
        <strong>Sensor Status:</strong><br/>
        DS1: <span style="color: ${d.s1_enabled ? 'var(--success)' : 'var(--text-secondary)'};">${d.s1_enabled ? "● Active" : "○ Inactive"}</span> | 
        DS2: <span style="color: ${d.s2_enabled ? 'var(--success)' : 'var(--text-secondary)'};">${d.s2_enabled ? "● Active" : "○ Inactive"}</span> | 
        DS3: <span style="color: ${d.s3_enabled ? 'var(--success)' : 'var(--text-secondary)'};">${d.s3_enabled ? "● Active" : "○ Inactive"}</span> | 
        DS4: <span style="color: ${d.s4_enabled ? 'var(--success)' : 'var(--text-secondary)'};">${d.s4_enabled ? "● Active" : "○ Inactive"}</span>
      </p>
    </div>

    <!-- DEVICE CONTROL CARD -->
    <div class="card">
      <h3>🔐 Device Control</h3>
      <p style="margin-bottom: 16px; color: var(--text-secondary); font-size: 13px;">Lock or unlock the device to prevent unauthorized changes</p>
      <div class="control-group">
        <button onclick="lockDevice()" class="danger" style="flex: 1; min-width: 140px;">🔒 Lock Device</button>
        <button onclick="unlockDevice()" class="success" style="flex: 1; min-width: 140px;">🔓 Unlock Device</button>
      </div>
    </div>

    <!-- RAW DATA CARD -->
    <div class="card">
      <h3>📋 Raw Data</h3>
      <p style="margin-bottom: 12px; color: var(--text-secondary); font-size: 13px;">Complete device state information</p>
      <pre>${JSON.stringify(d, null, 2)}</pre>
    </div>
  `;
}

/**
 * Page Navigation Handler
 */
function showPage(page) {
  const contentEl = document.getElementById("content");
  
  if (page === "dashboard") {
    renderDashboard();
  } else if (page === "sensors") {
    contentEl.innerHTML = `
      <div class="card">
        <h3>📡 Sensor Readings</h3>
        <pre style="max-height: 600px; overflow-y: auto;">${JSON.stringify(window.latestData || {}, null, 2)}</pre>
      </div>
    `;
  } else if (page === "control") {
    renderDashboard();
  }
}

// Export for global use
window.showPage = showPage;
window.renderDashboard = renderDashboard;
