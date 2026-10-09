import { html } from 'https://esm.sh/htm@3.1.1/preact';
import { useState, useEffect } from 'https://esm.sh/preact@10.19.3/hooks';
import { effect } from 'https://esm.sh/@preact/signals@1.2.1';
import { airPurifierState, addLog } from '../state.js';
import { Panel, StatusBadge } from './Panel.js';
import { API } from '../api.js';

const AIR_QUALITY_LEVELS = [
  { max: 3, label: 'GOOD', className: 'good' },
  { max: 6, label: 'MODERATE', className: 'moderate' },
  { max: 9, label: 'POOR', className: 'poor' }
];
const AIR_QUALITY_WORST = { label: 'VERY POOR', className: 'very-poor' };
const AIR_QUALITY_UNKNOWN = { label: '--', className: '' };
const MODE_LABELS = { 'M': 'MANUAL', 'P': 'AUTO', 'AG': 'ALLERGEN', 'GT': 'GENTLE', 'T': 'TURBO', 'S': 'SLEEP' };
const SPEED_LABELS = { 's': 'SLEEP', '1': '1', '2': '2', '3': '3', 't': 'TURBO' };
const DEFAULT_MODES = [
  { value: 'P', label: 'AUTO' },
  { value: 'S', label: 'SLEEP' },
  { value: 'T', label: 'TURBO' }
];
const DEFAULT_SPEEDS = ['s', '1', '2', 't'];
const PERCENT_SCALE = 100;
const FILTER_GOOD_PERCENT = 30;
const FILTER_WARNING_PERCENT = 10;

function airPurifiers() {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDevices(setLoading);

    const dispose = effect(() => {
      setDevices(airPurifierState.value || []);
    });

    return dispose;
  }, []);

  if (loading) {
    return null;
  }

  if (!devices || devices.length === 0) {
    return null;
  }

  return html`
    ${devices.map((device, index) => html`
      <${airPurifierDevice} key=${index} device=${device} index=${index} />
    `)}
  `;
}

async function loadDevices(setLoading) {
  const airPurifierApi = API.airpurifier;

  try {
    const loadedDevices = await airPurifierApi.devices();
    airPurifierState.value = loadedDevices || [];
  } catch (err) {
    console.error('Failed to load air purifiers:', err);
  }

  setLoading(false);
}

function airPurifierDevice({ device, index }) {
  const defaultName = device.device?.name || `Purifier ${index + 1}`;
  const panelKey = `airpurifier:${index}`;

  if (!device.connected) {
    return renderOffline({ panelKey, defaultName, device });
  }

  if (device.pwr === undefined) {
    return html`
      <${Panel} panelKey=${panelKey} defaultName=${defaultName} icon="wind">
        <div class="loading">Connecting...</div>
      <//>
    `;
  }

  return renderActivePurifier({ panelKey, defaultName, device, index });
}

function renderOffline({ panelKey, defaultName, device }) {
  return html`
    <${Panel} panelKey=${panelKey} defaultName=${defaultName} icon="wind">
      <div class="device-info">
        <div class="info-row">
          <span class="label">STATUS:</span>
          <${StatusBadge} status="OFFLINE" className="offline" />
        </div>
        <p class="purifier-ip">${device.device?.ip || 'Unknown'}</p>
      </div>
    <//>
  `;
}

function renderActivePurifier({ panelKey, defaultName, device, index }) {
  const isOn = device.pwr === '1';
  const controls = html`
    <button class="btn-icon ${isOn ? 'btn-stop' : 'btn-start'}" onClick=${() => togglePower(device, index)} title=${isOn ? 'Stop' : 'Start'}>
      <i data-lucide=${isOn ? 'square' : 'play'}></i>
    </button>
  `;

  return html`
    <${Panel} panelKey=${panelKey} defaultName=${defaultName} icon="wind" controls=${controls}>
      <div class="device-info">
        ${renderAirQualityRow(device.iaql ?? null)}
        ${renderModeRow(device, index, isOn)}
        ${renderFanRow(device, index, isOn)}
        ${renderFilterRows(device)}
      </div>
    <//>
  `;
}

