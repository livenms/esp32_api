/**
 * Dashboard Rendering - Broodinnox System
 * Displays real-time system status and control interfaces
 */

function renderDashboard() {
  const d = window.latestData || {};

  const el = document.getElementById("content");
  if (!el) return;

  // Calculate progress percentage
  const progressPercent = d.total_days ? Math.round((d.day / d.total_days) * 100) : 0;

  el.innerHTML = `
    <!-- TOP STATUS BAR -->
    <div class="top-banner">
      <div class="banner-left">
        <h1 style="font-size: 28px; font-weight: 700; margin: 0;">🐣 Broodinnox SMART</h1>
        <p style="margin: 4px 0 0 0; color: var(--text-secondary); font-size: 13px;">GSM + MQTT Brooding Controller | Device: <strong>${d.device_id ?? "BROODINNOX-001"}</strong></p>
      </div>
      <div class="banner-right" style="display: flex; gap: 12px; align-items: center;">
        <div class="connection-status">
          <span id="mqttStatusIcon">●</span> <span id="mqttStatusText">Connecting...</span>
        </div>
      </div>
    </div>

    <!-- MAIN GRID LAYOUT -->
    <div class="dashboard-grid">
      
      <!-- LEFT COLUMN -->
      <div class="grid-left">
        
        <!-- TEMPERATURE & SENSORS CARD -->
        <div class="card">
          <h3>🌡️ Temperature & Sensors</h3>
          <div class="temperature-display">
            <div class="temp-reading">
              <span class="temp-value">${d.ave_temp ?? "--"}°C</span>
            </div>
          </div>
          <div class="sensor-indicators">
            <div class="sensor-item">
              <span class="sensor-label">DS1:</span>
              <span class="sensor-status ${d.s1_enabled ? 'active' : 'inactive'}">${d.s1_enabled ? '● Active' : '○ Inactive'}</span>
            </div>
            <div class="sensor-item">
              <span class="sensor-label">DS2:</span>
              <span class="sensor-status ${d.s2_enabled ? 'active' : 'inactive'}">${d.s2_enabled ? '● Active' : '○ Inactive'}</span>
            </div>
            <div class="sensor-item">
              <span class="sensor-label">DS3:</span>
              <span class="sensor-status ${d.s3_enabled ? 'active' : 'inactive'}">${d.s3_enabled ? '● Active' : '○ Inactive'}</span>
            </div>
            <div class="sensor-item">
              <span class="sensor-label">DS4:</span>
              <span class="sensor-status ${d.s4_enabled ? 'active' : 'inactive'}">${d.s4_enabled ? '● Active' : '○ Inactive'}</span>
            </div>
          </div>
        </div>

        <!-- SETPOINTS & SCHEDULE CARD -->
        <div class="card">
          <h3>⚙️ Setpoints & Schedule</h3>
          
          <div class="slider-group">
            <div class="slider-label">
              <span>🔥 Max Temperature:</span>
              <span class="slider-value">${d.max_temp ?? "--"} °C</span>
            </div>
            <input type="range" id="maxTSlider" min="20" max="40" step="0.5" value="${d.max_temp ?? 38}" onchange="updateMaxTempFromSlider()" class="slider"/>
            <input type="number" id="maxT" placeholder="Max Temp" step="0.1" onchange="setMaxTemp()" class="slider-input"/>
          </div>

          <div class="slider-group">
            <div class="slider-label">
              <span>❄️ Min Temperature:</span>
              <span class="slider-value">${d.min_temp ?? "--"} °C</span>
            </div>
            <input type="range" id="minTSlider" min="20" max="40" step="0.5" value="${d.min_temp ?? 36}" onchange="updateMinTempFromSlider()" class="slider"/>
            <input type="number" id="minT" placeholder="Min Temp" step="0.1" onchange="setMinTemp()" class="slider-input"/>
          </div>

          <div class="slider-group">
            <div class="slider-label">
              <span>📅 Total Days:</span>
              <span class="slider-value">${d.total_days ?? "--"}</span>
            </div>
            <input type="range" id="totalDaysSlider" min="18" max="35" step="1" value="${d.total_days ?? 21}" onchange="updateTotalDays()" class="slider"/>
            <input type="number" id="totalDays" placeholder="Total Days" step="1" onchange="setTotalDays()" class="slider-input"/>
          </div>

          <div class="slider-group">
            <div class="slider-label">
              <span>📆 Current Day:</span>
              <span class="slider-value">${d.day ?? "--"} / ${d.total_days ?? "--"}</span>
            </div>
          </div>
        </div>

      </div>

      <!-- RIGHT COLUMN -->
      <div class="grid-right">
        
        <!-- HEATING RELAY CARD -->
        <div class="card">
          <h3>⚡ Heating Relay</h3>
          
          <div class="relay-section">
            <p style="font-size: 13px; color: var(--text-secondary); margin-bottom: 12px;">Relay Mode</p>
            <div class="relay-buttons">
              <button onclick="setRelay('AUTO')" class="relay-btn ${d.manual_control ? '' : 'active'}" style="background-color: #f59e0b;">AUTO</button>
              <button onclick="setRelay('ON')" class="relay-btn ${d.relay_state && d.manual_control ? 'active' : ''}">ON (Manual)</button>
              <button onclick="setRelay('OFF')" class="relay-btn ${!d.relay_state && d.manual_control ? 'active' : ''}">OFF (Manual)</button>
            </div>
            <div class="relay-status">
              <span>⚡ Relay:</span> <span style="color: ${d.relay_state ? 'var(--success)' : '#666'}; font-weight: 600;">${d.relay_state ? '🔌 ON' : '⊘ OFF'}</span>
            </div>
          </div>

          <hr style="margin: 16px 0; border: none; border-top: 1px solid var(--border);">

          <div class="preset-section">
            <p style="font-size: 13px; color: var(--text-secondary); margin-bottom: 12px;">Animal Preset</p>
            <select id="animalPreset" onchange="applyAnimalPreset()" class="preset-select">
              <option value="chicken">🐔 Chicken (36/32°C, 21d)</option>
              <option value="duck">🦆 Duck (37/30°C, 28d)</option>
              <option value="turkey">🦃 Turkey (37/32°C, 28d)</option>
              <option value="quail">🐦 Quail (37/32°C, 17d)</option>
              <option value="pheasant">🦚 Pheasant (37/32°C, 24d)</option>
            </select>
            <button onclick="applyAnimalPreset()" class="preset-btn">Apply Preset</button>
          </div>

          <hr style="margin: 16px 0; border: none; border-top: 1px solid var(--border);">

          <button onclick="factoryReset()" class="factory-reset-btn" style="width: 100%; margin-top: 12px;">
            ⚠️ Factory Reset (Confirm)
          </button>
        </div>

        <!-- ACTIVE SENSORS CARD -->
        <div class="card">
          <h3>📡 Active Sensors</h3>
          
          <div class="sensor-details">
            <div class="detail-row">
              <span>Failsafe Mode:</span>
              <span class="detail-value">${d.failsafe_mode ? 'ENABLED' : 'DISABLED'}</span>
            </div>
            <div class="detail-row">
              <span>Signal Quality:</span>
              <span class="detail-value">${d.signal_quality ?? '--'}%</span>
            </div>
            <div class="detail-row">
              <span>Device Lock:</span>
              <span class="detail-value ${d.device_locked ? 'locked' : 'unlocked'}">${d.device_locked ? '🔒 LOCKED' : '🔓 UNLOCKED'}</span>
            </div>
            <div class="detail-row">
              <span>System Mode:</span>
              <span class="detail-value">${d.manual_control ? '🎮 MANUAL' : '🤖 AUTO'}</span>
            </div>
          </div>

          <hr style="margin: 16px 0; border: none; border-top: 1px solid var(--border);">

          <div class="lock-section">
            <p style="font-size: 13px; color: var(--text-secondary); margin-bottom: 12px;">Device Security</p>
            <div class="lock-buttons">
              <button onclick="lockDevice()" class="lock-btn danger">🔒 Lock Device</button>
              <button onclick="unlockDevice()" class="lock-btn success">🔓 Unlock Device</button>
            </div>
          </div>
        </div>

        <!-- PROGRESS INDICATOR -->
        <div class="card">
          <h3>📊 Incubation Progress</h3>
          <div class="progress-container">
            <div class="progress-bar-wrapper">
              <div class="progress-bar" style="width: ${progressPercent}%"></div>
            </div>
            <div class="progress-text">
              <span class="progress-value">${progressPercent}%</span>
              <span class="progress-days">Day ${d.day ?? '--'} of ${d.total_days ?? '--'}</span>
            </div>
          </div>
        </div>

      </div>

    </div>

    <!-- RAW DATA CARD (FULL WIDTH) -->
    <div class="card">
      <h3>📋 Raw Data</h3>
      <p style="margin-bottom: 12px; color: var(--text-secondary); font-size: 13px;">Complete device state information</p>
      <pre>${JSON.stringify(d, null, 2)}</pre>
    </div>
  `;
}

