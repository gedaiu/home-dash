const API = {
  hue: {
    discover: () => fetch('/api/hue/discover').then(r => r.json()),
    bridge: () => fetch('/api/hue/bridge').then(r => r.json()),
    pair: (ip) => fetch('/api/hue/bridge/pair', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ip })
    }).then(r => r.json()),
    remove: () => fetch('/api/hue/bridge', { method: 'DELETE' }).then(r => r.json()),
    rooms: () => fetch('/api/hue/rooms').then(r => r.json()),
    lights: () => fetch('/api/hue/lights').then(r => r.json())
  },
  nanoleaf: {
    discover: () => fetch('/api/nanoleaf/discover').then(r => r.json()),
    device: () => fetch('/api/nanoleaf/device').then(r => r.json()),
    pair: (ip, port) => fetch('/api/nanoleaf/device/pair', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ip, port })
    }).then(r => r.json()),
    remove: () => fetch('/api/nanoleaf/device', { method: 'DELETE' }).then(r => r.json()),
    config: () => fetch('/api/nanoleaf/config').then(r => r.json()),
    updateConfig: (config) => fetch('/api/nanoleaf/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    }).then(r => r.json())
  },
  sync: {
    config: () => fetch('/api/sync/config').then(r => r.json()),
    setConfig: (config) => fetch('/api/sync/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    }).then(r => r.json()),
    start: () => fetch('/api/sync/start', { method: 'POST' }).then(r => r.json()),
    stop: () => fetch('/api/sync/stop', { method: 'POST' }).then(r => r.json()),
    status: () => fetch('/api/sync/status').then(r => r.json())
  },
  homeconnect: {
    status: () => fetch('/api/homeconnect/status').then(r => r.json()),
    devices: () => fetch('/api/homeconnect/devices').then(r => r.json()),
    refresh: () => fetch('/api/homeconnect/refresh', { method: 'POST' }).then(r => r.json()),
    authUrl: () => fetch('/api/homeconnect/auth/url').then(r => r.json()),
    configure: (clientId, clientSecret) => fetch('/api/homeconnect/configure', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId, clientSecret })
    }).then(r => r.json()),
    disconnect: () => fetch('/api/homeconnect/disconnect', { method: 'DELETE' }).then(r => r.json())
  },
  roomba: {
    status: () => fetch('/api/roomba/status').then(r => r.json()),
    start: () => fetch('/api/roomba/start', { method: 'POST' }).then(r => r.json()),
    stop: () => fetch('/api/roomba/stop', { method: 'POST' }).then(r => r.json()),
    pause: () => fetch('/api/roomba/pause', { method: 'POST' }).then(r => r.json()),
    resume: () => fetch('/api/roomba/resume', { method: 'POST' }).then(r => r.json()),
    dock: () => fetch('/api/roomba/dock', { method: 'POST' }).then(r => r.json())
  },
  airpurifier: {
    devices: () => fetch("/api/airpurifier/devices").then(r => r.json()),
    status: (index) => fetch(`/api/airpurifier/devices/${index}/status`).then(r => r.json()),
    add: (ip, name) => fetch("/api/airpurifier/devices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ip, name })
    }).then(r => r.json()),
    remove: (index) => fetch(`/api/airpurifier/devices/${index}`, { method: "DELETE" }).then(r => r.json()),
    connect: (index) => fetch(`/api/airpurifier/devices/${index}/connect`, { method: "POST" }).then(r => r.json()),
    disconnect: (index) => fetch(`/api/airpurifier/devices/${index}/disconnect`, { method: "POST" }).then(r => r.json()),
    power: (index, on) => fetch(`/api/airpurifier/devices/${index}/power`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ on })
    }).then(r => r.json()),
    mode: (index, mode) => fetch(`/api/airpurifier/devices/${index}/mode`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode })
    }).then(r => r.json()),
    fan: (index, speed) => fetch(`/api/airpurifier/devices/${index}/fan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ speed })
    }).then(r => r.json())
  },
  panels: {
    getNames: () => fetch('/api/panels/names').then(r => r.json()),
    setName: (key, name) => fetch(`/api/panels/names/${encodeURIComponent(key)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    }).then(r => r.json()),
    deleteName: (key) => fetch(`/api/panels/names/${encodeURIComponent(key)}`, {
      method: 'DELETE'
    }).then(r => r.json())
  }
};

const CATEGORY_ICONS = {
  motion: 'scan-eye',
  temperature: 'thermometer',
  lightlevel: 'sun-dim',
  daylight: 'sun',
  switch: 'toggle-left',
  sensor: 'radio',
  plug: 'plug',
  strip: 'grip-horizontal',
  candle: 'flame',
  spot: 'circle-dot',
  ceiling: 'lamp-ceiling',
  lamp: 'lamp-desk',
  bulb: 'lightbulb',
  device: 'cpu',
  pm25: 'wind'
};

const SYNCABLE_CATEGORIES = ['bulb', 'lamp', 'spot', 'ceiling', 'strip', 'candle'];

const ARCHETYPE_ICONS = {
  'sultanbulb': 'lightbulb',
  'classicbulb': 'lightbulb',
  'vintagebulb': 'lightbulb',
  'candlebulb': 'lightbulb',
  'spotbulb': 'circle-dot',
  'recessedceiling': 'circle-dot',
  'recessedfloor': 'circle-dot',
  'pendantround': 'lamp-ceiling',
  'pendantlong': 'lamp-ceiling',
  'ceilinghorizontal': 'lamp-ceiling',
  'ceilingvertical': 'lamp-ceiling',
  'ceilinground': 'lamp-ceiling',
  'ceilingsquare': 'lamp-ceiling',
  'flexiblelamp': 'lamp-desk',
  'tablelamp': 'lamp-desk',
  'tableshade': 'lamp-desk',
  'floorlamp': 'lamp-floor',
  'floorlantern': 'lamp-floor',
  'floorshade': 'lamp-floor',
  'singlespot': 'circle-dot',
  'doublespot': 'circle-dot',
  'walllantern': 'lamp-wall-down',
  'wallshade': 'lamp-wall-down',
  'wallspot': 'lamp-wall-down',
  'plug': 'plug',
  'lightstrip': 'grip-horizontal',
  'huelightstrip': 'grip-horizontal',
  'hueplay': 'tv',
  'huego': 'battery',
  'huebloom': 'sparkles',
  'hueiris': 'sparkles',
  'twilight': 'moon-star',
  'bollard': 'cylinder',
  'christmastree': 'tree-pine'
};

const ROOM_ICONS = {
  'living_room': 'sofa',
  'kitchen': 'utensils',
  'dining': 'utensils-crossed',
  'bedroom': 'bed-double',
  'kids_bedroom': 'baby',
  'bathroom': 'bath',
  'nursery': 'baby',
  'recreation': 'gamepad-2',
  'office': 'briefcase',
  'gym': 'dumbbell',
  'hallway': 'door-open',
  'toilet': 'droplets',
  'front_door': 'door-closed',
  'garage': 'warehouse',
  'terrace': 'trees',
  'garden': 'flower-2',
  'driveway': 'car',
  'carport': 'car',
  'home': 'home',
  'downstairs': 'arrow-down',
  'upstairs': 'arrow-up',
  'top_floor': 'arrow-up-to-line',
  'attic': 'triangle',
  'guest_room': 'bed-single',
  'staircase': 'stairs',
  'lounge': 'armchair',
  'man_cave': 'gamepad-2',
  'computer': 'monitor',
  'studio': 'music',
  'music': 'music-2',
  'tv': 'tv',
  'reading': 'book-open',
  'closet': 'shirt',
  'storage': 'archive',
  'laundry_room': 'washing-machine',
  'balcony': 'fence',
  'porch': 'lamp',
  'barbecue': 'flame',
  'pool': 'waves',
  'other': 'layout-grid'
};

let ws = null;
let syncConfig = null;
let selectedLightId = null;
let configLocked = false;
let allRooms = [];
let allLights = [];
let nanoleafDevice = null;
let nanoleafConfig = null;
let homeConnectDevices = [];
let roombaStatus = null;
let pm25Sensors = [];
const HISTORY_LENGTH = 2880;

let pingHistory = [];
const PING_HISTORY_LENGTH = 30;
const PING_INTERVAL = 3000;
let pingTimer = null;
let lastPingTime = 0;

let panelNames = {};

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

function log(message, type = '') {
  const logContent = $('#log-content');
  const time = new Date().toLocaleTimeString();
  const line = document.createElement('div');
  line.className = 'log-line';
  line.innerHTML = `
    <span class="log-time">${time}</span>
    <span class="log-msg ${type}">${message}</span>
  `;
  logContent.appendChild(line);
  logContent.scrollTop = logContent.scrollHeight;

  const footer = $('.footer');
  footer.innerHTML = `
    <span class="footer-time">${time}</span>
    <span class="footer-msg ${type}">${message}</span>
    <span class="blink">_</span>
  `;
  footer.classList.remove('flash');
  void footer.offsetWidth;
  footer.classList.add('flash');
}

function updateClock() {
  $('#clock').textContent = new Date().toLocaleTimeString();
}

async function loadPanelNames() {
  try {
    panelNames = await API.panels.getNames();
  } catch {
    panelNames = {};
  }
}

function getPanelDisplayName(key, defaultName) {
  return panelNames[key] || defaultName;
}

