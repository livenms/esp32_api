/**
 * BROODINNOX Dashboard — Frontend Controller
 * Author: Muyirama Sezerano Liven
 *
 * Connects via Socket.IO to the Node server which bridges MQTT.
 * All field names match what the ESP32 firmware publishes exactly.
 */

'use strict';

// ── Socket.IO ────────────────────────────────────────────────────────────────
const socket = io();
let chartInstance = null;
let rawHistory    = [];   // full dataset from server
let activeRange   = '1h';

// ── Init ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initChart();
  setupRangeButtons();

  // Initial fetch (for page refresh without waiting for next MQTT message)
  fetch('/api/device').then(r => r.json()).then(render).catch(console.error);
  fetch('/api/history').then(r => r.json()).then(h => { rawHistory = h; renderChart(); }).catch(console.error);
});

// ── Socket events ─────────────────────────────────────────────────────────────
socket.on('connect',      () => setConnectionUI(true));
socket.on('disconnect',   () => setConnectionUI(false));
socket.on('deviceUpdate', d  => render(d));
socket.on('historyData',  h  => { rawHistory = h; renderChart(); });

// ── Connection UI ─────────────────────────────────────────────────────────────
function setConnectionUI(connected) {
  const pill = document.getElementById('status-pill');
  const txt  = document.getElementById('status-text');
  pill.classList.toggle('online',  connected);
  pill.classList.toggle('offline', !connected);
  txt.textContent = connected ? 'Online' : 'Disconnected';
}

