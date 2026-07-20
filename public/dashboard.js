/**
 * Dashboard Rendering - Broodinnox Control Panel
 * Renders live system state into the instrument-panel layout.
 */

const PAGE_META = {
  dashboard: { title: "Dashboard", eyebrow: "Live monitoring" },
  sensors:   { title: "Sensors",   eyebrow: "Sensor diagnostics" },
  control:   { title: "Control",   eyebrow: "Manual control" },
};

/* ---------------- GAUGE ---------------- */
function buildGauge(d) {
  const minT = typeof d.min_temp === "number" ? d.min_temp : 30;
  const maxT = typeof d.max_temp === "number" ? d.max_temp : 38;
  const val = typeof d.ave_temp === "number" && d.ave_temp > -900 ? d.ave_temp : null;

  const low = minT - 6;
  const high = maxT + 6;
  const R = 80;
  const ARC_LEN = Math.PI * R;

  let percent = 0;
  if (val !== null) {
    percent = (val - low) / (high - low);
    percent = Math.max(0, Math.min(1, percent));
  }
  const dashoffset = ARC_LEN * (1 - percent);

  let state = "ok";
  let caption = "IN RANGE";
  if (d.failsafe_mode || d.sensor_error) {
    state = "fault";
    caption = d.failsafe_mode ? "FAILSAFE ACTIVE" : "SENSOR FAULT";
  } else if (val === null) {
    state = "fault";
    caption = "NO READING";
  } else if (val < minT) {
    state = "cold";
    caption = "BELOW SETPOINT";
  } else if (val > maxT) {
    state = "hot";
    caption = "ABOVE SETPOINT";
  }

  return `
    <div class="gauge-wrap">
      <svg class="gauge-svg" viewBox="0 0 200 118">
        <path class="gauge-track" d="M20,100 A80,80 0 0 1 180,100"></path>
        <path class="gauge-arc state-${state}" d="M20,100 A80,80 0 0 1 180,100"
              stroke-dasharray="${ARC_LEN.toFixed(2)}"
              stroke-dashoffset="${dashoffset.toFixed(2)}"></path>
      </svg>
      <div class="gauge-readout">
        <div class="gauge-value">${val !== null ? val.toFixed(1) : "--"}<span class="gauge-unit">&deg;C</span></div>
        <div class="gauge-caption state-${state}">${caption}</div>
      </div>
      <div class="gauge-range">
        <span>${minT}&deg;C min</span>
        <span>${maxT}&deg;C max</span>
      </div>
    </div>
  `;
}

/* ---------------- SENSOR BANK ---------------- */
function buildSensorBank(d) {
  const sensors = [
    { id: "DS1", enabled: !!d.s1_enabled, val: d.sensor1 },
    { id: "DS2", enabled: !!d.s2_enabled, val: d.sensor2 },
    { id: "DS3", enabled: !!d.s3_enabled, val: d.sensor3 },
    { id: "DS4", enabled: !!d.s4_enabled, val: d.sensor4 },
  ];

  return `
    <div class="sensor-bank">
      ${sensors.map((s) => `
        <div class="sensor-cell ${s.enabled ? "active" : ""}" onclick="toggleSensor('${s.id}')" style="cursor:pointer;" title="Click to toggle ${s.id}">
          <span class="sensor-cell-led"></span>
          <span class="sensor-cell-label">${s.id}</span>
          <span class="sensor-cell-reading">${
            typeof s.val === "number" ? s.val.toFixed(1) + "&deg;" : (s.enabled ? "ERR" : "OFF")
          }</span>
        </div>
      `).join("")}
    </div>
  `;
}

/* ---------------- HEAT LAMP MODULE ---------------- */
function buildLampModule(d) {
  const on = !!d.relay_state;
  return `
    <div class="lamp-module">
      <div class="lamp-icon ${on ? "on" : ""}">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path d="M12 2C12 2 6 9.5 6 14.5C6 18.09 8.69 21 12 21C15.31 21 18 18.09 18 14.5C18 9.5 12 2 12 2Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>
        </svg>
      </div>
      <div>
        <div class="lamp-status-text">${on ? "Heat lamp ON" : "Heat lamp OFF"}</div>
        <div class="lamp-status-sub">${d.manual_control ? "Manual override" : "Automatic control"}</div>
      </div>
    </div>
  `;
}