function makeEditableTitle(element, panelKey, defaultName) {
  if (element.classList.contains('editable-title')) {
    return;
  }

  element.classList.add('editable-title');
  element.title = 'Double-click to rename';

  element.addEventListener('dblclick', (e) => {
    e.stopPropagation();
    const currentName = element.textContent;
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'inline-edit-input';
    input.value = currentName;

    const restore = (newName) => {
      element.textContent = newName || currentName;
      element.style.display = '';
    };

    const saveAndClose = async () => {
      const newName = input.value.trim();
      if (newName && newName !== defaultName) {
        await API.panels.setName(panelKey, newName);
        panelNames[panelKey] = newName;
        input.remove();
        restore(newName);
      } else if (!newName || newName === defaultName) {
        await API.panels.deleteName(panelKey);
        delete panelNames[panelKey];
        input.remove();
        restore(defaultName);
      }
    };

    input.addEventListener('keydown', async (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        await saveAndClose();
      } else if (e.key === 'Escape') {
        input.remove();
        restore(currentName);
      }
    });

    input.addEventListener('blur', () => {
      input.remove();
      restore(currentName);
    });

    element.style.display = 'none';
    element.parentNode.insertBefore(input, element.nextSibling);
    input.focus();
    input.select();
  });
}

function attachEditableTitles() {
  const panels = $$('[data-panel-key]');
  panels.forEach(panel => {
    const panelKey = panel.dataset.panelKey;
    const defaultName = panel.dataset.defaultName;
    const titleEl = panel.querySelector('.panel-title');
    if (titleEl && panelKey && defaultName) {
      makeEditableTitle(titleEl, panelKey, defaultName);
    }
  });
}

function startPingLoop() {
  if (pingTimer) {
    clearInterval(pingTimer);
  }
  pingTimer = setInterval(sendPing, PING_INTERVAL);
  sendPing();
}

function stopPingLoop() {
  if (pingTimer) {
    clearInterval(pingTimer);
    pingTimer = null;
  }
  pingHistory = [];
  updateEkgDisconnected();
}

function sendPing() {
  if (ws && ws.readyState === WebSocket.OPEN) {
    lastPingTime = Date.now();
    ws.send(JSON.stringify({ type: 'ping', timestamp: lastPingTime }));
  }
}

function handlePong(timestamp) {
  const latency = Date.now() - timestamp;
  pingHistory.push(latency);
  if (pingHistory.length > PING_HISTORY_LENGTH) {
    pingHistory.shift();
  }
  updateEkgDisplay(latency);
}

function generateEkgBeat(startX, beatWidth, amplitude) {
  const points = [];
  const baseY = 50;
  const w = beatWidth;

  points.push([startX, baseY]);
  points.push([startX + w * 0.1, baseY]);
  points.push([startX + w * 0.15, baseY - 5 * amplitude]);
  points.push([startX + w * 0.2, baseY + 3 * amplitude]);
  points.push([startX + w * 0.25, baseY - 40 * amplitude]);
  points.push([startX + w * 0.3, baseY + 15 * amplitude]);
  points.push([startX + w * 0.35, baseY - 8 * amplitude]);
  points.push([startX + w * 0.4, baseY]);
  points.push([startX + w * 0.5, baseY + 5 * amplitude]);
  points.push([startX + w * 0.6, baseY]);
  points.push([startX + w, baseY]);

  return points;
}

function updateEkgDisplay(currentLatency) {
  const line = $('#ekg-line');
  const latencyEl = $('#ekg-latency');
  const monitor = $('#ekg-monitor');

  if (!line || !latencyEl || !monitor) {
    return;
  }

  monitor.classList.remove('disconnected');
  latencyEl.textContent = `${currentLatency}ms`;

  if (pingHistory.length < 1) {
    line.setAttribute('points', '0,50 100,50');
    return;
  }

  const allPoints = [];
  const beatWidth = 100 / PING_HISTORY_LENGTH;

  for (let i = 0; i < pingHistory.length; i++) {
    const latency = pingHistory[i];
    const amplitude = Math.max(0.3, Math.min(1, 1 - (latency / 400)));
    const x = i * beatWidth;
    const beatPoints = generateEkgBeat(x, beatWidth, amplitude);
    allPoints.push(...beatPoints);
  }

  const lastX = pingHistory.length * beatWidth;
  if (lastX < 100) {
    allPoints.push([100, 50]);
  }

  line.setAttribute('points', allPoints.map(p => p.join(',')).join(' '));
  monitor.classList.toggle('high-latency', currentLatency > 200);
}

function updateEkgDisconnected() {
  const latencyEl = $('#ekg-latency');
  const monitor = $('#ekg-monitor');
  const line = $('#ekg-line');

  if (!latencyEl || !monitor || !line) {
    return;
  }

  monitor.classList.add('disconnected');
  monitor.classList.remove('high-latency');
  latencyEl.textContent = '--ms';
  line.setAttribute('points', '');
}

function connectWebSocket() {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(`${protocol}//${location.host}`);

  ws.onopen = () => {
    $('#connection-status').classList.add('online');
    $('#connection-status').innerHTML = `
      <i data-lucide="wifi"></i>
      <span>ONLINE</span>
    `;
    lucide.createIcons();
    log('WebSocket connected', 'success');
    startPingLoop();
  };

  ws.onclose = () => {
    $('#connection-status').classList.remove('online');
    $('#connection-status').innerHTML = `
      <i data-lucide="wifi-off"></i>
      <span>OFFLINE</span>
    `;
    lucide.createIcons();
    log('WebSocket disconnected', 'error');
    stopPingLoop();
    setTimeout(connectWebSocket, 3000);
  };

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    handleWebSocketMessage(msg);
  };
}

function handleWebSocketMessage(msg) {
  switch (msg.type) {
    case 'pong':
      handlePong(msg.timestamp);
      break;
    case 'status':
      updateSyncStatus(msg.data);
      break;
    case 'log':
      log(msg.data.message);
      break;
    case 'config':
      loadSyncConfig();
      break;
    case 'config_changed':
      log('Configuration reloaded');
      reloadAllData();
      break;
    case 'rooms':
      updateRooms(msg.data);
      break;
    case 'homeconnect':
      updateHomeConnect(msg.data);
      break;
    case 'roomba':
      updateRoomba(msg.data);
      break;
    case 'airpurifier':
      updateAirPurifier(msg.data);
      break;
    case 'pm25_sensors':
      updatePm25Sensors(msg.data);
      break;
    case 'error':
      handleServiceError(msg.data);
      break;
  }
}

function handleServiceError(data) {
  const message = `[${data.service}] ${data.message}`;
  log(message, 'error');
}

function reloadAllData() {
  loadHueBridge();
  loadNanoleaf();
  loadRooms();
  loadSyncConfig();
  loadHomeConnect();
  loadAirPurifiers();
  loadRoomba();
}

function updateSyncStatus(status) {
  const statusEl = $('#sync-status');
  const lastEl = $('#sync-last');
  const colorPreview = $('#color-preview');
  const colorValue = $('#color-value');
  const btnToggle = $('#btn-sync-toggle');

  if (status.running) {
    statusEl.textContent = 'RUNNING';
    statusEl.classList.add('online');
    statusEl.classList.remove('offline');
    btnToggle.innerHTML = '<i data-lucide="square"></i>';
    btnToggle.title = 'Stop';
    btnToggle.classList.add('btn-stop');
    btnToggle.classList.remove('btn-start');
  } else {
    statusEl.textContent = 'STOPPED';
    statusEl.classList.add('offline');
    statusEl.classList.remove('online');
    btnToggle.innerHTML = '<i data-lucide="play"></i>';
    btnToggle.title = 'Start';
    btnToggle.classList.add('btn-start');
    btnToggle.classList.remove('btn-stop');
  }
  lucide.createIcons({ nodes: [btnToggle] });

  if (status.lastSync) {
    lastEl.textContent = new Date(status.lastSync).toLocaleTimeString();
  }

  if (status.currentColor) {
    const { r, g, b } = status.currentColor;
    colorPreview.style.backgroundColor = `rgb(${r}, ${g}, ${b})`;
    colorValue.textContent = `RGB(${r}, ${g}, ${b})`;
  }
}

async function loadHueBridge() {
  const content = $('#hue-content');

  try {
    const bridge = await API.hue.bridge();

    if (!bridge.configured) {
      content.innerHTML = `
        <div class="device-info">
          <div class="info-row">
            <span class="label">STATUS:</span>
            <span class="status-badge offline">NOT CONFIGURED</span>
          </div>
          <p style="margin-top: 12px; color: var(--text-dim)">
            Click the search icon to discover your Hue Bridge
          </p>
        </div>
      `;
      return;
    }

    content.innerHTML = `
      <div class="device-info">
        <div class="info-row">
          <span class="label">STATUS:</span>
          <span class="status-badge online">CONNECTED</span>
        </div>
        <div class="info-row">
          <span class="label">NAME:</span>
          <span class="value">${bridge.name}</span>
        </div>
        <div class="info-row">
          <span class="label">IP:</span>
          <span class="value">${bridge.ip}</span>
        </div>
        <div class="info-row">
          <span class="label">API:</span>
          <span class="value">${bridge.apiVersion}</span>
        </div>
      </div>
    `;
  } catch (err) {
    content.innerHTML = `<div class="loading error">Error: ${err.message}</div>`;
  }
}

async function loadNanoleaf() {
  const content = $('#nanoleaf-content');

  try {
    const device = await API.nanoleaf.device();

    if (!device.configured) {
      content.innerHTML = `
        <div class="device-info">
          <div class="info-row">
            <span class="label">STATUS:</span>
            <span class="status-badge offline">NOT CONFIGURED</span>
          </div>
          <p style="margin-top: 12px; color: var(--text-dim)">
            Click the search icon to discover your Nanoleaf
          </p>
        </div>
      `;
      return;
    }

    const colorStyle = device.state.on
      ? `background-color: hsl(${device.state.hue}, ${device.state.sat}%, 50%)`
      : 'background-color: #333';

    content.innerHTML = `
      <div class="device-info">
        <div class="info-row">
          <span class="label">STATUS:</span>
          <span class="status-badge ${device.state.on ? 'online' : 'offline'}">
            ${device.state.on ? 'ON' : 'OFF'}
          </span>
        </div>
        <div class="info-row">
          <span class="label">NAME:</span>
          <span class="value">${device.name}</span>
        </div>
        <div class="info-row">
          <span class="label">MODEL:</span>
          <span class="value">${device.model}</span>
        </div>
        <div class="info-row">
          <span class="label">PANELS:</span>
          <span class="value">${device.panelCount}</span>
        </div>
        <div class="info-row">
          <span class="label">EFFECT:</span>
          <span class="value">${device.effects.current || 'None'}</span>
        </div>
        <div class="info-row">
          <span class="label">COLOR:</span>
          <span class="value">
            <span class="color-preview" style="${colorStyle}"></span>
            BRI: ${device.state.brightness}%
          </span>
        </div>
      </div>
    `;
  } catch (err) {
    content.innerHTML = `<div class="loading error">Error: ${err.message}</div>`;
  }
}

