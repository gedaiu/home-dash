import { API } from './api.js';
import { $, $$, CATEGORY_ICONS, SYNCABLE_CATEGORIES } from './utils.js';
import { getDeviceIcon, getRoomIcon, getLightColor, getStateText, renderSparkline, getLastMotionDetections, formatTimeAgo } from './utils.js';
import { getPanelDisplayName, attachEditableTitles } from './panels.js';
import { nanoleafDevice, nanoleafConfig, setNanoleafDevice, setNanoleafConfig, renderNanoleafItem, getNanoleafColor } from './devices/nanoleaf.js';

let allRooms = [];
let allLights = [];
let pm25Sensors = [];
let selectedLightId = null;
let configLocked = false;

function decodeButtonEvent(buttonevent) {
  if (buttonevent === undefined || buttonevent === null) {
    return null;
  }

  const code = parseInt(buttonevent, 10);

  if (code >= 34 && code <= 18) {
    const tapButtons = { 34: '1', 16: '2', 17: '3', 18: '4' };
    return { button: tapButtons[code] || '?', action: 'TAP' };
  }

  const button = Math.floor(code / 1000);
  const action = code % 10;

  const buttonNames = {
    1: 'ON',
    2: 'UP',
    3: 'DOWN',
    4: 'OFF'
  };

  const actionNames = {
    0: 'PRESS',
    1: 'HOLD',
    2: 'TAP',
    3: 'RELEASE'
  };

  const buttonName = buttonNames[button] || `BTN${button}`;
  const actionName = actionNames[action] || '';

  return { button: buttonName, action: actionName };
}

function formatButtonEvent(buttonevent, lastupdated) {
  const decoded = decodeButtonEvent(buttonevent);
  if (!decoded) {
    return { value: 'READY', timeAgo: '' };
  }

  const value = `${decoded.button}`;
  const timeAgo = lastupdated ? formatTimeAgo(lastupdated) : '';

  return { value, timeAgo };
}

export function getAllRooms() {
  return allRooms;
}

export function getAllLights() {
  return allLights;
}

export function getSelectedLightId() {
  return selectedLightId;
}

export function setSelectedLightId(id) {
  selectedLightId = id;
}

export function setConfigLocked(locked) {
  configLocked = locked;
}

export function updatePm25Sensors(sensors) {
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
    const btnEvent = formatButtonEvent(sensor.state.buttonevent, sensor.state.lastupdated);
    value = btnEvent.value;
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
    const detections = getLastMotionDetections(sensor.history);
    if (detections.length > 0) {
      bottomContent = `<div class="motion-detections">${detections.map(d => `<span>${d}</span>`).join('')}</div>`;
    } else if (sensor.state.lastupdated) {
      bottomContent = `<div class="motion-detections"><span>${formatTimeAgo(sensor.state.lastupdated)}</span></div>`;
    } else {
      bottomContent = `<div class="motion-detections"><span>No recent activity</span></div>`;
    }
  } else if (sensor.category === 'switch') {
    const btnEvent = formatButtonEvent(sensor.state.buttonevent, sensor.state.lastupdated);
    if (btnEvent.timeAgo) {
      bottomContent = `<div class="switch-lastpress"><span>${btnEvent.timeAgo}</span></div>`;
    } else {
      bottomContent = `<div class="switch-lastpress"><span>No presses recorded</span></div>`;
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

export async function loadRooms() {
  const content = $('#rooms-content');

  try {
    const [rooms, device, config] = await Promise.all([
      API.hue.rooms(),
      API.nanoleaf.device(),
      API.nanoleaf.config()
    ]);

    setNanoleafDevice(device?.configured ? device : null);
    setNanoleafConfig(config?.configured ? config : null);

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

export function updateRooms(rooms) {
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

export function populateLightSelect() {
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