/**
 * Slider update functions
 */
function updateMaxTempFromSlider() {
  const slider = document.getElementById('maxTSlider');
  const input = document.getElementById('maxT');
  if (input && slider) input.value = slider.value;
}

function updateMinTempFromSlider() {
  const slider = document.getElementById('minTSlider');
  const input = document.getElementById('minT');
  if (input && slider) input.value = slider.value;
}

function updateTotalDays() {
  const slider = document.getElementById('totalDaysSlider');
  const input = document.getElementById('totalDays');
  if (input && slider) input.value = slider.value;
}

/**
 * Animal Preset Handler
 */
function applyAnimalPreset() {
  const preset = document.getElementById('animalPreset')?.value;
  const presets = {
    chicken: { max: 36, min: 32, days: 21 },
    duck: { max: 37, min: 30, days: 28 },
    turkey: { max: 37, min: 32, days: 28 },
    quail: { max: 37, min: 32, days: 17 },
    pheasant: { max: 37, min: 32, days: 24 }
  };

  if (preset && presets[preset]) {
    const p = presets[preset];
    const maxInput = document.getElementById('maxT');
    const minInput = document.getElementById('minT');
    const daysInput = document.getElementById('totalDays');
    
    if (maxInput) maxInput.value = p.max;
    if (minInput) minInput.value = p.min;
    if (daysInput) daysInput.value = p.days;
    
    console.log(`Applied ${preset} preset:`, p);
  }
}

/**
 * Factory Reset Handler
 */
function factoryReset() {
  if (confirm('⚠️ Are you sure? This will reset all device settings to factory defaults.')) {
    console.log('Factory reset triggered');
    // Call your MQTT or API endpoint here
  }
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
        <h3>📡 Detailed Sensor Readings</h3>
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
window.updateMaxTempFromSlider = updateMaxTempFromSlider;
window.updateMinTempFromSlider = updateMinTempFromSlider;
window.updateTotalDays = updateTotalDays;
window.applyAnimalPreset = applyAnimalPreset;
window.factoryReset = factoryReset;