/* ---------------- INCUBATION TIMELINE ---------------- */
function buildTimeline(d) {
  const day = d.day ?? 0;
  const total = d.total_days ?? 0;
  const percent = total ? Math.round((day / total) * 100) : 0;
  const tickCount = total > 0 ? Math.min(total, 60) : 0;

  let ticks = "";
  for (let i = 1; i <= tickCount; i++) {
    const dayForTick = total > 60 ? Math.round(i * (total / tickCount)) : i;
    let cls = "";
    if (dayForTick < day) cls = "done";
    else if (dayForTick === day) cls = "today";
    ticks += `<div class="timeline-tick ${cls}"></div>`;
  }

  return `
    <div class="timeline-header">
      <div class="timeline-day">${day}<span> / ${total || "--"} days</span></div>
      <div class="timeline-percent">${percent}%</div>
    </div>
    <div class="timeline-track">${ticks}</div>
  `;
}

/* ---------------- MAIN DASHBOARD ---------------- */
function renderDashboard() {
  const d = window.latestData || {};
  const el = document.getElementById("content");
  if (!el) return;

  el.innerHTML = `
    <!-- TOP BANNER -->
    <div class="top-banner">
      <div class="banner-left">
        <h1>Broodinnox Smart Brooding</h1>
        <p>GSM + MQTT incubation controller &middot; Device: <strong>${d.device_id ?? "BROODIINNOX-001"}</strong></p>
      </div>
      <div class="banner-right">
        <div class="connection-status">
          <span id="brokerStatusIcon" class="status-dot">&#9679;</span>
          <span id="brokerStatusText">Broker: Connecting...</span>
        </div>
        <div class="connection-status">
          <span id="deviceStatusIcon" class="status-dot">&#9679;</span>
          <span id="deviceStatusText">Device: Unknown</span>
        </div>
      </div>
    </div>

    <!-- MAIN GRID -->
    <div class="dashboard-grid">

      <!-- LEFT COLUMN -->
      <div class="grid-left">

        <div class="card">
          <h3>Temperature</h3>
          ${buildGauge(d)}
        </div>

        <div class="card">
          <h3>Sensor Bank</h3>
          ${buildSensorBank(d)}
        </div>

        <div class="card">
          <h3>Incubation Progress</h3>
          ${buildTimeline(d)}
        </div>

      </div>

      <!-- RIGHT COLUMN -->
      <div class="grid-right">

        <div class="card">
          <h3>Heating Relay</h3>
          ${buildLampModule(d)}

          <div class="segmented">
            <button onclick="setRelay('AUTO')" class="${!d.manual_control ? "active" : ""}">AUTO</button>
            <button onclick="setRelay('ON')" class="${d.manual_control && d.relay_state ? "active" : ""}">ON</button>
            <button onclick="setRelay('OFF')" class="${d.manual_control && !d.relay_state ? "active" : ""}">OFF</button>
          </div>

          <hr>

          <p style="font-size:12px; text-transform:uppercase; letter-spacing:0.5px; color:var(--text-tertiary); margin-bottom:10px;">Animal Preset</p>
          <select id="animalPreset" class="preset-select">
            <option value="chicken">Chicken &middot; 36/32&deg;C, 21d</option>
            <option value="duck">Duck &middot; 37/30&deg;C, 28d</option>
            <option value="turkey">Turkey &middot; 37/32&deg;C, 28d</option>
            <option value="quail">Quail &middot; 37/32&deg;C, 17d</option>
            <option value="pheasant">Pheasant &middot; 37/32&deg;C, 24d</option>
          </select>
          <button onclick="applyAnimalPreset()" class="preset-btn">Apply preset</button>

          <hr>

          <button onclick="factoryReset()" class="factory-reset-btn">Factory reset&hellip;</button>
        </div>

        <div class="card">
          <h3>Setpoints</h3>

          <div class="slider-group">
            <div class="slider-label">
              <span>Max temperature</span>
              <span class="slider-value">${d.max_temp ?? "--"}&deg;C</span>
            </div>
            <input type="range" id="maxTSlider" min="20" max="40" step="0.5" value="${d.max_temp ?? 38}" onchange="updateMaxTempFromSlider()" class="slider"/>
            <input type="number" id="maxT" placeholder="Max temp" step="0.1" onchange="setMaxTemp()" class="slider-input"/>
          </div>

          <div class="slider-group">
            <div class="slider-label">
              <span>Min temperature</span>
              <span class="slider-value">${d.min_temp ?? "--"}&deg;C</span>
            </div>
            <input type="range" id="minTSlider" min="20" max="40" step="0.5" value="${d.min_temp ?? 36}" onchange="updateMinTempFromSlider()" class="slider"/>
            <input type="number" id="minT" placeholder="Min temp" step="0.1" onchange="setMinTemp()" class="slider-input"/>
          </div>

          <div class="slider-group">
            <div class="slider-label">
              <span>Total days</span>
              <span class="slider-value">${d.total_days ?? "--"}</span>
            </div>
            <input type="range" id="totalDaysSlider" min="18" max="35" step="1" value="${d.total_days ?? 21}" onchange="updateTotalDays()" class="slider"/>
            <input type="number" id="totalDays" placeholder="Total days" step="1" onchange="setTotalDays()" class="slider-input"/>
          </div>
        </div>

        <div class="card">
          <h3>System</h3>
          <div class="sensor-details">
            <div class="detail-row">
              <span>Failsafe mode</span>
              <span class="detail-value">${d.failsafe_mode ? "ENABLED" : "DISABLED"}</span>
            </div>
            <div class="detail-row">
              <span>Signal quality</span>
              <span class="detail-value">${d.signal_quality ?? "--"}</span>
            </div>
            <div class="detail-row">
              <span>Device lock</span>
              <span class="detail-value ${d.device_locked ? "locked" : "unlocked"}">${d.device_locked ? "LOCKED" : "UNLOCKED"}</span>
            </div>
            <div class="detail-row">
              <span>System mode</span>
              <span class="detail-value">${d.manual_control ? "MANUAL" : "AUTO"}</span>
            </div>
          </div>

          <hr>

          <p style="font-size:12px; text-transform:uppercase; letter-spacing:0.5px; color:var(--text-tertiary); margin-bottom:10px;">Device Security</p>
          <div class="lock-buttons">
            <button onclick="lockDevice()" class="lock-btn danger">Lock device</button>
            <button onclick="unlockDevice()" class="lock-btn success">Unlock device</button>
          </div>
        </div>

      </div>
    </div>

    <!-- RAW TELEMETRY (collapsed by default) -->
    <details class="raw-data-details">
      <summary>Raw telemetry</summary>
      <pre>${JSON.stringify(d, null, 2)}</pre>
    </details>
  `;

  updateConnectionBanner();
}

