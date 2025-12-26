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
  airpurifier: {
    discover: () => fetch('/api/airpurifier/discover').then(r => r.json()),
    devices: () => fetch('/api/airpurifier/devices').then(r => r.json()),
    pair: (ip) => fetch('/api/airpurifier/devices/pair', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ip })
    }).then(r => r.json()),
    remove: (id) => fetch(`/api/airpurifier/devices/${id}`, { method: 'DELETE' }).then(r => r.json()),
    setPower: (id, on) => fetch(`/api/airpurifier/devices/${id}/power`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ on })
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
  device: 'cpu'
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
let airPurifiers = [];
const HISTORY_LENGTH = 2880;

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
  };

  ws.onclose = () => {
    $('#connection-status').classList.remove('online');
    $('#connection-status').innerHTML = `
      <i data-lucide="wifi-off"></i>
      <span>OFFLINE</span>
    `;
    lucide.createIcons();
    log('WebSocket disconnected', 'error');
    setTimeout(connectWebSocket, 3000);
  };

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    handleWebSocketMessage(msg);
  };
}

function handleWebSocketMessage(msg) {
  switch (msg.type) {
    case 'status':
      updateSyncStatus(msg.data);
      break;
    case 'log':
      log(msg.data.message);
      break;
    case 'config':
      loadSyncConfig();
      break;
    case 'rooms':
      updateRooms(msg.data);
      break;
    case 'airpurifiers':
      updateAirPurifiers(msg.data);
      break;
  }
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

function getAirQualityLabel(level) {
  const labels = {
    'good': 'GOOD',
    'moderate': 'MODERATE',
    'unhealthy-sensitive': 'SENSITIVE',
    'unhealthy': 'UNHEALTHY',
    'very-unhealthy': 'VERY UNHEALTHY',
    'hazardous': 'HAZARDOUS'
  };
  return labels[level] || 'UNKNOWN';
}

function renderAirPurifier(purifier) {
  if (purifier.offline) {
    return `
      <div class="purifier-item offline" data-id="${purifier.id}">
        <div class="purifier-header">
          <i data-lucide="wind"></i>
          <span class="purifier-name">${purifier.name}</span>
          <span class="status-badge offline">OFFLINE</span>
        </div>
      </div>
    `;
  }

  const aqColor = purifier.airQuality?.color || '#666';
  const aqLevel = purifier.airQuality?.level || 'unknown';
  const pm25Display = purifier.pm25 !== null ? purifier.pm25 : '--';

  return `
    <div class="purifier-item ${purifier.power ? 'on' : 'off'}" data-id="${purifier.id}">
      <div class="purifier-header">
        <i data-lucide="wind"></i>
        <span class="purifier-name">${purifier.name}</span>
        <span class="status-badge ${purifier.power ? 'online' : 'offline'}">
          ${purifier.power ? 'ON' : 'OFF'}
        </span>
      </div>
      <div class="purifier-stats">
        <div class="purifier-stat main">
          <span class="stat-value" style="color: ${aqColor}">${pm25Display}</span>
          <span class="stat-label">PM2.5</span>
          <span class="stat-quality" style="background: ${aqColor}">${getAirQualityLabel(aqLevel)}</span>
        </div>
        ${purifier.humidity !== null ? `
          <div class="purifier-stat">
            <i data-lucide="droplets"></i>
            <span class="stat-value">${purifier.humidity}%</span>
          </div>
        ` : ''}
        ${purifier.temperature !== null ? `
          <div class="purifier-stat">
            <i data-lucide="thermometer"></i>
            <span class="stat-value">${purifier.temperature}°C</span>
          </div>
        ` : ''}
        ${purifier.fanSpeed ? `
          <div class="purifier-stat">
            <i data-lucide="gauge"></i>
            <span class="stat-value">${purifier.fanSpeed}</span>
          </div>
        ` : ''}
      </div>
    </div>
  `;
}

async function loadAirPurifiers() {
  const content = $('#airpurifier-content');

  try {
    const devices = await API.airpurifier.devices();
    airPurifiers = devices;

    if (devices.length === 0) {
      content.innerHTML = `
        <div class="device-info">
          <div class="info-row">
            <span class="label">STATUS:</span>
            <span class="status-badge offline">NO DEVICES</span>
          </div>
          <p style="margin-top: 12px; color: var(--text-dim)">
            Click the search icon to discover air purifiers
          </p>
        </div>
      `;
      return;
    }

    content.innerHTML = `
      <div class="purifier-list">
        ${devices.map(p => renderAirPurifier(p)).join('')}
      </div>
    `;
    lucide.createIcons();
  } catch (err) {
    content.innerHTML = `<div class="loading error">Error: ${err.message}</div>`;
  }
}

function updateAirPurifiers(devices) {
  airPurifiers = devices;
  const content = $('#airpurifier-content');

  if (devices.length === 0) {
    return;
  }

  content.innerHTML = `
    <div class="purifier-list">
      ${devices.map(p => renderAirPurifier(p)).join('')}
    </div>
  `;
  lucide.createIcons();
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

function renderSparkline(history, color) {
  if (!history || history.length < 2) {
    return `
      <div class="sparkline">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none">
          <line x1="0" y1="50" x2="100" y2="50" stroke="#666" stroke-width="2" stroke-dasharray="4,4" vector-effect="non-scaling-stroke" opacity="0.5"/>
        </svg>
      </div>
    `;
  }

  const min = Math.min(...history);
  const max = Math.max(...history);
  const range = max - min || 1;

  const points = history.map((val, i) => {
    const x = (i / (HISTORY_LENGTH - 1)) * 100;
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
  }

  const activeClass = (sensor.category === 'motion' && sensor.state.presence) ? 'active' : '';

  const colorMap = {
    temperature: '#ff6b35',
    motion: sensor.state.presence ? '#00ff88' : '#00d4ff',
    lightlevel: '#ffd700',
    switch: '#b388ff'
  };
  const sparklineColor = colorMap[sensor.category] || '#ff8c00';

  return `
    <section class="sensor-panel ${typeClass} ${activeClass}">
      <div class="sensor-header">
        <i data-lucide="${icon}"></i>
        <span>${sensor.name}</span>
      </div>
      <div class="sensor-content">
        <div class="sensor-main">
          <span class="sensor-value">${value}<span class="sensor-unit">${unit}</span></span>
          ${minMax}
        </div>
        ${renderSparkline(sensor.history, sparklineColor)}
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

      return `
        <section class="panel room-panel">
          <div class="panel-header">
            <i data-lucide="${roomIcon}"></i>
            <span>${room.name.toUpperCase()}</span>
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

async function discoverAirPurifier() {
  showModal('DISCOVERING AIR PURIFIERS', '<div class="loading">Scanning network (10 seconds)...</div>');
  log('Scanning for air purifiers...');

  try {
    const devices = await API.airpurifier.discover();

    showModal('ADD AIR PURIFIER', `
      <p style="margin-bottom: 12px; color: var(--text-dim)">
        Enter the IP address of your Philips air purifier:
      </p>
      <div class="input-row">
        <input type="text" id="purifier-ip" placeholder="192.168.1.xxx" class="modal-input">
      </div>
      ${devices.length > 0 ? `
        <p style="margin-top: 16px; margin-bottom: 8px">Or select a discovered device:</p>
        <div class="device-list">
          ${devices.map(d => `
            <div class="device-item" onclick="pairAirPurifier('${d.ip}')">
              <i data-lucide="wind"></i>
              <span class="name">${d.name}</span>
              <span class="ip">${d.ip}</span>
            </div>
          `).join('')}
        </div>
      ` : ''}
    `, `
      <button class="btn" onclick="hideModal()">CANCEL</button>
      <button class="btn btn-start" onclick="pairAirPurifierFromInput()">CONNECT</button>
    `);
    lucide.createIcons();
  } catch (err) {
    showModal('ERROR', `<p class="error">${err.message}</p>`,
      '<button class="btn" onclick="hideModal()">CLOSE</button>');
  }
}

function pairAirPurifierFromInput() {
  const ip = $('#purifier-ip').value.trim();
  if (ip) {
    pairAirPurifier(ip);
  }
}

async function pairAirPurifier(ip) {
  showModal('CONNECTING...', '<div class="loading">Connecting to air purifier...</div>');

  try {
    const result = await API.airpurifier.pair(ip);

    if (result.success) {
      hideModal();
      log(`Air purifier paired: ${result.config.name}`, 'success');
      await loadAirPurifiers();
    } else {
      showModal('CONNECTION FAILED', `
        <p class="error">${result.error}</p>
        <p style="margin-top: 12px">Make sure the purifier is on the same network and powered on.</p>
      `, `
        <button class="btn" onclick="hideModal()">CANCEL</button>
        <button class="btn btn-start" onclick="discoverAirPurifier()">RETRY</button>
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

  await loadSyncConfig();
  await Promise.all([
    loadHueBridge(),
    loadNanoleaf(),
    loadAirPurifiers(),
    loadRooms()
  ]);

  $('#discover-hue').addEventListener('click', discoverHue);
  $('#discover-nanoleaf').addEventListener('click', discoverNanoleaf);
  $('#discover-airpurifier').addEventListener('click', discoverAirPurifier);
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
window.pairAirPurifier = pairAirPurifier;
window.pairAirPurifierFromInput = pairAirPurifierFromInput;
window.discoverAirPurifier = discoverAirPurifier;

document.addEventListener('DOMContentLoaded', init);
