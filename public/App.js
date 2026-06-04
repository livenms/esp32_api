/* ═══════════════════════════════════════════════
   BROODINNOX DASHBOARD — app.js
   Socket.IO + Chart.js · Professional UI
   ═══════════════════════════════════════════════ */

// ── Socket.IO ──
const socket = io();

// ── State ──
let chartData    = [];
let sensorStates = { s1: true, s2: true, s3: true, s4: true };
let weeklyEnabled = true;
let tempChart    = null;
let sensorChart  = null;

// ─────────────────────────────────────────────
//  CLOCK
// ─────────────────────────────────────────────
function startClock() {
  const el = document.getElementById('topbarTime');
  setInterval(() => {
    el.textContent = new Date().toLocaleTimeString('en-US', { hour12: false });
  }, 1000);
}

// ─────────────────────────────────────────────
//  NAVIGATION
// ─────────────────────────────────────────────
function initNav() {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', e => {
      e.preventDefault();
      const panel = item.dataset.panel;
      document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
      document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
      item.classList.add('active');
      document.getElementById('panel-' + panel).classList.add('active');
      document.getElementById('bcCurrent').textContent =
        item.querySelector('span:last-child').textContent;
    });
  });
}

// ─────────────────────────────────────────────
//  CHARTS
// ─────────────────────────────────────────────
function initCharts() {
  // Main temperature chart
  const ctx = document.getElementById('tempChart').getContext('2d');
  tempChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [
        {
          label: 'Avg Temp', data: [],
          borderColor: '#25e87a', backgroundColor: 'rgba(37,232,122,.07)',
          borderWidth: 2, fill: true, tension: .4,
          pointRadius: 0, pointHoverRadius: 4
        }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      animation: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#111a17',
          titleColor: '#4d6b5e',
          bodyColor: '#e2f0e8',
          borderColor: '#1e2d27', borderWidth: 1,
          padding: 10, displayColors: false,
          callbacks: {
            title: ctx => new Date(ctx[0].label).toLocaleTimeString(),
            label: ctx => `Temp: ${ctx.parsed.y.toFixed(1)}°C`
          }
        }
      },
      scales: {
        x: {
          type: 'time',
          time: { unit: 'minute', displayFormats: { minute: 'HH:mm', hour: 'HH:mm' } },
          grid: { color: 'rgba(255,255,255,.03)', drawBorder: false },
          ticks: { color: '#4d6b5e', font: { family: 'JetBrains Mono', size: 9 }, maxTicksLimit: 6 }
        },
        y: {
          beginAtZero: false,
          grid: { color: 'rgba(255,255,255,.03)', drawBorder: false },
          ticks: { color: '#4d6b5e', font: { family: 'JetBrains Mono', size: 9 }, callback: v => v + '°C' }
        }
      }
    }
  });

  // Sensor comparison chart
  const sctx = document.getElementById('sensorChart').getContext('2d');
  sensorChart = new Chart(sctx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [
        { label: 'DS1', data: [], borderColor: '#25e87a', backgroundColor: 'rgba(37,232,122,.06)', borderWidth: 1.5, fill: false, tension: .4, pointRadius: 0 },
        { label: 'DS2', data: [], borderColor: '#38d4ff', backgroundColor: 'rgba(56,212,255,.06)', borderWidth: 1.5, fill: false, tension: .4, pointRadius: 0 },
        { label: 'DS3', data: [], borderColor: '#ff7d3b', backgroundColor: 'rgba(255,125,59,.06)', borderWidth: 1.5, fill: false, tension: .4, pointRadius: 0 },
        { label: 'DS4', data: [], borderColor: '#c47bff', backgroundColor: 'rgba(196,123,255,.06)', borderWidth: 1.5, fill: false, tension: .4, pointRadius: 0 },
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      animation: false,
      plugins: {
        legend: {
          display: true,
          labels: { color: '#4d6b5e', boxWidth: 12, font: { family: 'JetBrains Mono', size: 10 } }
        }
      },
      scales: {
        x: {
          type: 'time',
          time: { unit: 'minute', displayFormats: { minute: 'HH:mm' } },
          grid: { color: 'rgba(255,255,255,.03)', drawBorder: false },
          ticks: { color: '#4d6b5e', font: { family: 'JetBrains Mono', size: 9 }, maxTicksLimit: 6 }
        },
        y: {
          beginAtZero: false,
          grid: { color: 'rgba(255,255,255,.03)', drawBorder: false },
          ticks: { color: '#4d6b5e', font: { family: 'JetBrains Mono', size: 9 }, callback: v => v + '°C' }
        }
      }
    }
  });
}

