/*
  ===========================================================================
  MAIN CONTROLLER - Smart Lighting (PIR + LDR) with WiFi Maintenance Dashboard
  ===========================================================================
  Board: ESP32
  - Local PIR1 + LDR + relay-driven light, exactly like the original logic
  - Non-blocking motion hold time (no more delay(5000))
  - Remote PIR2 (on a separate NodeMCU) reports in over WiFi/HTTP
  - Built-in web dashboard for troubleshooting/maintenance:
      * live sensor states
      * mode (DAY/NIGHT)
      * relay state
      * remote PIR2 online/offline + last-seen
      * manual override (force relay ON/OFF) for testing, or return to AUTO

  WIFI MODE: this ESP32 HOSTS its own access point ("SmartLight_AP") rather
  than joining your home router. Connect the NodeMCU, and your phone/laptop
  for the dashboard, to that hotspot. The ESP32's dashboard is always at
  http://192.168.4.1 (the default ESP32 soft-AP address).
  ===========================================================================
*/

#include <WiFi.h>
#include <WebServer.h>

// ---------------------------------------------------------------------------
// Access point credentials - EDIT THESE (password must be 8+ characters)
// ---------------------------------------------------------------------------
const char* ap_ssid     = "SmartLight_AP";
const char* ap_password = "lighting123";

// ---------------------------------------------------------------------------
// Pin definitions (unchanged from your original wiring)
// ---------------------------------------------------------------------------
const int PIR1_PIN       = 25;
const int LDR_PIN        = 26;
const int RELAY_PIN      = 27;
const int POWER_LED_PIN  = 18;
const int MOTION_LED_PIN = 4;
const int STATE_LED_PIN  = 19;

// ---------------------------------------------------------------------------
// Live sensor / system state
// ---------------------------------------------------------------------------
int  pir1State   = 0;
int  ldrState    = 0;
bool nightMode   = false;
bool relayState  = false;

// Remote PIR2 (comes in over WiFi from the remote node)
int  pir2State        = 0;
bool pir2Online        = false;
unsigned long lastPir2Update = 0;
const unsigned long pir2Timeout = 5000;   // if no update in 5s, treat as offline

// Non-blocking replacement for the old delay(5000) motion hold
unsigned long motionTimer = 0;
const unsigned long motionHoldTime = 5000;

// Power LED heartbeat blink (unchanged behaviour, already millis-based)
bool powerLedState = false;
unsigned long previousBlinkMillis = 0;
const unsigned long blinkInterval = 1000;

// Maintenance manual override
bool manualOverride    = false;
bool manualRelayState  = false;

WebServer server(80);

// ---------------------------------------------------------------------------
// Core lighting logic (same behaviour as your night()/day(), just non-blocking)
// ---------------------------------------------------------------------------
void handleNight(unsigned long now) {
  digitalWrite(STATE_LED_PIN, HIGH);

  bool motionDetected = (pir1State == 1) || (pir2Online && pir2State == 1);

  if (motionDetected) {
    motionTimer = now;              // refresh the hold window on any new motion
    relayState = true;
  } else if (now - motionTimer >= motionHoldTime) {
    relayState = false;             // hold window expired, no motion -> off
  }
  // else: still inside the hold window from the last detected motion -> stay on

  digitalWrite(MOTION_LED_PIN, relayState ? HIGH : LOW);
  digitalWrite(RELAY_PIN, relayState ? HIGH : LOW);
}

void handleDay() {
  digitalWrite(STATE_LED_PIN, LOW);
  digitalWrite(MOTION_LED_PIN, LOW);
  relayState = false;
  digitalWrite(RELAY_PIN, LOW);
}

