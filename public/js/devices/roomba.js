import { API } from '../api.js';
import { $ } from '../utils.js';
import { log } from '../log.js';
import { getPanelDisplayName, attachEditableTitles } from '../panels.js';

let roombaStatus = null;
let roombaDetailsExpanded = false;

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

export function toggleRoombaDetails() {
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

export async function loadRoomba() {
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

export function updateRoomba(status) {
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
