const DEVICE_ID = "BROODIINNOX-001";

const topics = {
  data: `broodinnox/${DEVICE_ID}/data`,
  status: `broodinnox/${DEVICE_ID}/status`
};

let client;

function connectMQTT() {
  const broker = "wss://test.mosquitto.org:8081/mqtt";

  client = mqtt.connect(broker);

  client.on("connect", () => {
    document.getElementById("mqttStatus").innerText = "Connected";

    client.subscribe(topics.data);
    client.subscribe(topics.status);
  });

  client.on("message", (topic, message) => {
    const data = JSON.parse(message.toString());
    window.latestData = data;
    renderDashboard();
  });

  client.on("error", () => {
    document.getElementById("mqttStatus").innerText = "Error";
  });
}

connectMQTT();

window.latestData = {};
