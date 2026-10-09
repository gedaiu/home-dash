import { API } from '../api.js';
import { $ } from '../utils.js';
import { log } from '../log.js';
import { getPanelDisplayName, attachEditableTitles } from '../panels.js';

let roombaDetailsExpanded = false;

const ACTIVE_PHASES = ['cleaning', 'returning', 'docking', 'emptying'];
const IDLE_PHASES = ['charging', 'stopped'];
const NOT_CONFIGURED_MARKUP = `
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
const DOCK_BUTTON = `
      <button class="btn-icon" onclick="dockRoomba()" title="Dock">
        <i data-lucide="home"></i>
      </button>
    `;
const PAUSE_BUTTON = `
      <button class="btn-icon" onclick="pauseRoomba()" title="Pause">
        <i data-lucide="pause"></i>
      </button>
      `;
const RESUME_BUTTON = `
      <button class="btn-icon" onclick="resumeRoomba()" title="Resume">
        <i data-lucide="play"></i>
      </button>
      `;
const START_BUTTON = `
      <button class="btn-icon" onclick="startRoomba()" title="Start Cleaning">
        <i data-lucide="play"></i>
      </button>
    `;
const PHASE_DISPLAYS = {
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
const BATTERY_ICONS = {
  'full': 'battery-full',
  'medium': 'battery-medium',
  'low': 'battery-low'
};
const SETTING_LABELS = [
  ['carpetBoost', 'Carpet Boost'],
  ['vacHigh', 'High Vacuum'],
  ['twoPass', 'Two Pass'],
  ['binPause', 'Bin Pause'],
  ['ecoCharge', 'Eco Charge']
];

export function toggleRoombaDetails() {
  roombaDetailsExpanded = !roombaDetailsExpanded;
  const details = document.querySelector('.roomba-details');
  const button = document.querySelector('#roomba-controls .btn-icon[title="Details"]');

  if (details) {
    details.classList.toggle('expanded', roombaDetailsExpanded);
  }

  if (button) {
    button.classList.toggle('active', roombaDetailsExpanded);
  }
}

export async function loadRoomba() {
  const content = $('#roomba-content');
  const controls = $('#roomba-controls');

  try {
    const status = await API.roomba.status();
    renderRoombaView(status);
  } catch (err) {
    content.innerHTML = `<div class="loading error">Error: ${err.message}</div>`;
    controls.innerHTML = '';
  }
}

export function updateRoomba(status) {
  renderRoombaView({ configured: true, ...status });
}

export async function startRoomba() {
  try {
    await API.roomba.start();
    log('Roomba started cleaning', 'success');
  } catch (err) {
    log(`Failed to start Roomba: ${err.message}`, 'error');
  }
}

export async function pauseRoomba() {
  try {
    await API.roomba.pause();
    log('Roomba paused', 'success');
  } catch (err) {
    log(`Failed to pause Roomba: ${err.message}`, 'error');
  }
}

export async function resumeRoomba() {
  try {
    await API.roomba.resume();
    log('Roomba resumed', 'success');
  } catch (err) {
    log(`Failed to resume Roomba: ${err.message}`, 'error');
  }
}

export async function dockRoomba() {
  try {
    await API.roomba.dock();
    log('Roomba returning to dock', 'success');
  } catch (err) {
    log(`Failed to dock Roomba: ${err.message}`, 'error');
  }
}

function renderRoombaView(status) {
  const panel = $('#roomba-panel');
  $('#roomba-content').innerHTML = renderRoombaPanel(status);
  $('#roomba-controls').innerHTML = renderRoombaHeaderControls(status);

  const titleElement = panel.querySelector('.panel-title');

  if (titleElement) {
    titleElement.textContent = getPanelDisplayName('roomba', 'ROOMBA');
  }

  lucide.createIcons();
  attachEditableTitles();
}

function renderRoombaHeaderControls(status) {
  if (!isRoombaOnline(status)) {
    return '';
  }

  return `
    ${getControlButtons(status.mission?.phase)}
    <button class="btn-icon ${getFlagClass('active')}" onclick="toggleRoombaDetails()" title="Details">
      <i data-lucide="info"></i>
    </button>
  `;
}

function isRoombaOnline(status) {
  return Boolean(status?.configured && status?.connected);
}

function getFlagClass(className) {
  return roombaDetailsExpanded ? className : '';
}

function getControlButtons(phase) {
  if (ACTIVE_PHASES.includes(phase)) {
    return PAUSE_BUTTON + DOCK_BUTTON;
  }

  if (phase === 'paused') {
    return RESUME_BUTTON + DOCK_BUTTON;
  }

  return IDLE_PHASES.includes(phase) ? START_BUTTON : '';
}

function renderRoombaPanel(status) {
  if (!status || !status.configured) {
    return NOT_CONFIGURED_MARKUP;
  }

  if (!status.connected) {
    return renderOfflineRoomba(status);
  }

  return renderConnectedRoomba(status);
}

function renderOfflineRoomba(status) {
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

function renderConnectedRoomba(status) {
  const phaseDisplay = getRoombaPhaseDisplay(status.mission?.phase);

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
        ${renderBattery(status.battery)}
      </div>
      ${renderBin(status.bin)}
      <div class="roomba-details ${getFlagClass('expanded')}">
        ${renderLifetime(status.lifetime)}
        ${renderSettings(status.settings)}
        ${renderLastCommand(status.lastCommand)}
        ${renderDeviceInfo(status.deviceInfo)}
      </div>
    </div>
  `;
}