function getBatteryIcon(level) {
  const icons = {
    'full': 'battery-full',
    'medium': 'battery-medium',
    'low': 'battery-low'
  };
  return icons[level] || 'battery';
}

function getRoombaPhaseDisplay(phase) {
  const displays = {
    'charging': { label: 'CHARGING', class: 'online' },
    'cleaning': { label: 'CLEANING', class: 'online' },
    'stuck': { label: 'STUCK', class: 'error' },
    'stopped': { label: 'STOPPED', class: 'offline' },
    'paused': { label: 'PAUSED', class: 'pending' },
    'returning': { label: 'RETURNING', class: 'pending' },
    'docking': { label: 'DOCKING', class: 'pending' },
    'emptying': { label: 'EMPTYING', class: 'online' },
    'error': { label: 'ERROR', class: 'error' },
    'cancelled': { label: 'CANCELLED', class: 'offline' }
  };
  return displays[phase] || { label: phase?.toUpperCase() || 'UNKNOWN', class: 'offline' };
}

let roombaDetailsExpanded = false;

function renderRoombaHeaderControls(status) {
  if (!status?.configured || !status?.connected) {
    return '';
  }

  const isActive = ['cleaning', 'returning', 'docking', 'emptying'].includes(status.mission?.phase);
  const isPaused = status.mission?.phase === 'paused';
  const isCharging = status.mission?.phase === 'charging';

  let controlButtons = '';
  if (isActive) {
    controlButtons = `
      <button class="btn-icon" onclick="pauseRoomba()" title="Pause">
        <i data-lucide="pause"></i>
      </button>
      <button class="btn-icon" onclick="dockRoomba()" title="Dock">
        <i data-lucide="home"></i>
      </button>
    `;
  } else if (isPaused) {
    controlButtons = `
      <button class="btn-icon" onclick="resumeRoomba()" title="Resume">
        <i data-lucide="play"></i>
      </button>
      <button class="btn-icon" onclick="dockRoomba()" title="Dock">
        <i data-lucide="home"></i>
      </button>
    `;
  } else if (isCharging || status.mission?.phase === 'stopped') {
    controlButtons = `
      <button class="btn-icon" onclick="startRoomba()" title="Start Cleaning">
        <i data-lucide="play"></i>
      </button>
    `;
  }

  const detailsActiveClass = roombaDetailsExpanded ? 'active' : '';

  return `
    ${controlButtons}
    <button class="btn-icon ${detailsActiveClass}" onclick="toggleRoombaDetails()" title="Details">
      <i data-lucide="info"></i>
    </button>
  `;
}

function toggleRoombaDetails() {
  roombaDetailsExpanded = !roombaDetailsExpanded;
  const details = document.querySelector('.roomba-details');
  const btn = document.querySelector('#roomba-controls .btn-icon[title="Details"]');

  if (details) {
    details.classList.toggle('expanded', roombaDetailsExpanded);
  }

  if (btn) {
    btn.classList.toggle('active', roombaDetailsExpanded);
  }
}

function renderRoombaPanel(status) {
  if (!status || !status.configured) {
    return `
      <div class="device-info">
        <div class="info-row">
          <span class="label">STATUS:</span>
          <span class="status-badge offline">NOT CONFIGURED</span>
        </div>
        <p style="margin-top: 12px; color: var(--text-dim)">
          Configure Roomba in network-config.json
        </p>
      </div>
    `;
  }

  if (!status.connected) {
    return `
      <div class="device-info">
        <div class="info-row">
          <span class="label">STATUS:</span>
          <span class="status-badge offline">OFFLINE</span>
        </div>
        <div class="info-row">
          <span class="label">NAME:</span>
          <span class="value">${status.name || 'Roomba'}</span>
        </div>
        ${status.error ? `<p style="margin-top: 12px; color: var(--text-dim)">${status.error}</p>` : ''}
      </div>
    `;
  }

  const phaseDisplay = getRoombaPhaseDisplay(status.mission?.phase);
  const batteryIcon = getBatteryIcon(status.battery?.level);
  const batteryPercent = status.battery?.percent ?? '--';

  let binHtml = '';
  if (status.bin) {
    const binStatus = status.bin.full ? 'FULL' : 'OK';
    const binClass = status.bin.full ? 'warning' : 'online';
    binHtml = `
      <div class="info-row">
        <span class="label">BIN:</span>
        <span class="status-badge ${binClass}">${binStatus}</span>
      </div>
    `;
  }

  let lifetimeHtml = '';
  if (status.lifetime) {
    const totalTime = status.lifetime.totalHours > 0
      ? `${status.lifetime.totalHours}h ${status.lifetime.totalMinutes}m`
      : `${status.lifetime.totalMinutes}m`;
    lifetimeHtml = `
      <div class="roomba-section">
        <div class="section-title">LIFETIME STATS</div>
        <div class="info-row">
          <span class="label">TOTAL TIME:</span>
          <span class="value">${totalTime}</span>
        </div>
        <div class="info-row">
          <span class="label">MISSIONS:</span>
          <span class="value">${status.lifetime.totalMissions} (${status.lifetime.successRate}% success)</span>
        </div>
        <div class="info-row">
          <span class="label">AVG MISSION:</span>
          <span class="value">${status.lifetime.avgMissionMinutes} min</span>
        </div>
      </div>
    `;
  }

  let settingsHtml = '';
  if (status.settings) {
    const activeSettings = [];
    if (status.settings.carpetBoost) activeSettings.push('Carpet Boost');
    if (status.settings.vacHigh) activeSettings.push('High Vacuum');
    if (status.settings.twoPass) activeSettings.push('Two Pass');
    if (status.settings.binPause) activeSettings.push('Bin Pause');
    if (status.settings.ecoCharge) activeSettings.push('Eco Charge');

    settingsHtml = `
      <div class="roomba-section">
        <div class="section-title">SETTINGS</div>
        <div class="info-row">
          <span class="label">ACTIVE:</span>
          <span class="value">${activeSettings.length > 0 ? activeSettings.join(', ') : 'Default'}</span>
        </div>
      </div>
    `;
  }

  let lastCommandHtml = '';
  if (status.lastCommand?.command) {
    const cmdTime = status.lastCommand.time
      ? new Date(status.lastCommand.time).toLocaleString()
      : 'Unknown';
    lastCommandHtml = `
      <div class="roomba-section">
        <div class="section-title">LAST ACTIVITY</div>
        <div class="info-row">
          <span class="label">COMMAND:</span>
          <span class="value">${status.lastCommand.command} (${status.lastCommand.initiator})</span>
        </div>
        <div class="info-row">
          <span class="label">TIME:</span>
          <span class="value">${cmdTime}</span>
        </div>
      </div>
    `;
  }

  let deviceInfoHtml = '';
  if (status.deviceInfo?.sku) {
    deviceInfoHtml = `
      <div class="roomba-section">
        <div class="section-title">DEVICE INFO</div>
        <div class="info-row">
          <span class="label">MODEL:</span>
          <span class="value">${status.deviceInfo.sku}</span>
        </div>
        <div class="info-row">
          <span class="label">FIRMWARE:</span>
          <span class="value">${status.deviceInfo.softwareVer || 'Unknown'}</span>
        </div>
      </div>
    `;
  }

  const detailsExpandedClass = roombaDetailsExpanded ? 'expanded' : '';

  return `
    <div class="device-info">
      <div class="info-row">
        <span class="label">STATUS:</span>
        <span class="status-badge ${phaseDisplay.class}">${phaseDisplay.label}</span>
      </div>
      <div class="info-row">
        <span class="label">NAME:</span>
        <span class="value">${status.name}</span>
      </div>
      <div class="info-row">
        <span class="label">BATTERY:</span>
        <span class="value">
          ${batteryPercent}%
          <i data-lucide="${batteryIcon}" style="width: 14px; height: 14px; margin-left: 4px;"></i>
        </span>
      </div>
      ${binHtml}
      <div class="roomba-details ${detailsExpandedClass}">
        ${lifetimeHtml}
        ${settingsHtml}
        ${lastCommandHtml}
        ${deviceInfoHtml}
      </div>
    </div>
  `;
}

async function loadRoomba() {
  const content = $('#roomba-content');
  const controls = $('#roomba-controls');
  const panel = $('#roomba-panel');

  try {
    const status = await API.roomba.status();
    roombaStatus = status;
    content.innerHTML = renderRoombaPanel(status);
    controls.innerHTML = renderRoombaHeaderControls(status);

    const titleEl = panel.querySelector('.panel-title');
    if (titleEl) {
      titleEl.textContent = getPanelDisplayName('roomba', 'ROOMBA');
    }

    lucide.createIcons();
    attachEditableTitles();
  } catch (err) {
    content.innerHTML = `<div class="loading error">Error: ${err.message}</div>`;
    controls.innerHTML = '';
  }
}

function updateRoomba(status) {
  roombaStatus = status;
  const content = $('#roomba-content');
  const controls = $('#roomba-controls');
  const panel = $('#roomba-panel');
  const fullStatus = { configured: true, ...status };
  content.innerHTML = renderRoombaPanel(fullStatus);
  controls.innerHTML = renderRoombaHeaderControls(fullStatus);

  const titleEl = panel.querySelector('.panel-title');
  if (titleEl) {
    titleEl.textContent = getPanelDisplayName('roomba', 'ROOMBA');
  }

  lucide.createIcons();
  attachEditableTitles();
}

