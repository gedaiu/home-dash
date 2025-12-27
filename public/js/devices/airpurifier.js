import { API } from '../api.js';
import { $ } from '../utils.js';
import { log } from '../log.js';
import { showModal, hideModal } from '../modal.js';
import { getPanelDisplayName, attachEditableTitles } from '../panels.js';

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
    'P': 'AUTO',
    'AG': 'ALLERGEN',
    'GT': 'GENTLE',
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
  const mode = device.mode || 'P';
  const om = device.om || '1';
  const qualityClass = iaql !== null ? getAirQualityClass(iaql) : '';

  const defaultModes = [
    { value: 'P', label: 'AUTO' },
    { value: 'S', label: 'SLEEP' },
    { value: 'T', label: 'TURBO' }
  ];
  const defaultSpeeds = ['s', '1', '2', 't'];

  const capabilities = device.capabilities || {};
  const availableModes = capabilities.modes || defaultModes;
  const availableSpeeds = capabilities.speeds || defaultSpeeds;
  const hasManualMode = capabilities.hasManualMode !== false && availableModes.some(function(m) { return m.value === 'M'; });

  const modeOptions = availableModes.map(function(m) {
    return '<option value="' + m.value + '" ' + (mode === m.value ? 'selected' : '') + '>' + m.label + '</option>';
  }).join('');

  const speedLabels = { 's': 'SLEEP', '1': '1', '2': '2', '3': '3', 't': 'TURBO' };
  const speedOptions = availableSpeeds.map(function(s) {
    return '<option value="' + s + '" ' + (om === s ? 'selected' : '') + '>' + speedLabels[s] + '</option>';
  }).join('');

  const fanRow = hasManualMode ?
    '<div class="info-row">' +
    '<span class="label">FAN:</span>' +
    '<select class="control-select" onchange="setPurifierFan(' + index + ', this.value)" ' + (!isOn || mode !== 'M' ? 'disabled' : '') + '>' +
    speedOptions +
    '</select>' +
    '</div>' : '';

  return '<section class="panel" data-panel-key="' + panelKey + '" data-default-name="' + defaultName + '">' +
    '<div class="panel-header">' +
    '<i data-lucide="wind"></i>' +
    '<span class="panel-title">' + displayName + '</span>' +
    '<button class="btn-icon ' + (isOn ? 'btn-stop' : 'btn-start') + '" onclick="togglePurifierPower(' + index + ')" title="' + (isOn ? 'Stop' : 'Start') + '">' +
    '<i data-lucide="' + (isOn ? 'square' : 'play') + '"></i>' +
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
    modeOptions +
    '</select>' +
    '</div>' +
    fanRow +
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

export async function loadAirPurifiers() {
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

export function updateAirPurifier(data) {
  loadAirPurifiers();
}

export async function togglePurifierPower(index) {
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

export async function setPurifierMode(index, mode) {
  try {
    await API.airpurifier.mode(index, mode);
    log('Purifier ' + (index + 1) + ' mode set to ' + getModeLabel(mode), 'success');
  } catch (err) {
    log('Failed to set mode: ' + err.message, 'error');
  }
}

export async function setPurifierFan(index, speed) {
  try {
    await API.airpurifier.fan(index, speed);
    log('Purifier ' + (index + 1) + ' fan set to ' + getFanLabel(speed), 'success');
  } catch (err) {
    log('Failed to set fan speed: ' + err.message, 'error');
  }
}

export async function connectPurifier(index) {
  try {
    await API.airpurifier.connect(index);
    log('Connecting to purifier ' + (index + 1) + '...', 'info');
    await loadAirPurifiers();
  } catch (err) {
    log('Failed to connect: ' + err.message, 'error');
  }
}

export async function addPurifier() {
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

export async function confirmAddPurifier() {
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

export async function removePurifier(index) {
  showModal('REMOVE PURIFIER',
    '<p>Are you sure you want to remove this air purifier?</p>',
    '<button class="btn" onclick="hideModal()">CANCEL</button>' +
    '<button class="btn btn-danger" onclick="confirmRemovePurifier(' + index + ')">REMOVE</button>'
  );
}

export async function confirmRemovePurifier(index) {
  try {
    await API.airpurifier.remove(index);
    hideModal();
    log('Air purifier removed', 'success');
    await loadAirPurifiers();
  } catch (err) {
    log('Failed to remove purifier: ' + err.message, 'error');
  }
}