function renderBattery(battery) {
  const batteryIcon = BATTERY_ICONS[battery?.level] || 'battery';

  return `<span class="value">
          ${battery?.percent ?? '--'}%
          <i data-lucide="${batteryIcon}" style="width: 14px; height: 14px; margin-left: 4px;"></i>
        </span>`;
}

function getRoombaPhaseDisplay(phase) {
  return PHASE_DISPLAYS[phase] || { label: phase?.toUpperCase() || 'UNKNOWN', class: 'offline' };
}

function renderBin(bin) {
  if (!bin) {
    return '';
  }

  const binClass = bin.full ? 'warning' : 'online';
  const binStatus = bin.full ? 'FULL' : 'OK';

  return renderInfoRow('BIN', `<span class="status-badge ${binClass}">${binStatus}</span>`);
}

function renderLifetime(lifetime) {
  if (!lifetime) {
    return '';
  }

  const totalTime = lifetime.totalHours > 0
    ? `${lifetime.totalHours}h ${lifetime.totalMinutes}m`
    : `${lifetime.totalMinutes}m`;

  return renderSection('LIFETIME STATS',
    renderInfoRow('TOTAL TIME', renderValue(totalTime)) +
    renderInfoRow('MISSIONS', renderValue(`${lifetime.totalMissions} (${lifetime.successRate}% success)`)) +
    renderInfoRow('AVG MISSION', renderValue(`${lifetime.avgMissionMinutes} min`)));
}

function renderSettings(settings) {
  if (!settings) {
    return '';
  }

  const activeSettings = SETTING_LABELS
    .filter(([key]) => settings[key])
    .map(([, label]) => label);

  return renderSection('SETTINGS',
    renderInfoRow('ACTIVE', renderValue(activeSettings.length > 0 ? activeSettings.join(', ') : 'Default')));
}

function renderLastCommand(lastCommand) {
  if (!lastCommand?.command) {
    return '';
  }

  const commandTime = lastCommand.time
    ? new Date(lastCommand.time).toLocaleString()
    : 'Unknown';

  return renderSection('LAST ACTIVITY',
    renderInfoRow('COMMAND', renderValue(`${lastCommand.command} (${lastCommand.initiator})`)) +
    renderInfoRow('TIME', renderValue(commandTime)));
}

function renderDeviceInfo(deviceInfo) {
  if (!deviceInfo?.sku) {
    return '';
  }

  return renderSection('DEVICE INFO',
    renderInfoRow('MODEL', renderValue(deviceInfo.sku)) +
    renderInfoRow('FIRMWARE', renderValue(deviceInfo.softwareVer || 'Unknown')));
}

function renderInfoRow(label, valueMarkup) {
  return `
        <div class="info-row">
          <span class="label">${label}:</span>
          ${valueMarkup}
        </div>`;
}

function renderValue(content) {
  return `<span class="value">${content}</span>`;
}

function renderSection(title, rows) {
  return `
      <div class="roomba-section">
        <div class="section-title">${title}</div>${rows}
      </div>
    `;
}
