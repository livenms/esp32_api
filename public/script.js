const DEVICE_ID = "BROODIINNOX-001";
const broker = "wss://test.mosquitto.org:8081/mqtt";

let client;

const topics = {
  data: `broodinnox/${DEVICE_ID}/data`,
  relay: `broodinnox/${DEVICE_ID}/control/relay`,
  maxTemp: `broodinnox/${DEVICE_ID}/control/max_temp`,
  minTemp: `broodinnox/${DEVICE_ID}/control/min_temp`,
  sensor: `broodinnox/${DEVICE_ID}/control/sensor`,
  lock: `broodinnox/${DEVICE_ID}/control/device_active`
};

window.latestData = {};

function connectMQTT() {
  client = mqtt.connect(broker);

  client.on("connect", () => {
    document.getElementById("mqttStatus").innerText = "Connected";

    client.subscribe(topics.data);
  });

  client.on("message", (topic, msg) => {
    try {
      window.latestData = JSON.parse(msg.toString());
      renderDashboard();
    } catch (e) {}
  });
}

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