// ---------------------------------------------------------------------------
// Web dashboard (dark theme, auto-refreshing via fetch/JS, no page reloads)
// ---------------------------------------------------------------------------
const char INDEX_HTML[] PROGMEM = R"HTML(
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Smart Lighting - Maintenance Panel</title>
<style>
  :root{
    --bg:#0f1216; --panel:#171b21; --panel2:#1e232b; --border:#2a3038;
    --text:#e6e9ee; --muted:#8891a0; --green:#33d17a; --red:#ff5a5f;
    --amber:#f5b942; --accent:#4da3ff;
  }
  *{box-sizing:border-box;}
  body{
    margin:0; font-family:'Segoe UI',Roboto,Arial,sans-serif;
    background:radial-gradient(circle at top,#171b21,#0b0d10 70%);
    color:var(--text); padding:24px; min-height:100vh;
  }
  h1{font-size:20px; font-weight:600; letter-spacing:.5px; margin:0 0 4px;}
  .sub{color:var(--muted); font-size:13px; margin-bottom:24px;}
  .grid{
    display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr));
    gap:16px; max-width:900px;
  }
  .card{
    background:linear-gradient(145deg,var(--panel),var(--panel2));
    border:1px solid var(--border); border-radius:14px; padding:18px;
    box-shadow:0 4px 14px rgba(0,0,0,.35);
  }
  .card .label{font-size:12px; color:var(--muted); text-transform:uppercase; letter-spacing:.08em;}
  .card .value{font-size:26px; font-weight:700; margin-top:6px;}
  .dot{display:inline-block; width:10px; height:10px; border-radius:50%; margin-right:8px;}
  .dot.on{background:var(--green); box-shadow:0 0 8px var(--green);}
  .dot.off{background:#3a414c;}
  .dot.warn{background:var(--amber); box-shadow:0 0 8px var(--amber);}
  .dot.err{background:var(--red); box-shadow:0 0 8px var(--red);}
  .controls{margin-top:28px;}
  .controls h2{font-size:14px; color:var(--muted); text-transform:uppercase; letter-spacing:.08em; margin-bottom:12px;}
  .btnrow{display:flex; gap:10px; flex-wrap:wrap;}
  button{
    background:var(--panel2); color:var(--text); border:1px solid var(--border);
    padding:10px 18px; border-radius:10px; cursor:pointer; font-size:14px;
    transition:.15s; font-weight:600;
  }
  button:hover{border-color:var(--accent); color:var(--accent);}
  button.active{background:var(--accent); color:#0b0d10; border-color:var(--accent);}
  .footer{margin-top:28px; font-size:12px; color:var(--muted);}
</style>
</head>
<body>
  <h1>Smart Lighting - Maintenance Panel</h1>
  <div class="sub">Live status, auto-refreshing every second</div>

  <div class="grid">
    <div class="card">
      <div class="label"><span id="dotMode" class="dot"></span>Mode</div>
      <div class="value" id="valMode">--</div>
    </div>
    <div class="card">
      <div class="label"><span id="dotRelay" class="dot"></span>Relay / Light</div>
      <div class="value" id="valRelay">--</div>
    </div>
    <div class="card">
      <div class="label"><span id="dotPir1" class="dot"></span>PIR1 (local)</div>
      <div class="value" id="valPir1">--</div>
    </div>
    <div class="card">
      <div class="label"><span id="dotPir2" class="dot"></span>PIR2 (remote)</div>
      <div class="value" id="valPir2">--</div>
    </div>
    <div class="card">
      <div class="label"><span id="dotLdr" class="dot"></span>LDR</div>
      <div class="value" id="valLdr">--</div>
    </div>
    <div class="card">
      <div class="label">Uptime</div>
      <div class="value" id="valUptime">--</div>
    </div>
  </div>

  <div class="controls">
    <h2>Manual Override (Maintenance)</h2>
    <div class="btnrow">
      <button id="btnAuto" onclick="setMode('auto')">AUTO</button>
      <button id="btnOn" onclick="setMode('on')">FORCE RELAY ON</button>
      <button id="btnOff" onclick="setMode('off')">FORCE RELAY OFF</button>
    </div>
  </div>

  <div class="footer">ESP32 Smart Lighting Node · Dashboard served locally, no external connection required</div>

<script>
function setDot(id, cls){
  const el = document.getElementById(id);
  el.className = 'dot ' + cls;
}

async function setMode(mode){
  await fetch('/' + (mode === 'auto' ? 'auto' : (mode === 'on' ? 'manualon' : 'manualoff')));
  refresh();
}

async function refresh(){
  try{
    const res = await fetch('/status');
    const d = await res.json();

    document.getElementById('valMode').textContent = d.mode;
    setDot('dotMode', d.mode === 'NIGHT' ? 'warn' : 'off');

    document.getElementById('valRelay').textContent = d.relay ? 'ON' : 'OFF';
    setDot('dotRelay', d.relay ? 'on' : 'off');

    document.getElementById('valPir1').textContent = d.pir1 ? 'MOTION' : 'clear';
    setDot('dotPir1', d.pir1 ? 'on' : 'off');

    document.getElementById('valPir2').textContent =
      d.pir2online ? (d.pir2 ? 'MOTION' : 'clear') : 'offline';
    setDot('dotPir2', d.pir2online ? (d.pir2 ? 'on' : 'off') : 'err');

    document.getElementById('valLdr').textContent = d.ldr ? 'DARK' : 'LIGHT';
    setDot('dotLdr', d.ldr ? 'warn' : 'off');

    document.getElementById('valUptime').textContent = d.uptime + 's';

    document.getElementById('btnAuto').classList.toggle('active', !d.manual);
    document.getElementById('btnOn').classList.toggle('active', d.manual && d.relay);
    document.getElementById('btnOff').classList.toggle('active', d.manual && !d.relay);
  }catch(e){ /* server briefly unreachable, next tick will retry */ }
}

setInterval(refresh, 1000);
refresh();
</script>
</body>
</html>
)HTML";

// ---------------------------------------------------------------------------
// HTTP handlers
// ---------------------------------------------------------------------------
void handleRoot() {
  server.send_P(200, "text/html", INDEX_HTML);
}

void handleStatus() {
  String json = "{";
  json += "\"pir1\":" + String(pir1State) + ",";
  json += "\"pir2\":" + String(pir2State) + ",";
  json += "\"pir2online\":" + String(pir2Online ? "true" : "false") + ",";
  json += "\"ldr\":" + String(ldrState) + ",";
  json += "\"mode\":\"" + String(nightMode ? "NIGHT" : "DAY") + "\",";
  json += "\"relay\":" + String(relayState ? "true" : "false") + ",";
  json += "\"manual\":" + String(manualOverride ? "true" : "false") + ",";
  json += "\"uptime\":" + String(millis() / 1000);
  json += "}";
  server.send(200, "application/json", json);
}

// Called by the remote PIR2 node: GET /pir2?state=0 or 1
void handlePir2Update() {
  if (server.hasArg("state")) {
    pir2State = server.arg("state").toInt();
    lastPir2Update = millis();
    pir2Online = true;
    server.send(200, "text/plain", "OK");
  } else {
    server.send(400, "text/plain", "missing 'state' arg");
  }
}

void handleManualOn() {
  manualOverride = true;
  manualRelayState = true;
  server.send(200, "text/plain", "OK");
}

void handleManualOff() {
  manualOverride = true;
  manualRelayState = false;
  server.send(200, "text/plain", "OK");
}

void handleAuto() {
  manualOverride = false;
  server.send(200, "text/plain", "OK");
}

void handleNotFound() {
  server.send(404, "text/plain", "Not found");
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------
void setup() {
  Serial.begin(115200);

  pinMode(PIR1_PIN, INPUT);
  pinMode(LDR_PIN, INPUT);
  pinMode(RELAY_PIN, OUTPUT);
  pinMode(POWER_LED_PIN, OUTPUT);
  pinMode(MOTION_LED_PIN, OUTPUT);
  pinMode(STATE_LED_PIN, OUTPUT);

  digitalWrite(STATE_LED_PIN, HIGH);
  digitalWrite(POWER_LED_PIN, HIGH);
  digitalWrite(MOTION_LED_PIN, HIGH);

  // --- Host our own WiFi access point ---
  WiFi.mode(WIFI_AP);
  bool apStarted = WiFi.softAP(ap_ssid, ap_password);

  if (apStarted) {
    Serial.println("Access point started.");
    Serial.print("SSID: ");
    Serial.println(ap_ssid);
    Serial.print("Dashboard / remote PIR2 target IP: ");
    Serial.println(WiFi.softAPIP()); // normally 192.168.4.1
  } else {
    Serial.println("Failed to start access point! Check ap_password is 8+ characters.");
  }

  // --- Web server routes ---
  server.on("/", handleRoot);
  server.on("/status", handleStatus);
  server.on("/pir2", handlePir2Update);
  server.on("/manualon", handleManualOn);
  server.on("/manualoff", handleManualOff);
  server.on("/auto", handleAuto);
  server.onNotFound(handleNotFound);
  server.begin();
}

// ---------------------------------------------------------------------------
// Loop (fully non-blocking - no delay() anywhere in here)
// ---------------------------------------------------------------------------
void loop() {
  server.handleClient();

  unsigned long now = millis();

  pir1State = digitalRead(PIR1_PIN);
  ldrState  = digitalRead(LDR_PIN);
  nightMode = (ldrState == 1);

  // Remote PIR2 goes "offline" if it hasn't reported in within the timeout
  if (pir2Online && (now - lastPir2Update > pir2Timeout)) {
    pir2Online = false;
    pir2State = 0;
  }

  if (manualOverride) {
    // Maintenance mode: relay driven directly by dashboard buttons
    digitalWrite(STATE_LED_PIN, nightMode ? HIGH : LOW);
    relayState = manualRelayState;
    digitalWrite(RELAY_PIN, relayState ? HIGH : LOW);
    digitalWrite(MOTION_LED_PIN, relayState ? HIGH : LOW);
  } else if (nightMode) {
    handleNight(now);
  } else {
    handleDay();
  }

  // Power LED heartbeat blink (was already millis-based, kept as-is)
  if (now - previousBlinkMillis >= blinkInterval) {
    previousBlinkMillis = now;
    powerLedState = !powerLedState;
    digitalWrite(POWER_LED_PIN, powerLedState);
  }
}