function renderFilterRows(device) {
  return html`
    ${renderFilterRow(device.fltsts0 || 0, device.flttotal0, 'PRE-FILTER')}
    ${renderFilterRow(device.fltsts1 || 0, device.flttotal1, 'HEPA')}
    ${device.fltsts2 > 0 ? renderFilterRow(device.fltsts2, device.flttotal2, 'CARBON') : null}
  `;
}

async function togglePower(device, index) {
  try {
    const isOn = device.pwr === '1';
    await API.airpurifier.power(index, !isOn);
    addLog(`Purifier ${index + 1} turned ${isOn ? 'off' : 'on'}`, 'success');
  } catch (err) {
    addLog(`Failed to toggle purifier: ${err.message}`, 'error');
  }
}

function renderAirQualityRow(iaql) {
  const level = iaql === null ? AIR_QUALITY_UNKNOWN : getAirQualityLevel(iaql);

  return html`
    <div class="info-row">
      <span class="label">AIR QUALITY:</span>
      <${StatusBadge} status=${level.label} className=${level.className} />
    </div>
  `;
}

function getAirQualityLevel(iaql) {
  return AIR_QUALITY_LEVELS.find((level) => iaql <= level.max) || AIR_QUALITY_WORST;
}

function renderModeRow(device, index, isOn) {
  const mode = device.mode || 'P';
  const { availableModes } = resolveCapabilities(device);

  return html`
    <div class="info-row">
      <span class="label">MODE:</span>
      <select class="control-select" onChange=${(event) => setMode(event, index)} disabled=${!isOn}>
        ${availableModes.map(option => html`
          <option value=${option.value} selected=${mode === option.value}>${option.label}</option>
        `)}
      </select>
    </div>
  `;
}

async function setMode(event, index) {
  try {
    const mode = event.target.value;
    await API.airpurifier.mode(index, mode);
    addLog(`Purifier ${index + 1} mode set to ${MODE_LABELS[mode] || mode}`, 'success');
  } catch (err) {
    addLog(`Failed to set mode: ${err.message}`, 'error');
  }
}

function renderFanRow(device, index, isOn) {
  const { availableSpeeds, hasManualMode } = resolveCapabilities(device);

  if (!hasManualMode) {
    return null;
  }

  const currentSpeed = device.om || '1';
  const isManual = (device.mode || 'P') === 'M';

  return html`
    <div class="info-row">
      <span class="label">FAN:</span>
      <select class="control-select" onChange=${(event) => setFan(event, index)} disabled=${!isOn || !isManual}>
        ${availableSpeeds.map(speed => html`
          <option value=${speed} selected=${currentSpeed === speed}>${SPEED_LABELS[speed] || speed}</option>
        `)}
      </select>
    </div>
  `;
}

async function setFan(event, index) {
  try {
    const speed = event.target.value;
    await API.airpurifier.fan(index, speed);
    addLog(`Purifier ${index + 1} fan set to ${speed}`, 'success');
  } catch (err) {
    addLog(`Failed to set fan speed: ${err.message}`, 'error');
  }
}

function resolveCapabilities(device) {
  const capabilities = device.capabilities || {};
  const availableModes = capabilities.modes || DEFAULT_MODES;
  const availableSpeeds = capabilities.speeds || DEFAULT_SPEEDS;
  const hasManualMode = capabilities.hasManualMode !== false && availableModes.some(option => option.value === 'M');

  return { availableModes, availableSpeeds, hasManualMode };
}

function renderFilterRow(current, total, label) {
  return total > 0 ? html`<${filterBar} current=${current} total=${total} label=${label} />` : null;
}

function filterBar({ current, total, label }) {
  const percent = total > 0 ? Math.round((current / total) * PERCENT_SCALE) : 0;
  const statusClass = getFilterStatusClass(percent);

  return html`
    <div class="info-row">
      <span class="label">${label}:</span>
      <span class="value filter-value">
        <div class="filter-bar">
          <div class="filter-fill ${statusClass}" style="width: ${percent}%"></div>
        </div>
        <span class="filter-percent">${percent}%</span>
      </span>
    </div>
  `;
}

function getFilterStatusClass(percent) {
  if (percent > FILTER_GOOD_PERCENT) {
    return 'good';
  }

  return percent > FILTER_WARNING_PERCENT ? 'warning' : 'critical';
}

export { airPurifiers as AirPurifiers };