function updatePm25Sensors(sensors) {
  pm25Sensors = sensors || [];
  const sensorsContent = $('#sensors-content');
  if (!sensorsContent) {
    return;
  }

  const existingHtml = sensorsContent.innerHTML;
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = existingHtml;

  const existingPm25 = tempDiv.querySelectorAll('.sensor-pm25');
  existingPm25.forEach(el => el.remove());

  let pm25Html = '';
  pm25Sensors.forEach(s => { pm25Html += renderSensorPanel(s); });

  sensorsContent.innerHTML = tempDiv.innerHTML + pm25Html;
  lucide.createIcons();
  attachEditableTitles();
}

async function startRoomba() {
  try {
    await API.roomba.start();
    log('Roomba started cleaning', 'success');
  } catch (err) {
    log(`Failed to start Roomba: ${err.message}`, 'error');
  }
}

async function pauseRoomba() {
  try {
    await API.roomba.pause();
    log('Roomba paused', 'success');
  } catch (err) {
    log(`Failed to pause Roomba: ${err.message}`, 'error');
  }
}

async function resumeRoomba() {
  try {
    await API.roomba.resume();
    log('Roomba resumed', 'success');
  } catch (err) {
    log(`Failed to resume Roomba: ${err.message}`, 'error');
  }
}

async function dockRoomba() {
  try {
    await API.roomba.dock();
    log('Roomba returning to dock', 'success');
  } catch (err) {
    log(`Failed to dock Roomba: ${err.message}`, 'error');
  }
}

// Air Purifier Functions
function getAirQualityLabel(iaql) {
  if (iaql <= 3) {
    return 'GOOD';
  }
  if (iaql <= 6) {
    return 'MODERATE';
  }
  if (iaql <= 9) {
    return 'POOR';
  }
  return 'VERY POOR';
}

function getAirQualityClass(iaql) {
  if (iaql <= 3) {
    return 'good';
  }
  if (iaql <= 6) {
    return 'moderate';
  }
  if (iaql <= 9) {
    return 'poor';
  }
  return 'very-poor';
}

function getModeLabel(mode) {
  const modes = {
    'M': 'MANUAL',
    'AG': 'AUTO GENERAL',
    'AL': 'ALLERGEN',
    'T': 'TURBO',
    'S': 'SLEEP'
  };
  return modes[mode] || mode;
}

function getFanLabel(om) {
  if (om === 's') {
    return 'SLEEP';
  }
  if (om === 't') {
    return 'TURBO';
  }
  return 'SPEED ' + om;
}

function renderFilterStatus(fltsts, flttotal, label) {
  const percent = flttotal > 0 ? Math.round((fltsts / flttotal) * 100) : 0;
  const statusClass = percent > 30 ? 'good' : percent > 10 ? 'warning' : 'critical';
  return '<div class="info-row">' +
    '<span class="label">' + label + ':</span>' +
    '<span class="value filter-value">' +
    '<div class="filter-bar">' +
    '<div class="filter-fill ' + statusClass + '" style="width: ' + percent + '%"></div>' +
    '</div>' +
    '<span class="filter-percent">' + percent + '%</span>' +
    '</span>' +
    '</div>';
}

function renderAirPurifierDevice(device, index) {
  const defaultName = (device.device && device.device.name) || ('Purifier ' + (index + 1));
  const panelKey = 'airpurifier:' + index;
  const displayName = getPanelDisplayName(panelKey, defaultName);
  const ip = device.device && device.device.ip;

  if (!device.connected) {
    return '<section class="panel" data-panel-key="' + panelKey + '" data-default-name="' + defaultName + '">' +
      '<div class="panel-header">' +
      '<i data-lucide="wind"></i>' +
      '<span class="panel-title">' + displayName + '</span>' +
      '<span class="status-badge offline">OFFLINE</span>' +
      '</div>' +
      '<div class="panel-content">' +
      '<p class="purifier-ip">' + (ip || 'Unknown') + '</p>' +
      '<button class="btn btn-sm" onclick="connectPurifier(' + index + ')">CONNECT</button>' +
      '</div>' +
      '</section>';
  }

  const hasStatus = device.pwr !== undefined;
  if (!hasStatus) {
    return '<section class="panel" data-panel-key="' + panelKey + '" data-default-name="' + defaultName + '">' +
      '<div class="panel-header">' +
      '<i data-lucide="wind"></i>' +
      '<span class="panel-title">' + displayName + '</span>' +
      '</div>' +
      '<div class="panel-content">' +
      '<div class="loading">Connecting...</div>' +
      '</div>' +
      '</section>';
  }

  const isOn = device.pwr === '1';
  const iaql = device.iaql !== undefined ? device.iaql : null;
  const mode = device.mode || 'M';
  const om = device.om || '1';
  const qualityClass = iaql !== null ? getAirQualityClass(iaql) : '';

  return '<section class="panel" data-panel-key="' + panelKey + '" data-default-name="' + defaultName + '">' +
    '<div class="panel-header">' +
    '<i data-lucide="wind"></i>' +
    '<span class="panel-title">' + displayName + '</span>' +
    '<button class="btn-icon ' + (isOn ? 'active' : '') + '" onclick="togglePurifierPower(' + index + ')" title="' + (isOn ? 'Turn Off' : 'Turn On') + '">' +
    '<i data-lucide="power"></i>' +
    '</button>' +
    '</div>' +
    '<div class="panel-content">' +
    '<div class="device-info">' +
    '<div class="info-row">' +
    '<span class="label">AIR QUALITY:</span>' +
    '<span class="status-badge ' + qualityClass + '">' + (iaql !== null ? getAirQualityLabel(iaql) : '--') + '</span>' +
    '</div>' +
    '<div class="info-row">' +
    '<span class="label">MODE:</span>' +
    '<select class="control-select" onchange="setPurifierMode(' + index + ', this.value)" ' + (!isOn ? 'disabled' : '') + '>' +
    '<option value="M" ' + (mode === 'M' ? 'selected' : '') + '>MANUAL</option>' +
    '<option value="AG" ' + (mode === 'AG' ? 'selected' : '') + '>AUTO</option>' +
    '<option value="AL" ' + (mode === 'AL' ? 'selected' : '') + '>ALLERGEN</option>' +
    '<option value="S" ' + (mode === 'S' ? 'selected' : '') + '>SLEEP</option>' +
    '<option value="T" ' + (mode === 'T' ? 'selected' : '') + '>TURBO</option>' +
    '</select>' +
    '</div>' +
    '<div class="info-row">' +
    '<span class="label">FAN:</span>' +
    '<select class="control-select" onchange="setPurifierFan(' + index + ', this.value)" ' + (!isOn || mode !== 'M' ? 'disabled' : '') + '>' +
    '<option value="s" ' + (om === 's' ? 'selected' : '') + '>SLEEP</option>' +
    '<option value="1" ' + (om === '1' ? 'selected' : '') + '>1</option>' +
    '<option value="2" ' + (om === '2' ? 'selected' : '') + '>2</option>' +
    '<option value="3" ' + (om === '3' ? 'selected' : '') + '>3</option>' +
    '<option value="t" ' + (om === 't' ? 'selected' : '') + '>TURBO</option>' +
    '</select>' +
    '</div>' +
    (device.flttotal0 > 0 ? renderFilterStatus(device.fltsts0 || 0, device.flttotal0, 'PRE-FILTER') : '') +
    (device.flttotal1 > 0 ? renderFilterStatus(device.fltsts1 || 0, device.flttotal1, 'HEPA') : '') +
    (device.flttotal2 > 0 && device.fltsts2 > 0 ? renderFilterStatus(device.fltsts2, device.flttotal2, 'CARBON') : '') +
    '</div>' +
    '</div>' +
    '</section>';
}

function renderAirPurifierPanel(devices) {
  if (!devices || devices.length === 0) {
    return '';
  }

  return devices.map(function(device, index) { return renderAirPurifierDevice(device, index); }).join('');
}

async function loadAirPurifiers() {
  const content = document.getElementById('airpurifier-content');

  try {
    const devices = await API.airpurifier.devices();
    content.innerHTML = renderAirPurifierPanel(devices);
    lucide.createIcons();
    attachEditableTitles();
  } catch (err) {
    content.innerHTML = '<div class="error">Failed to load: ' + err.message + '</div>';
  }
}

function updateAirPurifier(data) {
  loadAirPurifiers();
}

async function togglePurifierPower(index) {
  try {
    const devices = await API.airpurifier.devices();
    const device = devices[index];
    const isOn = device && device.pwr === '1';
    await API.airpurifier.power(index, !isOn);
    log('Purifier ' + (index + 1) + ' turned ' + (isOn ? 'off' : 'on'), 'success');
  } catch (err) {
    log('Failed to toggle purifier: ' + err.message, 'error');
  }
}

async function setPurifierMode(index, mode) {
  try {
    await API.airpurifier.mode(index, mode);
    log('Purifier ' + (index + 1) + ' mode set to ' + getModeLabel(mode), 'success');
  } catch (err) {
    log('Failed to set mode: ' + err.message, 'error');
  }
}

async function setPurifierFan(index, speed) {
  try {
    await API.airpurifier.fan(index, speed);
    log('Purifier ' + (index + 1) + ' fan set to ' + getFanLabel(speed), 'success');
  } catch (err) {
    log('Failed to set fan speed: ' + err.message, 'error');
  }
}

async function connectPurifier(index) {
  try {
    await API.airpurifier.connect(index);
    log('Connecting to purifier ' + (index + 1) + '...', 'info');
    await loadAirPurifiers();
  } catch (err) {
    log('Failed to connect: ' + err.message, 'error');
  }
}