function pushChartPoint(data) {
  const ts = Date.now();
  const MAX = 600;

  chartData.push({
    timestamp: ts,
    temperature: parseFloat(data.temperature),
    cycle_day: data.cycle_day,
    relay_status: data.relay_status,
    s1: safeTemp(data.sensors?.temp1),
    s2: safeTemp(data.sensors?.temp2),
    s3: safeTemp(data.sensors?.temp3),
    s4: safeTemp(data.sensors?.temp4),
  });
  if (chartData.length > MAX) chartData = chartData.slice(-MAX);

  updateChart();
}

function safeTemp(v) {
  const f = parseFloat(v);
  return (isNaN(f) || v === 'NaN') ? null : f;
}

function updateChart() {
  if (!tempChart || chartData.length === 0) return;
  const labels = chartData.map(d => d.timestamp);
  tempChart.data.labels = labels;
  tempChart.data.datasets[0].data = chartData.map(d => d.temperature);
  tempChart.update('none');

  sensorChart.data.labels = labels;
  sensorChart.data.datasets[0].data = chartData.map(d => d.s1);
  sensorChart.data.datasets[1].data = chartData.map(d => d.s2);
  sensorChart.data.datasets[2].data = chartData.map(d => d.s3);
  sensorChart.data.datasets[3].data = chartData.map(d => d.s4);
  sensorChart.update('none');
}

// Chart range buttons
document.querySelectorAll('.range-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.range-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const map = { '1h': 'minute', '6h': 'minute', '24h': 'hour' };
    if (tempChart) {
      tempChart.options.scales.x.time.unit = map[btn.dataset.range] || 'minute';
      tempChart.update();
    }
  });
});

// ─────────────────────────────────────────────
//  SOCKET.IO
// ─────────────────────────────────────────────
socket.on('connect', () => {
  setPill('serverStatus', 'online', 'Connected');
  loadInitialData();
});

socket.on('disconnect', () => {
  setPill('serverStatus', 'error', 'Disconnected');
  setPill('deviceStatusPill', 'error', 'Offline');
});

socket.on('deviceUpdate', data => {
  updateDashboard(data);
  pushChartPoint(data);
});

socket.on('historicalData', data => {
  if (!Array.isArray(data)) return;
  chartData = data.map(d => ({
    timestamp: d.timestamp * 1000,
    temperature: parseFloat(d.temperature),
    cycle_day: d.cycle_day,
    relay_status: d.relay_status,
    s1: null, s2: null, s3: null, s4: null
  }));
  updateChart();
});

async function loadInitialData() {
  try {
    const r  = await fetch('/api/device');
    const d  = await r.json();
    updateDashboard(d);

    const hr = await fetch('/api/history?limit=200');
    const h  = await hr.json();
    chartData = h.map(d => ({
      timestamp: d.timestamp * 1000,
      temperature: parseFloat(d.temperature),
      cycle_day: d.cycle_day,
      relay_status: d.relay_status,
      s1: null, s2: null, s3: null, s4: null
    }));
    updateChart();
  } catch(e) {
    console.error('Load error:', e);
    showToast('Could not load initial data', 'error');
  }
}