// ── Main render ───────────────────────────────────────────────────────────────
function render(d) {
  if (!d) return;

  // Header
  setText('hdr-device-id', d.device_id || '—');
  const csq = d.signal_quality;
  setText('hdr-signal', (csq && csq !== 99) ? `${csq} CSQ` : '—');

  // Connection indicator based on device status
  const pill = document.getElementById('status-pill');
  const txt  = document.getElementById('status-text');
  if (d.status === 'online') {
    pill.classList.add('online'); pill.classList.remove('offline');
    txt.textContent = 'Online';
  } else if (d.status === 'offline') {
    pill.classList.remove('online'); pill.classList.add('offline');
    txt.textContent = 'Offline';
  }

  // ── Temperature ──────────────────────────────────────────────────────────
  const temp = (typeof d.ave_temp === 'number' && d.ave_temp > -900) ? d.ave_temp : null;
  const maxT = d.max_temp || 36;
  const minT = d.min_temp || 32;

  const tvEl = document.getElementById('temp-val');
  tvEl.textContent = temp !== null ? temp.toFixed(1) : '—';

  setText('max-val', maxT);
  setText('min-val', minT);
  document.getElementById('max-temp-disp').textContent = maxT + '°C';
  document.getElementById('min-temp-disp').textContent = minT + '°C';
  document.getElementById('sl-max').value = maxT;
  document.getElementById('sl-min').value = minT;

  // Temp colour & badge
  const badge = document.getElementById('temp-badge');
  badge.className = 'temp-badge';
  if (d.failsafe_mode) {
    tvEl.style.color = 'var(--red)';
    badge.classList.add('failsafe');
    badge.textContent = 'FAILSAFE';
  } else if (temp === null) {
    tvEl.style.color = 'var(--muted)';
    badge.textContent = 'NO DATA';
  } else if (d.sensor_error) {
    tvEl.style.color = 'var(--amber)';
    badge.classList.add('warn');
    badge.textContent = 'SENSOR ERR';
  } else if (temp < minT - 2 || temp > maxT + 2) {
    tvEl.style.color = 'var(--red)';
    badge.classList.add('danger');
    badge.textContent = temp < minT ? 'TOO COLD' : 'TOO HOT';
  } else if (temp < minT || temp > maxT) {
    tvEl.style.color = 'var(--amber)';
    badge.classList.add('warn');
    badge.textContent = temp < minT ? 'BELOW MIN' : 'ABOVE MAX';
  } else {
    tvEl.style.color = 'var(--amber)';
    badge.classList.add('ok');
    badge.textContent = 'NORMAL';
  }

  // Temperature band bar
  if (temp !== null) {
    const range  = maxT - minT;
    const clamped = Math.max(minT, Math.min(maxT, temp));
    const pct = ((clamped - minT) / range) * 100;
    document.getElementById('band-fill').style.width   = pct + '%';
    document.getElementById('band-needle').style.left  = pct + '%';
  }

  // ── Individual sensors ────────────────────────────────────────────────────
  renderSensor(1, d.sensor1, d.s1_enabled, d.failsafe_mode);
  renderSensor(2, d.sensor2, d.s2_enabled, d.failsafe_mode);
  renderSensor(3, d.sensor3, d.s3_enabled, d.failsafe_mode);
  renderSensor(4, d.sensor4, d.s4_enabled, d.failsafe_mode);

  // ── Cycle ─────────────────────────────────────────────────────────────────
  const curDay   = d.day || 0;
  const totDays  = d.total_days || 30;
  const pctDone  = Math.min(100, Math.round((curDay / totDays) * 100));
  setText('day-current', curDay);
  setText('day-total',   totDays);
  setText('cycle-pct',   pctDone + '%');
  document.getElementById('cycle-bar').style.width = pctDone + '%';
  document.getElementById('sl-days').value = totDays;
  document.getElementById('days-disp').textContent = totDays + ' days';

  // ── Heater ────────────────────────────────────────────────────────────────
  const relayOn  = d.relay_state === true || d.relay_state === 'ON';
  const isManual = d.manual_control === true;
  const heaterEl = document.getElementById('heater-state');
  heaterEl.textContent = relayOn ? 'ON' : 'OFF';
  heaterEl.className   = 'heater-state ' + (relayOn ? 'on' : 'off');
  setText('heater-mode', isManual ? 'MANUAL CONTROL' : 'AUTO MODE');
  const icon = document.getElementById('heater-icon');
  icon.classList.toggle('on', relayOn);
  // Flame colours
  icon.style.setProperty('--flame-fill',   relayOn ? 'rgba(232,160,32,0.35)' : 'rgba(80,80,80,0.2)');
  icon.style.setProperty('--flame-stroke', relayOn ? 'var(--amber)'           : 'var(--muted)');
  icon.style.setProperty('--flame-core',   relayOn ? 'var(--amber)'           : 'var(--muted)');

  // ── Sensor control panel ──────────────────────────────────────────────────
  syncSensorToggle(1, d.s1_enabled, d.sensor1);
  syncSensorToggle(2, d.s2_enabled, d.sensor2);
  syncSensorToggle(3, d.s3_enabled, d.sensor3);
  syncSensorToggle(4, d.s4_enabled, d.sensor4);

  // ── System info ───────────────────────────────────────────────────────────
  setText('info-lastseen', d.lastSeen ? new Date(d.lastSeen).toLocaleTimeString() : '—');
  const errEl = document.getElementById('info-error');
  const errMsg = d.error || '';
  errEl.textContent = errMsg || 'OK';
  errEl.className   = errMsg ? 'err' : 'ok';

  const fsEl = document.getElementById('info-failsafe');
  fsEl.textContent = d.failsafe_mode ? 'ACTIVE' : 'OFF';
  fsEl.className   = d.failsafe_mode ? 'err' : 'ok';

  setText('info-weekly',   d.weekly_reduce_enabled ? 'ENABLED' : 'OFF');
  setText('info-reducedeg', (d.weekly_reduce_deg || 3) + '°C / week');
  setText('info-lastred',  d.last_reduction_day ? `Day ${d.last_reduction_day}` : '—');

  // ── Chart: push new point ─────────────────────────────────────────────────
  if (temp !== null && d.timestamp) {
    const ts = d.timestamp * 1000;
    // avoid duplicates
    if (!rawHistory.length || rawHistory[rawHistory.length-1].ts !== ts) {
      rawHistory.push({ ts, temp, relay: relayOn, day: curDay });
      if (rawHistory.length > 2000) rawHistory = rawHistory.slice(-2000);
      renderChart();
    }
  }
}

// ── Sensor tile ───────────────────────────────────────────────────────────────
function renderSensor(n, val, enabled, failsafe) {
  const tile = document.getElementById('st' + n);
  const vEl  = document.getElementById('sv' + n);
  tile.className = 'sensor-tile';
  if (!enabled) {
    tile.classList.add('inactive');
    vEl.textContent = 'OFF';
  } else if (typeof val !== 'number' || val <= -900) {
    tile.classList.add('error');
    vEl.textContent = 'ERR';
  } else {
    tile.classList.add('active');
    vEl.textContent = val.toFixed(1) + '°';
  }
}

// ── Sensor control panel ──────────────────────────────────────────────────────
function syncSensorToggle(n, enabled, val) {
  const chk  = document.getElementById('s' + n + 'chk');
  const tEl  = document.getElementById('sctl-t' + n);
  if (chk) chk.checked = (enabled !== false);
  if (tEl) {
    if (typeof val === 'number' && val > -900) tEl.textContent = val.toFixed(1) + '°C';
    else tEl.textContent = enabled === false ? '—' : 'ERR';
  }
}