async function addPurifier() {
  showModal('ADD AIR PURIFIER',
    '<div class="form-group">' +
    '<label>Device IP Address:</label>' +
    '<input type="text" id="purifier-ip" placeholder="192.168.1.xxx" class="input-field">' +
    '</div>' +
    '<div class="form-group">' +
    '<label>Device Name (optional):</label>' +
    '<input type="text" id="purifier-name" placeholder="Living Room Purifier" class="input-field">' +
    '</div>',
    '<button class="btn" onclick="hideModal()">CANCEL</button>' +
    '<button class="btn btn-start" onclick="confirmAddPurifier()">ADD</button>'
  );
}

async function confirmAddPurifier() {
  const ip = document.getElementById('purifier-ip').value.trim();
  const name = document.getElementById('purifier-name').value.trim();

  if (!ip) {
    log('Please enter an IP address', 'error');
    return;
  }

  showModal('ADDING DEVICE', '<div class="loading">Connecting to device...</div>');

  try {
    const result = await API.airpurifier.add(ip, name);
    if (result.success) {
      hideModal();
      log('Air purifier added at ' + ip, 'success');
      await loadAirPurifiers();
    } else {
      showModal('FAILED', '<p class="error">' + result.error + '</p>',
        '<button class="btn" onclick="hideModal()">CLOSE</button>');
    }
  } catch (err) {
    showModal('ERROR', '<p class="error">' + err.message + '</p>',
      '<button class="btn" onclick="hideModal()">CLOSE</button>');
  }
}

async function removePurifier(index) {
  showModal('REMOVE PURIFIER',
    '<p>Are you sure you want to remove this air purifier?</p>',
    '<button class="btn" onclick="hideModal()">CANCEL</button>' +
    '<button class="btn btn-danger" onclick="confirmRemovePurifier(' + index + ')">REMOVE</button>'
  );
}

async function confirmRemovePurifier(index) {
  try {
    await API.airpurifier.remove(index);
    hideModal();
    log('Air purifier removed', 'success');
    await loadAirPurifiers();
  } catch (err) {
    log('Failed to remove purifier: ' + err.message, 'error');
  }
}