// ─────────────────────────────────────────────
//  DASHBOARD UPDATE
// ─────────────────────────────────────────────
function updateDashboard(data) {
  const temp = parseFloat(data.temperature) || 0;
  const max  = parseInt(data.max_temp) || 0;
  const min  = parseInt(data.min_temp) || 0;
  const day  = data.cycle_day || 0;
  const total= data.total_days || 30;
  const pct  = Math.min(100, Math.round((day / total) * 100));

  // Connection pills
  if (data.status === 'online') {
    setPill('deviceStatusPill', 'online', 'Online');
    setPill('mqttStatus', 'online', 'Connected');
  } else {
    setPill('deviceStatusPill', '', 'Offline');
  }

  // Device IDs
  setText('topbarDeviceId', data.device_id || '—');
  setText('sidebarDeviceId', data.device_id || '—');
  setText('sidebarLastSeen', data.lastSeen ? new Date(data.lastSeen).toLocaleTimeString() : '—');

  // KPI row
  setText('kpiTemp',   temp.toFixed(1) + '°C');
  setText('kpiDay',    `${day} / ${total}`);
  setText('kpiRelay',  data.relay_status || '—');
  setText('kpiMode',   data.relay_mode || '—');
  setText('kpiAnimal', data.animal_type || '—');
  document.getElementById('kpiRelay').style.color = data.relay_status === 'ON' ? 'var(--orange)' : 'var(--muted)';

  // Period
  let period = 'NIGHT';
  if (data.evening_active) period = 'EVENING';
  else if (data.is_daytime) period = 'DAYTIME';
  setText('kpiPeriod', period);

  // Temperature card
  setText('ovTemp', temp.toFixed(1));
  setText('ovMin',  min + '°C');
  setText('ovMax',  max + '°C');

  const err = data.error || 'OK';
  setText('ovError', err);
  document.getElementById('ovError').className = 'tm-val ' + (err === 'OK' ? 'accent-green' : 'accent-danger');

  // Temp status badge
  const badge  = tempStatusBadge(temp, min, max);
  setText('tempStatusBadge', badge.text);
  document.getElementById('tempStatusBadge').className = 'temp-status-badge ' + badge.cls;
  setText('tempBadgeOv', badge.text);
  document.getElementById('tempBadgeOv').className = 'card-badge ' + badge.cls;

  // Failsafe banner
  document.getElementById('failsafeBadge').classList.toggle('show', !!data.failsafe);

  // Heater
  const relayOn = data.relay_status === 'ON';
  document.getElementById('heaterRing').className = 'heater-ring' + (relayOn ? ' on' : '');
  setText('heaterState', relayOn ? 'ON' : 'OFF');
  document.getElementById('heaterState').style.color = relayOn ? 'var(--orange)' : 'var(--muted)';
  setText('heaterSub', data.relay_mode === 'MANUAL' ? 'Manual override' : 'Automatic control');
  setText('relayModeTag', data.relay_mode || 'AUTO');
  setText('kpiMode', data.relay_mode || 'AUTO');

  // Evening cycle
  const cycleActive = !!data.evening_active;
  document.getElementById('cycleDot').className = 'cycle-dot' + (cycleActive ? ' active' : '');
  setText('cycleText', cycleActive ? `Evening cycle: ${relayOn ? 'Heating' : 'Rest phase'}` : 'Evening cycle: inactive');

  // Progress
  setText('progDay',   day);
  setText('progTotal', total);
  setText('progPct',   pct + '%');
  document.getElementById('progFill').style.width = pct + '%';

  // System info
  setText('infoDevId',    data.device_id   || '—');
  setText('infoTransport',data.transport   || 'GSM');
  setText('infoMode',     data.mode        || data.relay_mode || '—');
  setText('infoError',    err);
  document.getElementById('infoError').className = 'info-v ' + (err === 'OK' ? 'accent-green' : 'accent-danger');
  setText('infoWeekly',   data.weekly_reduce_enabled ? 'Enabled' : 'Disabled');
  setText('infoFailsafe', data.failsafe ? 'ACTIVE' : 'Normal');
  document.getElementById('infoFailsafe').className = 'info-v ' + (data.failsafe ? 'accent-danger' : 'accent-green');

  // Sliders sync
  if (max) { document.getElementById('maxTempSlider').value = max; document.getElementById('maxTempDisplay').textContent = max + '°C'; }
  if (min) { document.getElementById('minTempSlider').value = min; document.getElementById('minTempDisplay').textContent = min + '°C'; }
  if (total) { document.getElementById('totalDaysSlider').value = total; document.getElementById('totalDaysDisplay').textContent = total; }

  // Sensors panel
  if (data.sensors) {
    updateSensorBig(1, data.sensors.temp1, data.sensors.s1_active);
    updateSensorBig(2, data.sensors.temp2, data.sensors.s2_active);
    updateSensorBig(3, data.sensors.temp3, data.sensors.s3_active);
    updateSensorBig(4, data.sensors.temp4, data.sensors.s4_active);
    sensorStates = {
      s1: data.sensors.s1_active,
      s2: data.sensors.s2_active,
      s3: data.sensors.s3_active,
      s4: data.sensors.s4_active,
    };
    syncToggles();
  }

  // Weekly toggle
  if (data.weekly_reduce_enabled !== undefined) {
    weeklyEnabled = data.weekly_reduce_enabled;
    document.getElementById('weeklyTgl').className = 'tgl' + (weeklyEnabled ? ' on' : '');
  }
}

