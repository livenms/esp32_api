function renderDashboard() {
  const data = window.latestData;

  const el = document.getElementById("content");
  if (!el) return;

  el.innerHTML = `
    <div class="card">
      <h3>System Status</h3>
      <p>Day: <b>${data.day ?? "-"}</b> / ${data.total_days ?? "-"}</p>
      <p>Relay: <b>${data.relay_state ? "ON" : "OFF"}</b></p>
      <p>Locked: <b>${data.device_locked ? "YES" : "NO"}</b></p>
    </div>

    <div class="card">
      <h3>Temperature</h3>
      <div class="grid">
        <div>Sensor 1 <div class="value">${data.sensor1 ?? "--"}°C</div></div>
        <div>Sensor 2 <div class="value">${data.sensor2 ?? "--"}°C</div></div>
        <div>Sensor 3 <div class="value">${data.sensor3 ?? "--"}°C</div></div>
        <div>Sensor 4 <div class="value">${data.sensor4 ?? "--"}°C</div></div>
      </div>
    </div>

    <div class="card">
      <h3>Average Temperature</h3>
      <div class="value">${data.ave_temp ?? "--"}°C</div>
    </div>

    <div class="card">
      <h3>Network</h3>
      <p>Signal: ${data.signal_quality ?? "-"}</p>
      <p>Status: ${data.failsafe_mode ? "FAILSAFE" : "NORMAL"}</p>
    </div>
  `;
}

function showPage(page) {
  const el = document.getElementById("content");

  if (page === "dashboard") {
    renderDashboard();
  }

  if (page === "sensors") {
    el.innerHTML = `
      <div class="card">
        <h3>Raw Sensor View</h3>
        <pre>${JSON.stringify(window.latestData, null, 2)}</pre>
      </div>
    `;
  }

  if (page === "control") {
    el.innerHTML = `
      <div class="card">
        <h3>Control Panel</h3>
        <p>Direct control via MQTT not enabled in UI (ESP32 handles logic).</p>
      </div>
    `;
  }
}

window.showPage = showPage;