/* ---------------- SENSORS PAGE ---------------- */
function renderSensorsPage() {
  const d = window.latestData || {};
  const el = document.getElementById("content");
  if (!el) return;

  el.innerHTML = `
    <div class="dashboard-grid">
      <div class="grid-left">
        <div class="card">
          <h3>Temperature</h3>
          ${buildGauge(d)}
        </div>
        <div class="card">
          <h3>Sensor Bank</h3>
          ${buildSensorBank(d)}
          <p style="margin-top:14px; font-size:12px; color:var(--text-tertiary);">Click a sensor to enable or disable it.</p>
        </div>
      </div>
      <div class="grid-right">
        <div class="card">
          <h3>Signal &amp; Link</h3>
          <div class="sensor-details">
            <div class="detail-row">
              <span>Signal quality</span>
              <span class="detail-value">${d.signal_quality ?? "--"}</span>
            </div>
            <div class="detail-row">
              <span>Sensor error</span>
              <span class="detail-value ${d.sensor_error ? "locked" : "unlocked"}">${d.sensor_error ? "YES" : "NO"}</span>
            </div>
            <div class="detail-row">
              <span>Mismatch error</span>
              <span class="detail-value ${d.mismatch_error ? "locked" : "unlocked"}">${d.mismatch_error ? "YES" : "NO"}</span>
            </div>
            <div class="detail-row">
              <span>Failsafe mode</span>
              <span class="detail-value ${d.failsafe_mode ? "locked" : "unlocked"}">${d.failsafe_mode ? "ENABLED" : "DISABLED"}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <details class="raw-data-details" open>
      <summary>Raw telemetry</summary>
      <pre>${JSON.stringify(d, null, 2)}</pre>
    </details>
  `;

  updateConnectionBanner();
}