function updateSensorBig(n, val, active) {
  const card   = document.getElementById('sb' + n);
  const tempEl = document.getElementById('sb' + n + 'temp');
  const statEl = document.getElementById('sb' + n + 'status');

  if (!active) {
    card.className = 'sensor-big disabled';
    tempEl.textContent = '—';
    tempEl.style.color = 'var(--muted)';
    statEl.textContent = 'Disabled';
    return;
  }

  const f = parseFloat(val);
  const bad = isNaN(f) || val === 'NaN' || val === 'N/A';

  if (bad) {
    card.className = 'sensor-big error';
    tempEl.textContent = 'ERR';
    tempEl.style.color = 'var(--danger)';
    statEl.textContent = 'No reading';
  } else {
    card.className = 'sensor-big active';
    tempEl.textContent = f.toFixed(1);
    tempEl.style.color = 'var(--accent)';
    statEl.textContent = 'Active';
  }
}

function syncToggles() {
  for (let i = 1; i <= 4; i++) {
    const on = sensorStates['s' + i];
    document.getElementById('tgl' + i).className = 'tgl' + (on ? ' on' : '');
  }
}

// ─────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────
function setPill(id, cls, text) {
  const el = document.getElementById(id);
  el.className = 'status-pill' + (cls ? ' ' + cls : '');
  el.querySelector('span:last-child').textContent = text;
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function tempStatusBadge(cur, min, max) {
  if (isNaN(cur) || !min || !max) return { text: 'N/A', cls: '' };
  if (cur < min - 2)  return { text: 'TOO COLD', cls: 'cold' };
  if (cur < min)      return { text: 'BELOW MIN', cls: 'cold' };
  if (cur > max + 2)  return { text: 'TOO HOT',  cls: 'danger' };
  if (cur > max)      return { text: 'ABOVE MAX', cls: 'hot' };
  return { text: 'NORMAL', cls: '' };
}

// ─────────────────────────────────────────────
//  CONTROLS (call REST API → server forwards to MQTT)
// ─────────────────────────────────────────────
async function controlRelay(cmd) {
  try {
    const r = await fetch('/api/control/relay', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command: cmd })
    });
    if (r.ok) showToast(`Heater → ${cmd}`, 'success');
    else throw new Error();
  } catch { showToast('Failed to control relay', 'error'); }
}

async function applySettings() {
  const max   = parseInt(document.getElementById('maxTempSlider').value);
  const min   = parseInt(document.getElementById('minTempSlider').value);
  const total = parseInt(document.getElementById('totalDaysSlider').value);

  if (min >= max) { showToast('Min must be less than Max', 'warning'); return; }

  try {
    await Promise.all([
      fetch('/api/control/temperature', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ max_temp: max, min_temp: min })
      }),
      fetch('/api/control/total-days', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ total_days: total })
      })
    ]);
    showToast('Settings applied', 'success');
  } catch { showToast('Failed to apply settings', 'error'); }
}

async function toggleWeekly() {
  weeklyEnabled = !weeklyEnabled;
  document.getElementById('weeklyTgl').className = 'tgl' + (weeklyEnabled ? ' on' : '');
  try {
    await fetch('/api/control/weekly-reduce', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: weeklyEnabled })
    });
    showToast('Weekly reduce: ' + (weeklyEnabled ? 'ON' : 'OFF'));
  } catch { showToast('Failed', 'error'); }
}

async function reduceNow() {
  try {
    await fetch('/api/control/reduce-now', { method: 'POST', headers: { 'Content-Type': 'application/json' } });
    showToast('Temperature reduction triggered');
  } catch { showToast('Failed', 'error'); }
}

async function toggleSensor(n) {
  const key = 's' + n;
  sensorStates[key] = !sensorStates[key];
  syncToggles();
  try {
    await fetch('/api/control/sensor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sensor: n, state: sensorStates[key] ? 'ON' : 'OFF' })
    });
    showToast(`DS${n} sensor ${sensorStates[key] ? 'enabled' : 'disabled'}`);
  } catch { showToast('Failed', 'error'); }
}

// ─────────────────────────────────────────────
//  TOAST
// ─────────────────────────────────────────────
let toastTimer = null;
function showToast(msg, type = 'success') {
  const el  = document.getElementById('toast');
  const ico = document.getElementById('toastIcon');
  const txt = document.getElementById('toastMsg');
  txt.textContent = msg;
  ico.textContent = type === 'error' ? '✕' : type === 'warning' ? '!' : '✓';
  el.className = 'toast show ' + type;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
}

// ─────────────────────────────────────────────
//  INIT
// ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  startClock();
  initNav();
  initCharts();
});
