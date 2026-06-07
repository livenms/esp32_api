function renderDashboard() {
  const d = window.latestData || {};

  const el = document.getElementById("content");
  if (!el) return;

  el.innerHTML = `
    <div class="card">
      <h3>🧠 System Overview</h3>
      <p>Day: <b>${d.day ?? "-"}/${d.total_days ?? "-"}</b></p>
      <p>Avg Temp: <span class="value">${d.ave_temp ?? "--"} °C</span></p>
      <p>Relay: <b>${d.relay_state ? "ON" : "OFF"}</b></p>
      <p>Mode: <b>${d.manual_control ? "MANUAL" : "AUTO"}</b></p>
      <p>Lock: <b>${d.device_locked ? "LOCKED" : "ACTIVE"}</b></p>
    </div>

    <!-- 🔥 RELAY CONTROL -->
    <div class="card">
      <h3>⚡ Heater Control</h3>
      <button onclick="setRelay('ON')">Turn ON</button>
      <button onclick="setRelay('OFF')">Turn OFF</button>
      <button onclick="setRelay('AUTO')">AUTO MODE</button>
    </div>

    <!-- 🌡 TEMPERATURE CONTROL -->
    <div class="card">
      <h3>🌡 Temperature Settings</h3>

      <div>
        <input id="maxT" type="number" placeholder="Max Temp"/>
        <button onclick="setMaxTemp()">Apply Max</button>
      </div>

      <div>
        <input id="minT" type="number" placeholder="Min Temp"/>
        <button onclick="setMinTemp()">Apply Min</button>
      </div>

      <p>Current: ${d.max_temp ?? "-"}°C / ${d.min_temp ?? "-"}°C</p>
    </div>

    <!-- 🐣 SENSOR CONTROL -->
    <div class="card">
      <h3>📡 Sensor Control</h3>

      <button onclick="toggleSensor('DS1')">Toggle DS1</button>
      <button onclick="toggleSensor('DS2')">Toggle DS2</button>
      <button onclick="toggleSensor('DS3')">Toggle DS3</button>
      <button onclick="toggleSensor('DS4')">Toggle DS4</button>

      <p>Sensors: 
        DS1:${d.s1_enabled ? "ON" : "OFF"} |
        DS2:${d.s2_enabled ? "ON" : "OFF"} |
        DS3:${d.s3_enabled ? "ON" : "OFF"} |
        DS4:${d.s4_enabled ? "ON" : "OFF"}
      </p>
    </div>

    <!-- 🔐 DEVICE CONTROL -->
    <div class="card">
      <h3>🔐 Device Control</h3>

      <button onclick="lockDevice()" style="background:#c0392b">
        LOCK DEVICE
      </button>

      <button onclick="unlockDevice()" style="background:#27ae60">
        UNLOCK DEVICE
      </button>
    </div>

    <!-- 📊 RAW DATA -->
    <div class="card">
      <h3>📊 Raw Data</h3>
      <pre>${JSON.stringify(d, null, 2)}</pre>
    </div>
  `;
}

function showPage(page) {
  if (page === "dashboard") renderDashboard();
  if (page === "sensors") {
    document.getElementById("content").innerHTML =
      `<pre>${JSON.stringify(window.latestData, null, 2)}</pre>`;
  }
  if (page === "control") renderDashboard();
}

window.showPage = showPage;
