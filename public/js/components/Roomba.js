import { html } from 'https://esm.sh/htm@3.1.1/preact';
import { useState, useEffect } from 'https://esm.sh/preact@10.19.3/hooks';
import { effect } from 'https://esm.sh/@preact/signals@1.2.1';
import { roombaState, addLog } from '../state.js';
import { Panel, StatusBadge } from './Panel.js';
import { renderRoombaDetails } from './RoombaDetails.js';
import { API } from '../api.js';

const PHASE_DISPLAY = {
  charging: { label: 'CHARGING', class: 'online' },
  cleaning: { label: 'CLEANING', class: 'online' },
  stuck: { label: 'STUCK', class: 'error' },
  stopped: { label: 'STOPPED', class: 'offline' },
  paused: { label: 'PAUSED', class: 'pending' },
  returning: { label: 'RETURNING', class: 'pending' },
  docking: { label: 'DOCKING', class: 'pending' },
  emptying: { label: 'EMPTYING', class: 'online' },
  error: { label: 'ERROR', class: 'error' },
  cancelled: { label: 'CANCELLED', class: 'offline' }
};
const ACTIVE_PHASES = ['cleaning', 'returning', 'docking', 'emptying'];
const BATTERY_ICONS = { full: 'battery-full', medium: 'battery-medium', low: 'battery-low' };
const ROOMBA_COMMANDS = {
  start: { done: 'Roomba started cleaning', failure: 'Failed to start Roomba' },
  pause: { done: 'Roomba paused', failure: 'Failed to pause Roomba' },
  resume: { done: 'Roomba resumed', failure: 'Failed to resume Roomba' },
  dock: { done: 'Roomba returning to dock', failure: 'Failed to dock Roomba' }
};

function roomba() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [detailsExpanded, setDetailsExpanded] = useState(false);

  useEffect(() => {
    loadStatus(setLoading);

    const dispose = effect(() => {
      setStatus(roombaState.value);
    });

    return dispose;
  }, []);

  if (loading) {
    return renderRoombaPanel(html`<div class="loading">Connecting...</div>`);
  }

  if (!status || !status.configured) {
    return renderRoombaPanel(renderNotConfigured());
  }

  if (!status.connected) {
    return renderRoombaPanel(renderOffline(status));
  }

  return renderConnected({ status, detailsExpanded, setDetailsExpanded });
}

async function loadStatus(setLoading) {
  const roombaApi = API.roomba;

  try {
    roombaState.value = await roombaApi.status();
  } catch (err) {
    console.error('Failed to load Roomba:', err);
  }

  setLoading(false);
}

function renderRoombaPanel(content, controls) {
  return html`
    <${Panel} panelKey="roomba" defaultName="ROOMBA" icon="bot" controls=${controls}>
      ${content}
    <//>
  `;
}

function renderNotConfigured() {
  return html`
    <div class="device-info">
      <div class="info-row">
        <span class="label">STATUS:</span>
        <${StatusBadge} status="NOT CONFIGURED" className="offline" />
      </div>
      <p style="margin-top: 12px; color: var(--text-dim)">
        Configure Roomba in network-config.json
      </p>
    </div>
  `;
}

function renderOffline(status) {
  return html`
    <div class="device-info">
      <div class="info-row">
        <span class="label">STATUS:</span>
        <${StatusBadge} status="OFFLINE" className="offline" />
      </div>
      <div class="info-row">
        <span class="label">NAME:</span>
        <span class="value">${status.name || 'Roomba'}</span>
      </div>
      ${status.error ? html`<p style="margin-top: 12px; color: var(--text-dim)">${status.error}</p>` : null}
    </div>
  `;
}

function renderConnected({ status, detailsExpanded, setDetailsExpanded }) {
  const controls = html`
    <div class="header-controls">
      ${selectControlButtons(status.mission?.phase)}
      <button class="btn-icon ${detailsExpanded ? 'active' : ''}" onClick=${() => setDetailsExpanded(!detailsExpanded)} title="Details">
        <i data-lucide="info"></i>
      </button>
    </div>
  `;

  const content = html`
    <div class="device-info">
      ${renderSummary(status)}
      ${renderRoombaDetails(status, detailsExpanded)}
    </div>
  `;

  return renderRoombaPanel(content, controls);
}

function selectControlButtons(phase) {
  if (ACTIVE_PHASES.includes(phase)) {
    return html`${renderControlButton('pause', 'Pause', 'pause')}${renderControlButton('dock', 'Dock', 'home')}`;
  }

  if (phase === 'paused') {
    return html`${renderControlButton('resume', 'Resume', 'play')}${renderControlButton('dock', 'Dock', 'home')}`;
  }

  if (phase === 'charging' || phase === 'stopped') {
    return renderControlButton('start', 'Start Cleaning', 'play');
  }

  return null;
}

function renderControlButton(commandName, title, icon) {
  return html`
    <button class="btn-icon" onClick=${() => sendRoombaCommand(commandName)} title=${title}>
      <i data-lucide=${icon}></i>
    </button>
  `;
}

async function sendRoombaCommand(commandName) {
  const roombaApi = API.roomba;
  const { done, failure } = ROOMBA_COMMANDS[commandName];

  try {
    await roombaApi[commandName]();
    addLog(done, 'success');
  } catch (err) {
    addLog(`${failure}: ${err.message}`, 'error');
  }
}

function renderSummary(status) {
  const phaseDisplay = getPhaseDisplay(status.mission?.phase);

  return html`
    <div class="info-row">
      <span class="label">STATUS:</span>
      <${StatusBadge} status=${phaseDisplay.label} className=${phaseDisplay.class} />
    </div>
    <div class="info-row">
      <span class="label">NAME:</span>
      <span class="value">${status.name}</span>
    </div>
    ${renderBatteryRow(status.battery)}
    ${status.bin ? renderBin(status.bin) : null}
  `;
}

function renderBatteryRow(battery) {
  const batteryIcon = BATTERY_ICONS[battery?.level] || 'battery';
  const batteryPercent = battery?.percent ?? '--';

  return html`
    <div class="info-row">
      <span class="label">BATTERY:</span>
      <span class="value">
        ${batteryPercent}%
        <i data-lucide=${batteryIcon} style="width: 14px; height: 14px; margin-left: 4px;"></i>
      </span>
    </div>
  `;
}

function getPhaseDisplay(phase) {
  return PHASE_DISPLAY[phase] || { label: phase?.toUpperCase() || 'UNKNOWN', class: 'offline' };
}

function renderBin(bin) {
  return html`
    <div class="info-row">
      <span class="label">BIN:</span>
      <${StatusBadge} status=${bin.full ? 'FULL' : 'OK'} className=${bin.full ? 'warning' : 'online'} />
    </div>
  `;
}

export { roomba as Roomba };
