import { API } from '../api.js';
import { $ } from '../utils.js';
import { log } from '../log.js';
import { showModal, hideModal } from '../modal.js';
import { getPanelDisplayName, attachEditableTitles } from '../panels.js';

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

export function updateAirPurifier() {
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
  const address = document.getElementById('purifier-ip').value.trim();
  const name = document.getElementById('purifier-name').value.trim();

  if (!address) {
    log('Please enter an IP address', 'error');

    return;
  }

  showModal('ADDING DEVICE', '<div class="loading">Connecting to device...</div>');

  try {
    const result = await API.airpurifier.add(address, name);

    if (!result.success) {
      showModal('FAILED', '<p class="error">' + result.error + '</p>',
        '<button class="btn" onclick="hideModal()">CLOSE</button>');

      return;
    }

    hideModal();
    log('Air purifier added at ' + address, 'success');
    await loadAirPurifiers();
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

const AIR_QUALITY_LEVELS = [
  { maxIaql: 3, label: 'GOOD', className: 'good' },
  { maxIaql: 6, label: 'MODERATE', className: 'moderate' },
  { maxIaql: 9, label: 'POOR', className: 'poor' }
];
const WORST_AIR_QUALITY = { label: 'VERY POOR', className: 'very-poor' };
const PERCENT_FULL = 100;
const FILTER_GOOD_PERCENT = 30;
const FILTER_WARNING_PERCENT = 10;
const DEFAULT_MODES = [
  { value: 'P', label: 'AUTO' },
  { value: 'S', label: 'SLEEP' },
  { value: 'T', label: 'TURBO' }
];
const DEFAULT_SPEEDS = ['s', '1', '2', 't'];
const SPEED_LABELS = { 's': 'SLEEP', '1': '1', '2': '2', '3': '3', 't': 'TURBO' };

function renderAirPurifierPanel(devices) {
  if (!devices || devices.length === 0) {
    return '';
  }

  return devices.map(function(device, index) { return renderAirPurifierDevice(device, index); }).join('');
}

function renderAirPurifierDevice(device, index) {
  const defaultName = device.device?.name || ('Purifier ' + (index + 1));
  const panelKey = 'airpurifier:' + index;
  const panel = {
    defaultName,
    panelKey,
    displayName: getPanelDisplayName(panelKey, defaultName)
  };

  if (!device.connected) {
    return renderOfflinePanel(panel, device.device?.ip, index);
  }

  if (device.pwr === undefined) {
    return renderPanelSection(panel, '', '<div class="loading">Connecting...</div>');
  }

  return renderActivePanel(panel, device, index);
}

function renderPanelSection(panel, headerControls, content) {
  return '<section class="panel" data-panel-key="' + panel.panelKey + '" data-default-name="' + panel.defaultName + '">' +
    '<div class="panel-header">' +
    '<i data-lucide="wind"></i>' +
    '<span class="panel-title">' + panel.displayName + '</span>' +
    headerControls +
    '</div>' +
    '<div class="panel-content">' +
    content +
    '</div>' +
    '</section>';
}

function renderOfflinePanel(panel, address, index) {
  return renderPanelSection(
    panel,
    '<span class="status-badge offline">OFFLINE</span>',
    '<p class="purifier-ip">' + (address || 'Unknown') + '</p>' +
    '<button class="btn btn-sm" onclick="connectPurifier(' + index + ')">CONNECT</button>'
  );
}

function renderActivePanel(panel, device, index) {
  const isOn = device.pwr === '1';
  const powerButton = '<button class="btn-icon ' + (isOn ? 'btn-stop' : 'btn-start') + '" onclick="togglePurifierPower(' + index + ')" title="' + (isOn ? 'Stop' : 'Start') + '">' +
    '<i data-lucide="' + (isOn ? 'square' : 'play') + '"></i>' +
    '</button>';
  const controls = { isOn, index };

  return renderPanelSection(
    panel,
    powerButton,
    '<div class="device-info">' +
    renderQualityRow(device.iaql ?? null) +
    renderModeRow(device, controls) +
    renderFanRow(device, controls) +
    renderFilterRows(device) +
    '</div>'
  );
}

function renderQualityRow(iaql) {
  const qualityClass = iaql === null ? '' : getAirQualityLevel(iaql).className;
  const qualityLabel = iaql === null ? '--' : getAirQualityLevel(iaql).label;

  return '<div class="info-row">' +
    '<span class="label">AIR QUALITY:</span>' +
    '<span class="status-badge ' + qualityClass + '">' + qualityLabel + '</span>' +
    '</div>';
}

function getAirQualityLevel(iaql) {
  return AIR_QUALITY_LEVELS.find(function(level) { return iaql <= level.maxIaql; }) || WORST_AIR_QUALITY;
}

function renderModeRow(device, controls) {
  const modes = device.capabilities?.modes || DEFAULT_MODES;

  return '<div class="info-row">' +
    '<span class="label">MODE:</span>' +
    '<select class="control-select" onchange="setPurifierMode(' + controls.index + ', this.value)" ' + (controls.isOn ? '' : 'disabled') + '>' +
    renderOptions(modes, device.mode || 'P') +
    '</select>' +
    '</div>';
}

function renderFanRow(device, controls) {
  const capabilities = device.capabilities || {};

  if (!hasManualMode(capabilities)) {
    return '';
  }

  const speeds = getSpeedOptions(capabilities);
  const isEnabled = controls.isOn && device.mode === 'M';

  return '<div class="info-row">' +
    '<span class="label">FAN:</span>' +
    '<select class="control-select" onchange="setPurifierFan(' + controls.index + ', this.value)" ' + (isEnabled ? '' : 'disabled') + '>' +
    renderOptions(speeds, device.om || '1') +
    '</select>' +
    '</div>';
}

function getSpeedOptions(capabilities) {
  return (capabilities.speeds || DEFAULT_SPEEDS).map(function(speed) {
    return { value: speed, label: SPEED_LABELS[speed] };
  });
}

function hasManualMode(capabilities) {
  const modes = capabilities.modes || DEFAULT_MODES;

  return capabilities.hasManualMode !== false && modes.some(function(mode) { return mode.value === 'M'; });
}

function renderOptions(options, selectedValue) {
  return options.map(function(option) {
    return '<option value="' + option.value + '" ' + (selectedValue === option.value ? 'selected' : '') + '>' + option.label + '</option>';
  }).join('');
}

function renderFilterRows(device) {
  const isCarbonVisible = device.flttotal2 > 0 && device.fltsts2 > 0;

  return renderFilterIf(device.flttotal0 > 0, { fltsts: device.fltsts0 || 0, flttotal: device.flttotal0, label: 'PRE-FILTER' }) +
    renderFilterIf(device.flttotal1 > 0, { fltsts: device.fltsts1 || 0, flttotal: device.flttotal1, label: 'HEPA' }) +
    renderFilterIf(isCarbonVisible, { fltsts: device.fltsts2, flttotal: device.flttotal2, label: 'CARBON' });
}

function renderFilterIf(isVisible, filter) {
  return isVisible ? renderFilterStatus(filter.fltsts, filter.flttotal, filter.label) : '';
}

function renderFilterStatus(fltsts, flttotal, label) {
  const percent = flttotal > 0 ? Math.round((fltsts / flttotal) * PERCENT_FULL) : 0;
  const statusClass = percent > FILTER_GOOD_PERCENT ? 'good' : percent > FILTER_WARNING_PERCENT ? 'warning' : 'critical';

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

function getFanLabel(speed) {
  if (speed === 's') {
    return 'SLEEP';
  }

  if (speed === 't') {
    return 'TURBO';
  }

  return 'SPEED ' + speed;
}