// ── Chart ─────────────────────────────────────────────────────────────────────
function initChart() {
  const ctx = document.getElementById('tempChart').getContext('2d');
  chartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      datasets: [
        {
          label: 'Temperature °C',
          data: [],
          borderColor: '#e8a020',
          backgroundColor: 'rgba(232,160,32,0.07)',
          borderWidth: 1.8,
          fill: true,
          tension: 0.35,
          pointRadius: 0,
          pointHoverRadius: 5,
          pointHoverBackgroundColor: '#e8a020',
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { intersect: false, mode: 'index' },
      animation: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#121518',
          titleColor: '#5a6680',
          bodyColor: '#c8d0dc',
          borderColor: '#1e2530',
          borderWidth: 1,
          padding: 10,
          displayColors: false,
          callbacks: {
            title: ctx => new Date(ctx[0].parsed.x).toLocaleString(),
            label: ctx => `Temp: ${ctx.parsed.y.toFixed(1)}°C`,
          }
        }
      },
      scales: {
        x: {
          type: 'time',
          time: { unit: 'minute', displayFormats: { minute: 'HH:mm', hour: 'HH:mm' } },
          grid:  { color: '#1e2530', drawBorder: false },
          ticks: { color: '#4a5568', font: { family: 'DM Mono', size: 10 }, maxTicksLimit: 8 }
        },
        y: {
          beginAtZero: false,
          grid:  { color: '#1e2530', drawBorder: false },
          ticks: { color: '#4a5568', font: { family: 'DM Mono', size: 10 }, callback: v => v + '°' }
        }
      }
    }
  });
}

function renderChart() {
  if (!chartInstance) return;
  const now = Date.now();
  const cutoffs = { '1h': 3600e3, '6h': 21600e3, '24h': 86400e3, 'all': Infinity };
  const cut = cutoffs[activeRange] || 3600e3;

  const filtered = activeRange === 'all'
    ? rawHistory
    : rawHistory.filter(p => p.ts >= now - cut);

  chartInstance.data.datasets[0].data = filtered.map(p => ({ x: p.ts, y: p.temp }));
  chartInstance.update('none');
}

function setupRangeButtons() {
  document.querySelectorAll('.rtab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.rtab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeRange = btn.dataset.range;
      renderChart();
    });
  });
}

// ── Control API calls ─────────────────────────────────────────────────────────
async function api(url, body) {
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined
    });
    const j = await r.json();
    if (!r.ok || !j.ok) throw new Error(j.error || 'Request failed');
    return j;
  } catch(e) {
    throw e;
  }
}

async function sendRelay(cmd) {
  try {
    await api('/api/control/relay', { command: cmd });
    toast(`Heater → ${cmd}`, 'ok');
  } catch(e) { toast(e.message, 'error'); }
}

async function applySettings() {
  const maxT = parseInt(document.getElementById('sl-max').value);
  const minT = parseInt(document.getElementById('sl-min').value);
  const days = parseInt(document.getElementById('sl-days').value);

  if (minT >= maxT) {
    toast('Min must be less than Max temp', 'error');
    return;
  }

  try {
    await api('/api/control/temperature', { max_temp: maxT, min_temp: minT });
    await api('/api/control/total-days',  { total_days: days });
    toast('Settings applied');
  } catch(e) { toast(e.message, 'error'); }
}

async function toggleSensor(n, enabled) {
  try {
    await api('/api/control/sensor', { sensor: n, state: enabled ? 'ON' : 'OFF' });
    toast(`DS${n} ${enabled ? 'enabled' : 'disabled'}`);
  } catch(e) { toast(e.message, 'error'); }
}

async function sendPreset(animal) {
  try {
    await api('/api/control/preset', { animal });
    // Highlight active preset button
    document.querySelectorAll('.preset-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.animal === animal);
    });
    toast(`Preset: ${animal}`);
  } catch(e) { toast(e.message, 'error'); }
}

function confirmFactoryReset() {
  document.getElementById('modal').classList.add('open');
}
function closeModal() {
  document.getElementById('modal').classList.remove('open');
}
async function doFactoryReset() {
  closeModal();
  try {
    await api('/api/control/factory-reset');
    toast('Factory reset sent — device will restart', 'warn');
  } catch(e) { toast(e.message, 'error'); }
}

// ── Toast ─────────────────────────────────────────────────────────────────────
let toastTimer = null;
function toast(msg, type = 'ok') {
  const el   = document.getElementById('toast');
  const icon = document.getElementById('toast-icon');
  const msgEl= document.getElementById('toast-msg');
  el.className = 'toast ' + type;
  icon.textContent = type === 'error' ? '✗' : type === 'warn' ? '⚠' : '✓';
  msgEl.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3500);
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val ?? '—';
}
