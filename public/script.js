const DEVICE_ID = "BROODIINNOX-001";
const broker = "wss://test.mosquitto.org:8081/mqtt";

let client;

const topics = {
  data: `broodinnox/${DEVICE_ID}/data`,
  status: `broodinnox/${DEVICE_ID}/status`,
  relay: `broodinnox/${DEVICE_ID}/control/relay`,
  maxTemp: `broodinnox/${DEVICE_ID}/control/max_temp`,
  minTemp: `broodinnox/${DEVICE_ID}/control/min_temp`,
  lock: `broodinnox/${DEVICE_ID}/control/device_active`
};

window.latestData = {};

function connectMQTT() {
  client = mqtt.connect(broker);

  client.on("connect", () => {
    document.getElementById("mqttStatus").innerText = "Connected";

    client.subscribe(topics.data);
    client.subscribe(topics.status);
  });

  client.on("message", (topic, message) => {
    try {
      const data = JSON.parse(message.toString());
      window.latestData = data;
      renderDashboard();
    } catch (e) {}
  });
}

function publish(topic, msg) {
  if (!client || !client.connected) {
    alert("MQTT not connected");
    return;
  }
  client.publish(topic, msg.toString());
}

/* ---------------- CONTROL FUNCTIONS ---------------- */

window.setRelay = function (state) {
  publish(topics.relay, state); // ON / OFF / AUTO
};

window.setMaxTemp = function (val) {
  publish(topics.maxTemp, val);
};

window.setMinTemp = function (val) {
  publish(topics.minTemp, val);
};

window.lockDevice = function () {
  publish(topics.lock, "LOCKED");
};

window.unlockDevice = function () {
  publish(topics.lock, "ACTIVE");
};

connectMQTT();