function formatRemainingTime(seconds) {
  if (!seconds) {
    return '--:--';
  }
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${mins}m`;
  }
  return `${mins}m`;
}

function formatTimeAgo(isoString) {
  if (!isoString || isoString === 'none') {
    return '';
  }

  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now - date;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) {
    return 'just now';
  }
  if (diffMin === 1) {
    return '1 min ago';
  }
  if (diffMin < 60) {
    return `${diffMin} min ago`;
  }
  if (diffHour === 1) {
    return '1 hour ago';
  }
  if (diffHour < 24) {
    return `${diffHour} hours ago`;
  }
  if (diffDay === 1) {
    return '1 day ago';
  }
  return `${diffDay} days ago`;
}

function getLastMotionDetections(history, count) {
  if (!history || history.length === 0) {
    return [];
  }

  const detections = [];
  for (let i = history.length - 1; i >= 0 && detections.length < count; i--) {
    if (history[i].v === 1) {
      const time = new Date(history[i].t);
      const hours = time.getHours().toString().padStart(2, '0');
      const mins = time.getMinutes().toString().padStart(2, '0');
      detections.push(`${hours}:${mins}`);
    }
  }

  return detections;
}

function getOperationStateDisplay(state) {
  const displays = {
    'inactive': { label: 'IDLE', class: 'offline' },
    'ready': { label: 'READY', class: 'ready' },
    'delayed': { label: 'DELAYED', class: 'pending' },
    'running': { label: 'RUNNING', class: 'online' },
    'paused': { label: 'PAUSED', class: 'pending' },
    'action_required': { label: 'ACTION', class: 'warning' },
    'finished': { label: 'DONE', class: 'success' },
    'error': { label: 'ERROR', class: 'error' },
    'aborting': { label: 'STOPPING', class: 'pending' }
  };
  return displays[state] || { label: state?.toUpperCase() || 'UNKNOWN', class: 'offline' };
}

function getApplianceIcon(type) {
  const icons = {
    'Dishwasher': 'washing-machine',
    'Washer': 'washing-machine',
    'Dryer': 'wind',
    'WasherDryer': 'washing-machine',
    'Oven': 'flame',
    'CoffeeMaker': 'coffee',
    'Refrigerator': 'thermometer-snowflake',
    'Freezer': 'snowflake',
    'FridgeFreezer': 'thermometer-snowflake',
    'Hood': 'wind',
    'Cooktop': 'flame',
    'CleaningRobot': 'bot'
  };
  return icons[type] || 'cpu';
}

function renderHomeConnectPanel(device) {
  const icon = getApplianceIcon(device.type);
  const status = device.status || {};
  const stateDisplay = getOperationStateDisplay(status.operationState);
  const panelKey = `homeconnect:${device.id}`;
  const displayName = getPanelDisplayName(panelKey, device.name.toUpperCase());

  let contentHtml = '';

  if (!device.connected) {
    contentHtml = `
      <div class="device-info">
        <div class="info-row">
          <span class="label">STATUS:</span>
          <span class="status-badge offline">OFFLINE</span>
        </div>
      </div>
    `;
  } else {
    const doorIcon = status.doorState === 'open' ? 'door-open' : 'door-closed';
    const warnings = status.warnings || [];

    const saltLow = warnings.includes('salt_low');
    const rinseAidLow = warnings.includes('rinse_aid_low');

    const saltStatus = saltLow
      ? '<span class="status-badge warning">LOW</span>'
      : '<span class="status-badge online">OK</span>';
    const rinseAidStatus = rinseAidLow
      ? '<span class="status-badge warning">LOW</span>'
      : '<span class="status-badge online">OK</span>';

    let programHtml = '';
    if (status.program) {
      const prog = status.program;

      let delayedStartHtml = '';
      if (prog.startInRelative && status.operationState === 'delayed') {
        delayedStartHtml = `
          <div class="info-row">
            <span class="label">STARTS IN:</span>
            <span class="value">${formatRemainingTime(prog.startInRelative)}</span>
          </div>
        `;
      }

      let progressHtml = '';
      if (prog.progress !== null && prog.progress !== undefined) {
        progressHtml = `
          <div class="info-row">
            <span class="label">PROGRESS:</span>
            <div class="progress-bar-container">
              <div class="progress-bar-bg">
                <div class="progress-bar" style="width: ${prog.progress}%"></div>
              </div>
              <span class="progress-text">${prog.progress}%</span>
            </div>
          </div>
        `;
      }

      let timeHtml = '';
      if (prog.remainingTime) {
        const elapsed = prog.elapsedTime ? formatRemainingTime(prog.elapsedTime) : null;
        const remaining = formatRemainingTime(prog.remainingTime);
        if (elapsed) {
          timeHtml = `
            <div class="info-row">
              <span class="label">TIME:</span>
              <span class="value">${elapsed} / ${remaining} left</span>
            </div>
          `;
        } else {
          timeHtml = `
            <div class="info-row">
              <span class="label">REMAINING:</span>
              <span class="value">${remaining}</span>
            </div>
          `;
        }
      }

      programHtml = `
        <div class="info-row">
          <span class="label">PROGRAM:</span>
          <span class="value">${prog.name || 'Running'}</span>
        </div>
        ${delayedStartHtml}
        ${progressHtml}
        ${timeHtml}
      `;
    }

    let remoteHtml = '';
    if (status.localControlActive) {
      remoteHtml = `
        <div class="info-row">
          <span class="label">CONTROL:</span>
          <span class="value">LOCAL</span>
        </div>
      `;
    } else if (status.remoteControlActive && status.remoteStartAllowed) {
      remoteHtml = `
        <div class="info-row">
          <span class="label">REMOTE:</span>
          <span class="value">ENABLED</span>
        </div>
      `;
    }

    contentHtml = `
      <div class="device-info">
        <div class="info-row">
          <span class="label">STATUS:</span>
          <span class="status-badge ${stateDisplay.class}">${stateDisplay.label}</span>
        </div>
        <div class="info-row">
          <span class="label">DOOR:</span>
          <span class="value">
            ${status.doorState?.toUpperCase() || 'UNKNOWN'}
            <i data-lucide="${doorIcon}" style="width: 14px; height: 14px; margin-left: 4px;"></i>
          </span>
        </div>
        <div class="info-row">
          <span class="label">SALT:</span>
          ${saltStatus}
        </div>
        <div class="info-row">
          <span class="label">RINSE AID:</span>
          ${rinseAidStatus}
        </div>
        ${programHtml}
        ${remoteHtml}
      </div>
    `;
  }

  return `
    <section class="panel homeconnect-device-panel" data-device-id="${device.id}" data-panel-key="${panelKey}" data-default-name="${device.name.toUpperCase()}">
      <div class="panel-header">
        <i data-lucide="${icon}"></i>
        <span class="panel-title">${displayName}</span>
        <button class="btn-icon refresh-homeconnect" title="Refresh">
          <i data-lucide="refresh-cw"></i>
        </button>
      </div>
      <div class="panel-content">
        ${contentHtml}
      </div>
    </section>
  `;
}

function renderHomeConnectSetupPanel(statusText, statusClass, message) {
  return `
    <section class="panel" id="homeconnect-setup-panel">
      <div class="panel-header">
        <i data-lucide="washing-machine"></i>
        <span>HOME CONNECT</span>
        <button class="btn-icon" id="discover-homeconnect" title="Configure">
          <i data-lucide="search"></i>
        </button>
      </div>
      <div class="panel-content">
        <div class="device-info">
          <div class="info-row">
            <span class="label">STATUS:</span>
            <span class="status-badge ${statusClass}">${statusText}</span>
          </div>
          <p style="margin-top: 12px; color: var(--text-dim)">${message}</p>
        </div>
      </div>
    </section>
  `;
}

function clearHomeConnectPanels() {
  const existing = $$('.homeconnect-device-panel, #homeconnect-setup-panel');
  existing.forEach(el => el.remove());
}

function appendToDevicesRow(html) {
  const container = $('#devices-row');
  container.insertAdjacentHTML('beforeend', html);
}

async function loadHomeConnect() {
  clearHomeConnectPanels();

  try {
    const status = await API.homeconnect.status();

    if (!status.configured) {
      appendToDevicesRow(renderHomeConnectSetupPanel(
        'NOT CONFIGURED',
        'offline',
        'Click the search icon to set up Home Connect'
      ));
      lucide.createIcons();
      $('#discover-homeconnect').addEventListener('click', discoverHomeConnect);
      return;
    }

    if (!status.authenticated) {
      appendToDevicesRow(renderHomeConnectSetupPanel(
        'NEEDS AUTH',
        'pending',
        'Click the search icon to authenticate'
      ));
      lucide.createIcons();
      $('#discover-homeconnect').addEventListener('click', discoverHomeConnect);
      return;
    }

    const devices = await API.homeconnect.devices();
    homeConnectDevices = devices;

    if (devices.length === 0) {
      appendToDevicesRow(renderHomeConnectSetupPanel(
        'CONNECTED',
        'online',
        'No appliances found'
      ));
      lucide.createIcons();
      $('#discover-homeconnect').addEventListener('click', discoverHomeConnect);
      return;
    }

    appendToDevicesRow(devices.map(d => renderHomeConnectPanel(d)).join(''));
    lucide.createIcons();
    attachHomeConnectRefreshHandlers();
    attachEditableTitles();
  } catch (err) {
    appendToDevicesRow(`
      <section class="panel">
        <div class="panel-header">
          <i data-lucide="washing-machine"></i>
          <span>HOME CONNECT</span>
        </div>
        <div class="panel-content">
          <div class="loading error">Error: ${err.message}</div>
        </div>
      </section>
    `);
    lucide.createIcons();
  }
}

function updateHomeConnect(devices) {
  homeConnectDevices = devices;

  if (devices.length === 0) {
    return;
  }

  clearHomeConnectPanels();
  appendToDevicesRow(devices.map(d => renderHomeConnectPanel(d)).join(''));
  lucide.createIcons();
  attachHomeConnectRefreshHandlers();
  attachEditableTitles();
}

async function refreshHomeConnect() {
  const buttons = $$('.refresh-homeconnect');
  buttons.forEach(btn => btn.classList.add('spinning'));

  try {
    const devices = await API.homeconnect.refresh();
    updateHomeConnect(devices);
  } catch (err) {
    console.error('Home Connect refresh error:', err.message);
  } finally {
    const updatedButtons = $$('.refresh-homeconnect');
    updatedButtons.forEach(btn => btn.classList.remove('spinning'));
  }
}

function attachHomeConnectRefreshHandlers() {
  const buttons = $$('.refresh-homeconnect');
  buttons.forEach(btn => btn.addEventListener('click', refreshHomeConnect));
}

async function discoverHomeConnect() {
  const status = await API.homeconnect.status();

  if (!status.configured) {
    showModal('CONFIGURE HOME CONNECT', `
      <p style="margin-bottom: 12px; color: var(--text-dim)">
        To connect your Bosch/Siemens appliances, you need to register at
        <a href="https://developer.home-connect.com" target="_blank" style="color: var(--accent)">developer.home-connect.com</a>
      </p>
      <p style="margin-bottom: 16px; color: var(--text-dim)">
        Create an application with OAuth redirect URI:<br>
        <code style="color: var(--accent)">${window.location.origin}/api/homeconnect/auth/callback</code>
      </p>
      <div class="input-row">
        <label>Client ID:</label>
        <input type="text" id="hc-client-id" class="modal-input" placeholder="Your Client ID">
      </div>
      <div class="input-row" style="margin-top: 8px">
        <label>Client Secret:</label>
        <input type="password" id="hc-client-secret" class="modal-input" placeholder="Your Client Secret">
      </div>
    `, `
      <button class="btn" onclick="hideModal()">CANCEL</button>
      <button class="btn btn-start" onclick="configureHomeConnect()">SAVE</button>
    `);
    return;
  }

  if (!status.authenticated) {
    showModal('AUTHENTICATE HOME CONNECT', `
      <p style="margin-bottom: 12px; color: var(--text-dim)">
        You need to authorize access to your Home Connect appliances.
      </p>
      <p style="color: var(--text-dim)">
        Click the button below to open the Home Connect login page.
      </p>
    `, `
      <button class="btn" onclick="hideModal()">CANCEL</button>
      <button class="btn btn-start" onclick="startHomeConnectAuth()">AUTHORIZE</button>
    `);
    return;
  }

  showModal('HOME CONNECT', `
    <div class="device-info">
      <div class="info-row">
        <span class="label">STATUS:</span>
        <span class="status-badge online">CONNECTED</span>
      </div>
    </div>
    <p style="margin-top: 12px; color: var(--text-dim)">
      Your appliances are connected and syncing.
    </p>
  `, `
    <button class="btn btn-stop" onclick="disconnectHomeConnect()">DISCONNECT</button>
    <button class="btn" onclick="hideModal()">CLOSE</button>
  `);
}

async function configureHomeConnect() {
  const clientId = $('#hc-client-id').value.trim();
  const clientSecret = $('#hc-client-secret').value.trim();

  if (!clientId || !clientSecret) {
    log('Client ID and Secret are required', 'error');
    return;
  }

  showModal('SAVING...', '<div class="loading">Saving configuration...</div>');

  try {
    await API.homeconnect.configure(clientId, clientSecret);
    hideModal();
    log('Home Connect configured', 'success');
    await discoverHomeConnect();
  } catch (err) {
    showModal('ERROR', `<p class="error">${err.message}</p>`,
      '<button class="btn" onclick="hideModal()">CLOSE</button>');
  }
}

async function startHomeConnectAuth() {
  try {
    const { authUrl } = await API.homeconnect.authUrl();
    window.location.href = authUrl;
  } catch (err) {
    showModal('ERROR', `<p class="error">${err.message}</p>`,
      '<button class="btn" onclick="hideModal()">CLOSE</button>');
  }
}

async function disconnectHomeConnect() {
  showModal('DISCONNECTING...', '<div class="loading">Disconnecting...</div>');

  try {
    await API.homeconnect.disconnect();
    hideModal();
    log('Home Connect disconnected', 'success');
    await loadHomeConnect();
  } catch (err) {
    showModal('ERROR', `<p class="error">${err.message}</p>`,
      '<button class="btn" onclick="hideModal()">CLOSE</button>');
  }
}

function getDeviceIcon(category, archetype) {
  if (archetype && ARCHETYPE_ICONS[archetype]) {
    return ARCHETYPE_ICONS[archetype];
  }
  return CATEGORY_ICONS[category] || 'cpu';
}

function getRoomIcon(roomClass) {
  return ROOM_ICONS[roomClass] || 'layout-grid';
}

function getLast24hValues(history) {
  if (!history || history.length === 0) {
    return [];
  }

  if (typeof history[0] === 'number') {
    return history;
  }

  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  return history.filter(e => e.t >= cutoff).map(e => e.v);
}

function renderSparkline(history, color) {
  const values = getLast24hValues(history);

  if (values.length < 2) {
    return `
      <div class="sparkline">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none">
          <line x1="0" y1="50" x2="100" y2="50" stroke="#666" stroke-width="2" stroke-dasharray="4,4" vector-effect="non-scaling-stroke" opacity="0.5"/>
        </svg>
      </div>
    `;
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const points = values.map((val, i) => {
    const x = (i / (values.length - 1)) * 100;
    const y = 100 - ((val - min) / range) * 100;
    return `${x},${y}`;
  }).join(' ');

  return `
    <div class="sparkline">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none">
        <polyline points="${points}" fill="none" stroke="${color}" stroke-width="2" vector-effect="non-scaling-stroke"/>
      </svg>
    </div>
  `;
}

function renderSensorPanel(sensor) {
  const icon = CATEGORY_ICONS[sensor.category] || 'radio';
  const typeClass = `sensor-${sensor.category}`;
  const panelKey = `sensor:${sensor.storageId || sensor.id}`;
  const displayName = getPanelDisplayName(panelKey, sensor.name);

  let value = '--';
  let unit = '';
  let minMax = '';

  if (sensor.category === 'temperature' && sensor.state.temperature !== undefined) {
    value = sensor.state.temperature.toFixed(1);
    unit = '°C';
    if (sensor.dailyStats) {
      minMax = `<span class="sensor-minmax">${sensor.dailyStats.min.toFixed(1)} / ${sensor.dailyStats.max.toFixed(1)}</span>`;
    }
  } else if (sensor.category === 'motion') {
    value = sensor.state.presence ? 'DETECTED' : 'CLEAR';
  } else if (sensor.category === 'lightlevel' && sensor.state.lightlevel !== undefined) {
    value = sensor.state.lightlevel;
    unit = ' lux';
  } else if (sensor.category === 'switch') {
    value = 'READY';
  } else if (sensor.category === 'pm25' && sensor.state.pm25 !== undefined) {
    value = sensor.state.pm25;
    unit = ' µg/m³';
    if (sensor.dailyStats) {
      minMax = `<span class="sensor-minmax">${sensor.dailyStats.min} / ${sensor.dailyStats.max}</span>`;
    }
  }

  const activeClass = (sensor.category === 'motion' && sensor.state.presence) ? 'active' : '';

  const colorMap = {
    temperature: '#ff6b35',
    motion: sensor.state.presence ? '#00ff88' : '#00d4ff',
    lightlevel: '#ffd700',
    switch: '#b388ff',
    pm25: '#00d4ff'
  };
  const sparklineColor = colorMap[sensor.category] || '#ff8c00';

  let bottomContent = renderSparkline(sensor.history, sparklineColor);
  if (sensor.category === 'motion') {
    const detections = getLastMotionDetections(sensor.history, 8);
    if (detections.length > 0) {
      bottomContent = `<div class="motion-detections">${detections.map(d => `<span>${d}</span>`).join('')}</div>`;
    } else if (sensor.state.lastupdated) {
      bottomContent = `<div class="motion-detections"><span>${formatTimeAgo(sensor.state.lastupdated)}</span></div>`;
    } else {
      bottomContent = `<div class="motion-detections"><span>No recent activity</span></div>`;
    }
  }

  return `
    <section class="sensor-panel ${typeClass} ${activeClass}" data-panel-key="${panelKey}" data-default-name="${sensor.name}">
      <div class="sensor-header">
        <i data-lucide="${icon}"></i>
        <span class="panel-title">${displayName}</span>
      </div>
      <div class="sensor-content">
        <div class="sensor-main">
          <span class="sensor-value">${value}<span class="sensor-unit">${unit}</span></span>
          ${minMax}
        </div>
        ${bottomContent}
      </div>
    </section>
  `;
}

function renderSensorPanels(sensors) {
  const tempSensors = sensors.filter(s => s.category === 'temperature');
  const motionSensors = sensors.filter(s => s.category === 'motion');
  const lightSensors = sensors.filter(s => s.category === 'lightlevel');
  const switches = sensors.filter(s => s.category === 'switch');

  let html = '';

  tempSensors.forEach(s => { html += renderSensorPanel(s); });
  motionSensors.forEach(s => { html += renderSensorPanel(s); });
  lightSensors.forEach(s => { html += renderSensorPanel(s); });
  switches.forEach(s => { html += renderSensorPanel(s); });
  pm25Sensors.forEach(s => { html += renderSensorPanel(s); });

  return html;
}

function renderNanoleafItem() {
  if (!nanoleafDevice || !nanoleafConfig) {
    return '';
  }

  const isOn = nanoleafDevice.state.on;
  const color = isOn ? getNanoleafColor(nanoleafDevice.state) : '#333';
  const stateText = isOn ? `${nanoleafDevice.state.brightness}%` : 'OFF';

  return `
    <div class="light-item nanoleaf-item ${isOn ? '' : 'off'}"
         data-id="nanoleaf"
         data-name="${nanoleafDevice.name}"
         data-category="nanoleaf">
      <i data-lucide="triangle" class="device-icon ${isOn ? 'on' : ''}"></i>
      <span class="light-indicator ${isOn ? 'on' : ''}"
            style="background-color: ${color}"></span>
      <span class="light-name">${nanoleafDevice.name}</span>
      <span class="light-state">${stateText}</span>
    </div>
  `;
}

function getNanoleafColor(state) {
  if (!state.on) {
    return '#333';
  }

  if (state.hue !== undefined && state.sat !== undefined) {
    return `hsl(${state.hue}, ${state.sat}%, 50%)`;
  }

  return '#fff';
}

async function loadRooms() {
  const content = $('#rooms-content');

  try {
    const [rooms, device, config] = await Promise.all([
      API.hue.rooms(),
      API.nanoleaf.device(),
      API.nanoleaf.config()
    ]);

    nanoleafDevice = device?.configured ? device : null;
    nanoleafConfig = config?.configured ? config : null;

    if (rooms.length === 0) {
      content.innerHTML = `<div class="loading">No rooms found. Configure Hue Bridge first.</div>`;
      return;
    }

    allRooms = rooms;
    allLights = rooms.flatMap(r => r.lights);
    populateLightSelect();

    const sensorsRoom = rooms.find(r => r.id === 'sensors');
    const regularRooms = rooms.filter(r => r.id !== 'sensors');

    if (sensorsRoom) {
      $('#sensors-content').innerHTML = renderSensorPanels(sensorsRoom.lights);
    }

    let html = regularRooms.map(room => {
      const showNanoleaf = nanoleafConfig?.roomId?.toLowerCase() === room.name.toLowerCase();
      const roomIcon = getRoomIcon(room.class);
      const panelKey = `room:${room.id}`;
      const displayName = getPanelDisplayName(panelKey, room.name.toUpperCase());

      return `
        <section class="panel room-panel" data-panel-key="${panelKey}" data-default-name="${room.name.toUpperCase()}">
          <div class="panel-header">
            <i data-lucide="${roomIcon}"></i>
            <span class="panel-title">${displayName}</span>
            <button class="btn-icon refresh-room" title="Refresh">
              <i data-lucide="refresh-cw"></i>
            </button>
          </div>
          <div class="panel-content">
            <div class="lights-list">
              ${showNanoleaf ? renderNanoleafItem() : ''}
              ${room.lights.map(light => {
                const isSelected = String(light.id) === String(selectedLightId);
                const isOn = light.state.on && light.state.reachable !== false;
                const isOffline = light.state.reachable === false;
                const color = getLightColor(light.state);
                const icon = getDeviceIcon(light.category, light.archetype);
                const stateText = getStateText(light);
                return `
                  <div class="light-item ${isSelected ? 'selected' : ''} ${isOffline ? 'offline' : ''}"
                       data-id="${light.id}"
                       data-name="${light.name}"
                       data-category="${light.category}">
                    <i data-lucide="${icon}" class="device-icon ${isOn ? 'on' : ''}"></i>
                    <span class="light-indicator ${isOn ? 'on' : ''}"
                          style="background-color: ${color}"></span>
                    <span class="light-name">${light.name}</span>
                    <span class="light-state">${stateText}</span>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        </section>
      `;
    }).join('');

    content.innerHTML = html;

    lucide.createIcons();
    attachEditableTitles();

    $$('.refresh-room').forEach(el => {
      el.addEventListener('click', loadRooms);
    });
  } catch (err) {
    content.innerHTML = `<div class="loading error">Error: ${err.message}</div>`;
  }
}