/* ---------------- CONNECTION BANNER + SIDEBAR ---------------- */
function updateConnectionBanner() {
  const brokerIcon = document.getElementById("brokerStatusIcon");
  const brokerText = document.getElementById("brokerStatusText");
  const deviceIcon = document.getElementById("deviceStatusIcon");
  const deviceText = document.getElementById("deviceStatusText");

  if (brokerIcon && brokerText) {
    if (window.brokerConnected) {
      brokerIcon.className = "status-dot online";
      brokerText.textContent = "Broker: Connected";
    } else {
      brokerIcon.className = "status-dot offline";
      brokerText.textContent = "Broker: Disconnected";
    }
  }

  if (deviceIcon && deviceText) {
    if (window.deviceOnline === true) {
      deviceIcon.className = "status-dot online";
      deviceText.textContent = "Device: Online";
    } else if (window.deviceOnline === false) {
      deviceIcon.className = "status-dot offline";
      deviceText.textContent = "Device: Offline";
    } else {
      deviceIcon.className = "status-dot connecting";
      deviceText.textContent = "Device: Unknown";
    }
  }

  // Persistent sidebar LEDs (visible on every page)
  const brokerLed = document.getElementById("brokerLed");
  const deviceLed = document.getElementById("deviceLed");
  const sidebarBroker = document.getElementById("mqttStatus");
  const sidebarDevice = document.getElementById("deviceStatusSidebar");

  if (brokerLed) brokerLed.className = "status-led " + (window.brokerConnected ? "online" : "offline");
  if (sidebarBroker) sidebarBroker.textContent = window.brokerConnected ? "Connected" : "Disconnected";

  if (deviceLed) {
    deviceLed.className =
      "status-led " + (window.deviceOnline === true ? "online" : window.deviceOnline === false ? "offline" : "connecting");
  }
  if (sidebarDevice) {
    sidebarDevice.textContent =
      window.deviceOnline === true ? "Online" : window.deviceOnline === false ? "Offline" : "Unknown";
  }
}
window.updateConnectionBanner = updateConnectionBanner;
updateConnectionBanner();

/* ---------------- SLIDER SYNC ---------------- */
function updateMaxTempFromSlider() {
  const slider = document.getElementById("maxTSlider");
  const input = document.getElementById("maxT");
  if (input && slider) input.value = slider.value;
}

function updateMinTempFromSlider() {
  const slider = document.getElementById("minTSlider");
  const input = document.getElementById("minT");
  if (input && slider) input.value = slider.value;
}

function updateTotalDays() {
  const slider = document.getElementById("totalDaysSlider");
  const input = document.getElementById("totalDays");
  if (input && slider) input.value = slider.value;
}

/* ---------------- ANIMAL PRESET ---------------- */
function applyAnimalPreset() {
  const preset = document.getElementById("animalPreset")?.value;
  const presets = {
    chicken: { max: 36, min: 32, days: 21 },
    duck: { max: 37, min: 30, days: 28 },
    turkey: { max: 37, min: 32, days: 28 },
    quail: { max: 37, min: 32, days: 17 },
    pheasant: { max: 37, min: 32, days: 24 },
  };

  if (preset && presets[preset]) {
    const p = presets[preset];
    const maxInput = document.getElementById("maxT");
    const minInput = document.getElementById("minT");
    const daysInput = document.getElementById("totalDays");

    if (maxInput) maxInput.value = p.max;
    if (minInput) minInput.value = p.min;
    if (daysInput) daysInput.value = p.days;
  }
}

/* ---------------- FACTORY RESET ---------------- */
function factoryReset() {
  if (confirm("This will reset all device settings to factory defaults. Continue?")) {
    console.log("Factory reset triggered");
    // Call your MQTT or API endpoint here
  }
}

/* ---------------- PAGE NAVIGATION ---------------- */
function setPage(page, btnEl) {
  document.querySelectorAll(".nav-btn").forEach((b) => b.classList.remove("active"));
  const target = btnEl || document.querySelector(`.nav-btn[data-page="${page}"]`);
  if (target) target.classList.add("active");

  const meta = PAGE_META[page] || PAGE_META.dashboard;
  const titleEl = document.getElementById("pageTitle");
  const eyebrowEl = document.getElementById("pageEyebrow");
  if (titleEl) titleEl.textContent = meta.title;
  if (eyebrowEl) eyebrowEl.textContent = meta.eyebrow;

  if (page === "sensors") {
    renderSensorsPage();
  } else {
    renderDashboard();
  }
}

// Backward-compatible alias (App.js calls showPage on load)
function showPage(page) {
  setPage(page, null);
}

/* ---------------- HEADER CLOCK ---------------- */
function startClock() {
  const clockEl = document.getElementById("headerClock");
  if (!clockEl) return;
  const tick = () => {
    clockEl.textContent = new Date().toLocaleTimeString([], { hour12: false });
  };
  tick();
  setInterval(tick, 1000);
}
startClock();

// Export for global use
window.showPage = showPage;
window.setPage = setPage;
window.renderDashboard = renderDashboard;
window.updateMaxTempFromSlider = updateMaxTempFromSlider;
window.updateMinTempFromSlider = updateMinTempFromSlider;
window.updateTotalDays = updateTotalDays;
window.applyAnimalPreset = applyAnimalPreset;
window.factoryReset = factoryReset;
