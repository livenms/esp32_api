function renderDashboard() {
  const d = window.latestData;

  const el = document.getElementById("content");
  if (!el) return;

  el.innerHTML = `
    <div class="card">
      <h3>System Status</h3>
      <p>Day: <b>${d.day ?? "-"}/${d.total_days ?? "-"}</b></p>
      <p>Relay: <b>${d.relay_state ? "ON" : "OFF"}</b></p>
      <p>Mode: <b>${d.manual_control ? "MANUAL" : "AUTO"}</b></p>
      <p>Locked: <b>${d.device_locked ? "YES" : "NO"}</b></p>
    </div>

    <div class="card">
      <h3>Temperature</h3>
      <p>Avg: <span class="value">${d.ave_temp ?? "--"}°C</span></p>
    </div>

    <div class="card">
      <h3>Live Sensors</h3>
      <p>S1: ${d.sensor1 ?? "--"}°C</p>
      <p>S2: ${d.sensor2 ?? "--"}°C</p>
      <p>S3: ${d.sensor3 ?? "--"}°C</p>
      <p>S4: ${d.sensor4 ?? "--"}°C</p>
    </div>

    <!-- 🔥 CONTROL PANEL -->
    <div class="card">
      <h3>Manual Control</h3>

      <button onclick="setRelay('ON')">Relay ON</button>
      <button onclick="setRelay('OFF')">Relay OFF</button>
      <button onclick="setRelay('AUTO')">AUTO MODE</button>

      <hr/>

      <button onclick="lockDevice()" style="background:red;color:white">
        LOCK DEVICE
      </button>

      <button onclick="unlockDevice()" style="background:green;color:white">
        UNLOCK DEVICE
      </button>
    </div>

    <div class="card">
      <h3>Temperature Control</h3>

      <input id="maxT" type="number" placeholder="Max Temp"/>
      <button onclick="setMaxTemp(document.getElementById('maxT').value)">
        Set Max
      </button>

      <br/><br/>

      <input id="minT" type="number" placeholder="Min Temp"/>
      <button onclick="setMinTemp(document.getElementById('minT').value)">
        Set Min
      </button>
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