function updateRooms(rooms) {
  if (!rooms || rooms.length === 0) {
    return;
  }

  allRooms = rooms;
  allLights = rooms.flatMap(r => r.lights);

  const sensorsRoom = rooms.find(r => r.id === 'sensors');
  if (sensorsRoom) {
    $('#sensors-content').innerHTML = renderSensorPanels(sensorsRoom.lights);
  }

  rooms.filter(r => r.id !== 'sensors').forEach(room => {
    room.lights.forEach(light => {
      const el = $(`.light-item[data-id="${light.id}"]`);
      if (!el) {
        return;
      }

      const isOn = light.state.on && light.state.reachable !== false;
      const isOffline = light.state.reachable === false;
      const color = getLightColor(light.state);
      const stateText = getStateText(light);

      el.classList.toggle('offline', isOffline);
      const indicator = el.querySelector('.light-indicator');
      if (indicator) {
        indicator.classList.toggle('on', isOn);
        indicator.style.backgroundColor = color;
      }
      const icon = el.querySelector('.device-icon');
      if (icon) {
        icon.classList.toggle('on', isOn);
      }
      const stateEl = el.querySelector('.light-state');
      if (stateEl) {
        stateEl.textContent = stateText;
      }
    });
  });

  lucide.createIcons();
}

function getStateText(light) {
  if (light.isSensor) {
    if (light.state.temperature !== undefined) {
      return `${light.state.temperature.toFixed(1)}C`;
    }
    if (light.state.presence !== undefined) {
      return light.state.presence ? 'MOTION' : 'CLEAR';
    }
    if (light.state.lightlevel !== undefined) {
      return `${light.state.lightlevel} lux`;
    }
    return '--';
  }

  if (light.state.reachable === false) {
    return 'OFFLINE';
  }

  if (!light.state.on) {
    return 'OFF';
  }

  if (light.state.bri !== undefined) {
    return `${Math.round(light.state.bri / 254 * 100)}%`;
  }

  return 'ON';
}

function getLightColor(state) {
  if (!state.on || state.reachable === false) {
    return '#333';
  }

  if (state.colormode === 'ct') {
    const kelvin = Math.round(1000000 / state.ct);
    if (kelvin < 4000) {
      return '#ffcc88';
    }
    return '#fff5e6';
  }

  if (state.hue !== undefined && state.sat !== undefined) {
    const h = (state.hue / 65535) * 360;
    const s = (state.sat / 254) * 100;
    return `hsl(${h}, ${s}%, 50%)`;
  }

  return '#fff';
}

function populateLightSelect() {
  const select = $('#sync-source-select');
  const currentValue = select.value;

  select.innerHTML = '<option value="">-- Select a light --</option>';

  allRooms.forEach(room => {
    const syncableLights = room.lights.filter(l =>
      SYNCABLE_CATEGORIES.includes(l.category)
    );

    if (syncableLights.length === 0) {
      return;
    }

    const optgroup = document.createElement('optgroup');
    optgroup.label = room.name;

    syncableLights.forEach(light => {
      const option = document.createElement('option');
      option.value = light.id;
      option.textContent = light.name;
      if (String(light.id) === String(selectedLightId)) {
        option.selected = true;
      }
      optgroup.appendChild(option);
    });

    select.appendChild(optgroup);
  });

  if (currentValue && !select.value) {
    select.value = currentValue;
  }
}

async function selectLight(el) {
  if (configLocked) {
    log('Config is locked', 'error');
    return;
  }

  const id = parseInt(el.dataset.id, 10);
  const name = el.dataset.name;
  const category = el.dataset.category;

  if (!SYNCABLE_CATEGORIES.includes(category)) {
    log(`Cannot sync with ${category} device`, 'error');
    return;
  }

  selectedLightId = id;

  $$('.light-item').forEach(item => item.classList.remove('selected'));
  el.classList.add('selected');

  await API.sync.setConfig({ hueDeviceId: id, hueDeviceName: name });
  $('#sync-source-select').value = id;
  log(`Selected light: ${name}`);
}

