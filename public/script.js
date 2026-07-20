const DEVICE_ID = "BROODIINNOX-001";
const broker = "wss://test.mosquitto.org:8081/mqtt";

let client;

const topics = {
  data: `broodinnox/${DEVICE_ID}/data`,
  status: `broodinnox/${DEVICE_ID}/status`,
  relay: `broodinnox/${DEVICE_ID}/control/relay`,
  maxTemp: `broodinnox/${DEVICE_ID}/control/max_temp`,
  minTemp: `broodinnox/${DEVICE_ID}/control/min_temp`,
  sensor: `broodinnox/${DEVICE_ID}/control/sensor`,
  lock: `broodinnox/${DEVICE_ID}/control/device_active`
};

window.latestData = {};

// ---------------------------------------------------------------
// CONNECTION STATE
//  - brokerConnected: is THIS BROWSER connected to the MQTT broker?
//  - deviceOnline:    is the ESP32 device itself alive & publishing?
// These are two different things - the browser can be connected to
// the broker while the ESP32 is powered off / offline, and vice versa.
// ---------------------------------------------------------------
window.brokerConnected = false;
window.deviceOnline = null; // null = unknown/connecting yet

let lastDeviceSeen = 0;

// The ESP32 publishes a heartbeat/status message every 30s (HEARTBEAT_INTERVAL)
// and sensor data every 5s while connected. If we hear nothing for this long,
// treat the device as offline even if we never receive an explicit LWT message
// (LWT delivery on a public broker like test.mosquitto.org isn't always fast).
const DEVICE_STALE_MS = 45000; // 45s

function markDeviceSeen() {
  lastDeviceSeen = Date.now();
  if (window.deviceOnline !== true) {
    window.deviceOnline = true;
    if (window.updateConnectionBanner) window.updateConnectionBanner();
  }
}

function connectMQTT() {
  client = mqtt.connect(broker, {
    reconnectPeriod: 3000,
  });

  client.on("connect", () => {
    window.brokerConnected = true;
    if (window.updateConnectionBanner) window.updateConnectionBanner();

    client.subscribe(topics.data);
    client.subscribe(topics.status);
  });

  client.on("reconnect", () => {
    window.brokerConnected = false;
    if (window.updateConnectionBanner) window.updateConnectionBanner();
  });

  client.on("close", () => {
    window.brokerConnected = false;
    // If we've lost the broker, we can't know the device's real state either.
    window.deviceOnline = null;
    if (window.updateConnectionBanner) window.updateConnectionBanner();
  });

  client.on("offline", () => {
    window.brokerConnected = false;
    window.deviceOnline = null;
    if (window.updateConnectionBanner) window.updateConnectionBanner();
  });

  client.on("error", () => {
    window.brokerConnected = false;
    if (window.updateConnectionBanner) window.updateConnectionBanner();
  });

  client.on("message", (topic, msg) => {
    const payload = msg.toString();

    if (topic === topics.status) {
      // The ESP32 publishes {"status":"online"|"offline", ...} here,
      // including via its MQTT Last-Will-and-Testament when it drops off.
      try {
        const statusMsg = JSON.parse(payload);
        if (statusMsg.status === "offline") {
          window.deviceOnline = false;
          if (window.updateConnectionBanner) window.updateConnectionBanner();
          return;
        }
        if (statusMsg.status === "online") {
          markDeviceSeen();
        }
      } catch (e) {
        // Plain-text "offline" LWT payload
        if (payload === "offline") {
          window.deviceOnline = false;
          if (window.updateConnectionBanner) window.updateConnectionBanner();
          return;
        }
        if (payload === "online") {
          markDeviceSeen();
        }
      }
      return;
    }

    if (topic === topics.data) {
      try {
        window.latestData = JSON.parse(payload);
        markDeviceSeen();
        renderDashboard();
      } catch (e) {}
    }
  });
}

// Watchdog: if no message from the device in DEVICE_STALE_MS, flip it offline
// even without an explicit offline message.
setInterval(() => {
  if (window.deviceOnline === true && Date.now() - lastDeviceSeen > DEVICE_STALE_MS) {
    window.deviceOnline = false;
    if (window.updateConnectionBanner) window.updateConnectionBanner();
  }
}, 5000);

function publish(topic, msg) {
  if (!client || !client.connected) {
    alert("MQTT not connected");
    return;
  }
  client.publish(topic, String(msg));
}

/* ---------------- CONTROL FUNCTIONS ---------------- */

window.setRelay = (state) => {
  publish(topics.relay, state);
};

window.setMaxTemp = () => {
  const v = document.getElementById("maxT").value;
  publish(topics.maxTemp, v);
};

window.setMinTemp = () => {
  const v = document.getElementById("minT").value;
  publish(topics.minTemp, v);
};

window.toggleSensor = (id) => {
  const d = window.latestData || {};
  const current = d[`s${id.slice(-1).toLowerCase()}_enabled`] ? "ON" : "OFF";
  const next = current === "ON" ? "OFF" : "ON";
  publish(topics.sensor, `${id}:${next}`);
};

window.lockDevice = () => publish(topics.lock, "LOCKED");
window.unlockDevice = () => publish(topics.lock, "ACTIVE");

connectMQTT();