async function onSourceSelectChange(e) {
  const select = e.target;
  const id = parseInt(select.value, 10);
  if (!id) {
    return;
  }

  const light = allLights.find(l => l.id === id);
  if (!light) {
    return;
  }

  const previousId = selectedLightId;
  const confirmed = confirm(`Change sync source to "${light.name}"?`);

  if (!confirmed) {
    select.value = previousId || '';
    return;
  }

  selectedLightId = id;

  $$('.light-item').forEach(item => {
    item.classList.toggle('selected', String(item.dataset.id) === String(id));
  });

  await API.sync.setConfig({ hueDeviceId: id, hueDeviceName: light.name });
  log(`Selected light: ${light.name}`);
}

async function loadSyncConfig() {
  try {
    syncConfig = await API.sync.config();
    configLocked = syncConfig.allowChange === false;

    const select = $('#sync-source-select');
    if (select) {
      select.disabled = configLocked;
      if (syncConfig.hueDeviceId) {
        selectedLightId = syncConfig.hueDeviceId;
        select.value = syncConfig.hueDeviceId;
      }
    }

    const nanoleafConfig = await API.nanoleaf.config();
    if (nanoleafConfig.configured) {
      $('#min-brightness').value = nanoleafConfig.minBrightness;
      $('#max-brightness').value = nanoleafConfig.maxBrightness;
      $('#min-brightness-value').textContent = `${nanoleafConfig.minBrightness}%`;
      $('#max-brightness-value').textContent = `${nanoleafConfig.maxBrightness}%`;
      $('#brightness-range').textContent = `${nanoleafConfig.minBrightness}% - ${nanoleafConfig.maxBrightness}%`;
    }

    const status = await API.sync.status();
    updateSyncStatus(status);
  } catch (err) {
    log(`Error loading config: ${err.message}`, 'error');
  }
}

function showModal(title, content, footer = '') {
  $('#modal-title').textContent = title;
  $('#modal-body').innerHTML = content;
  $('#modal-footer').innerHTML = footer;
  $('#discover-modal').hidden = false;
  lucide.createIcons();
}

function hideModal() {
  $('#discover-modal').hidden = true;
}

async function discoverHue() {
  showModal('DISCOVERING HUE BRIDGES', '<div class="loading">Scanning network...</div>');
  log('Scanning for Hue bridges...');

  try {
    const bridges = await API.hue.discover();

    if (bridges.length === 0) {
      showModal('NO BRIDGES FOUND', `
        <p>No Hue bridges were found on your network.</p>
        <p style="margin-top: 12px">Make sure your bridge is powered on and connected to the same network.</p>
      `, '<button class="btn" onclick="hideModal()">CLOSE</button>');
      return;
    }

    showModal('SELECT HUE BRIDGE', `
      <div class="device-list">
        ${bridges.map(b => `
          <div class="device-item" onclick="pairHue('${b.ip}')">
            <i data-lucide="server"></i>
            <span class="name">Hue Bridge</span>
            <span class="ip">${b.ip}</span>
          </div>
        `).join('')}
      </div>
    `);
    lucide.createIcons();
  } catch (err) {
    showModal('ERROR', `<p class="error">${err.message}</p>`,
      '<button class="btn" onclick="hideModal()">CLOSE</button>');
  }
}

async function pairHue(ip) {
  showModal('PAIRING HUE BRIDGE', `
    <div class="pairing-instructions">
      <i data-lucide="circle-dot"></i>
      <p>Press the <span class="highlight">Link button</span> on your Hue Bridge</p>
      <p>Then click PAIR below</p>
    </div>
  `, `
    <button class="btn" onclick="hideModal()">CANCEL</button>
    <button class="btn btn-start" onclick="confirmPairHue('${ip}')">PAIR</button>
  `);
  lucide.createIcons();
}

async function confirmPairHue(ip) {
  showModal('PAIRING...', '<div class="loading">Connecting to bridge...</div>');

  try {
    const result = await API.hue.pair(ip);

    if (result.success) {
      hideModal();
      log('Hue Bridge paired successfully!', 'success');
      await loadHueBridge();
      await loadRooms();
    } else {
      showModal('PAIRING FAILED', `
        <p class="error">${result.error}</p>
        <p style="margin-top: 12px">Make sure you pressed the Link button, then try again.</p>
      `, `
        <button class="btn" onclick="hideModal()">CANCEL</button>
        <button class="btn btn-start" onclick="pairHue('${ip}')">RETRY</button>
      `);
    }
  } catch (err) {
    showModal('ERROR', `<p class="error">${err.message}</p>`,
      '<button class="btn" onclick="hideModal()">CLOSE</button>');
  }
}

async function discoverNanoleaf() {
  showModal('DISCOVERING NANOLEAF', '<div class="loading">Scanning network (10 seconds)...</div>');
  log('Scanning for Nanoleaf devices...');

  try {
    const devices = await API.nanoleaf.discover();

    if (devices.length === 0) {
      showModal('NO DEVICES FOUND', `
        <p>No Nanoleaf devices were found on your network.</p>
        <p style="margin-top: 12px">Make sure your device is powered on and connected to the same network.</p>
      `, '<button class="btn" onclick="hideModal()">CLOSE</button>');
      return;
    }

    showModal('SELECT NANOLEAF', `
      <div class="device-list">
        ${devices.map(d => `
          <div class="device-item" onclick="pairNanoleaf('${d.ip}', ${d.port})">
            <i data-lucide="triangle"></i>
            <span class="name">${d.name}</span>
            <span class="ip">${d.ip}:${d.port}</span>
          </div>
        `).join('')}
      </div>
    `);
    lucide.createIcons();
  } catch (err) {
    showModal('ERROR', `<p class="error">${err.message}</p>`,
      '<button class="btn" onclick="hideModal()">CLOSE</button>');
  }
}

async function pairNanoleaf(ip, port) {
  showModal('PAIRING NANOLEAF', `
    <div class="pairing-instructions">
      <i data-lucide="hand"></i>
      <p>Hold the <span class="highlight">power button</span> on your Nanoleaf for 5-7 seconds</p>
      <p>Wait until the LED starts flashing, then click PAIR</p>
    </div>
  `, `
    <button class="btn" onclick="hideModal()">CANCEL</button>
    <button class="btn btn-start" onclick="confirmPairNanoleaf('${ip}', ${port})">PAIR</button>
  `);
  lucide.createIcons();
}

async function confirmPairNanoleaf(ip, port) {
  showModal('PAIRING...', '<div class="loading">Connecting to Nanoleaf...</div>');

  try {
    const result = await API.nanoleaf.pair(ip, port);

    if (result.success) {
      hideModal();
      log('Nanoleaf paired successfully!', 'success');
      await loadNanoleaf();
    } else {
      showModal('PAIRING FAILED', `
        <p class="error">${result.error}</p>
        <p style="margin-top: 12px">Make sure you held the power button until the LED flashed.</p>
      `, `
        <button class="btn" onclick="hideModal()">CANCEL</button>
        <button class="btn btn-start" onclick="pairNanoleaf('${ip}', ${port})">RETRY</button>
      `);
    }
  } catch (err) {
    showModal('ERROR', `<p class="error">${err.message}</p>`,
      '<button class="btn" onclick="hideModal()">CLOSE</button>');
  }
}

async function init() {
  lucide.createIcons();
  updateClock();
  setInterval(updateClock, 1000);

  connectWebSocket();

  await loadPanelNames();
  await loadSyncConfig();
  await Promise.all([
    loadHueBridge(),
    loadNanoleaf(),
    loadHomeConnect(),
    loadRoomba(),
    loadAirPurifiers(),
    loadRooms()
  ]);

  $('#discover-hue').addEventListener('click', discoverHue);
  $('#modal-close').addEventListener('click', hideModal);
  $('#sync-source-select').addEventListener('change', onSourceSelectChange);

  $('#btn-sync-toggle').addEventListener('click', async () => {
    const isRunning = $('#sync-status').textContent === 'RUNNING';
    if (isRunning) {
      await API.sync.stop();
    } else {
      const result = await API.sync.start();
      if (!result.success) {
        log(`Failed to start: ${result.error}`, 'error');
      }
    }
  });

  $('#clear-log').addEventListener('click', () => {
    $('#log-content').innerHTML = '';
    log('Log cleared');
  });

  $('#min-brightness').addEventListener('input', (e) => {
    $('#min-brightness-value').textContent = `${e.target.value}%`;
  });

  $('#max-brightness').addEventListener('input', (e) => {
    $('#max-brightness-value').textContent = `${e.target.value}%`;
  });

  $('#min-brightness').addEventListener('change', async (e) => {
    await API.nanoleaf.updateConfig({ minBrightness: parseInt(e.target.value, 10) });
    updateBrightnessRange();
  });

  $('#max-brightness').addEventListener('change', async (e) => {
    await API.nanoleaf.updateConfig({ maxBrightness: parseInt(e.target.value, 10) });
    updateBrightnessRange();
  });

  log('System ready');
}

function updateBrightnessRange() {
  const min = $('#min-brightness').value;
  const max = $('#max-brightness').value;
  $('#brightness-range').textContent = `${min}% - ${max}%`;
}

window.hideModal = hideModal;
window.pairHue = pairHue;
window.confirmPairHue = confirmPairHue;
window.pairNanoleaf = pairNanoleaf;
window.confirmPairNanoleaf = confirmPairNanoleaf;
window.configureHomeConnect = configureHomeConnect;
window.startHomeConnectAuth = startHomeConnectAuth;
window.disconnectHomeConnect = disconnectHomeConnect;
window.startRoomba = startRoomba;
window.pauseRoomba = pauseRoomba;
window.resumeRoomba = resumeRoomba;
window.dockRoomba = dockRoomba;
window.togglePurifierPower = togglePurifierPower;
window.setPurifierMode = setPurifierMode;
window.setPurifierFan = setPurifierFan;
window.connectPurifier = connectPurifier;
window.addPurifier = addPurifier;
window.confirmAddPurifier = confirmAddPurifier;
window.removePurifier = removePurifier;
window.confirmRemovePurifier = confirmRemovePurifier;

document.addEventListener('DOMContentLoaded', init);
