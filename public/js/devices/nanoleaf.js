import { API } from '../api.js';
import { $ } from '../utils.js';
import { log } from '../log.js';
import { showModal, hideModal } from '../modal.js';

export let nanoleafDevice = null;
export let nanoleafConfig = null;

export function setNanoleafDevice(device) {
  nanoleafDevice = device;
}

export function setNanoleafConfig(config) {
  nanoleafConfig = config;
}

export async function loadNanoleaf() {
  const content = $('#nanoleaf-content');

  try {
    const device = await API.nanoleaf.device();

    content.innerHTML = device.configured ? renderNanoleafInfo(device) : renderNotConfigured();
  } catch (err) {
    content.innerHTML = `<div class="loading error">Error: ${err.message}</div>`;
  }
}

function renderNotConfigured() {
  return `
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
}

function renderNanoleafInfo(device) {
  const colorStyle = device.state.on
    ? `background-color: hsl(${device.state.hue}, ${device.state.sat}%, 50%)`
    : 'background-color: #333';
  const statusBadge = `<span class="status-badge ${device.state.on ? 'online' : 'offline'}">
            ${device.state.on ? 'ON' : 'OFF'}
          </span>`;
  const colorValue = `<span class="color-preview" style="${colorStyle}"></span>
            BRI: ${device.state.brightness}%`;

  return `
      <div class="device-info">
        ${renderInfoRow('STATUS', statusBadge)}
        ${renderInfoRow('NAME', renderValue(device.name))}
        ${renderInfoRow('MODEL', renderValue(device.model))}
        ${renderInfoRow('PANELS', renderValue(device.panelCount))}
        ${renderInfoRow('EFFECT', renderValue(device.effects.current || 'None'))}
        ${renderInfoRow('COLOR', renderValue(colorValue))}
      </div>
    `;
}

function renderInfoRow(label, valueMarkup) {
  return `<div class="info-row">
          <span class="label">${label}:</span>
          ${valueMarkup}
        </div>`;
}

function renderValue(content) {
  return `<span class="value">${content}</span>`;
}

export function getNanoleafColor(state) {
  if (!state.on) {
    return '#333';
  }

  if (state.hue !== undefined && state.sat !== undefined) {
    return `hsl(${state.hue}, ${state.sat}%, 50%)`;
  }

  return '#fff';
}

export function renderNanoleafItem() {
  if (!nanoleafDevice || !nanoleafConfig) {
    return '';
  }

  const isOn = nanoleafDevice.state.on;

  return renderNanoleafMarkup(nanoleafDevice, isOn);
}

function renderNanoleafMarkup(device, isOn) {
  const color = isOn ? getNanoleafColor(device.state) : '#333';
  const stateText = isOn ? `${device.state.brightness}%` : 'OFF';

  return `
    <div class="light-item nanoleaf-item ${isOn ? '' : 'off'}"
         data-id="nanoleaf"
         data-name="${device.name}"
         data-category="nanoleaf">
      <i data-lucide="triangle" class="device-icon ${isOn ? 'on' : ''}"></i>
      <span class="light-indicator ${isOn ? 'on' : ''}"
            style="background-color: ${color}"></span>
      <span class="light-name">${device.name}</span>
      <span class="light-state">${stateText}</span>
    </div>
  `;
}

export async function discoverNanoleaf() {
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
        ${devices.map(device => `
          <div class="device-item" onclick="pairNanoleaf('${device.ip}', ${device.port})">
            <i data-lucide="triangle"></i>
            <span class="name">${device.name}</span>
            <span class="ip">${device.ip}:${device.port}</span>
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

export async function pairNanoleaf(address, port) {
  showModal('PAIRING NANOLEAF', `
    <div class="pairing-instructions">
      <i data-lucide="hand"></i>
      <p>Hold the <span class="highlight">power button</span> on your Nanoleaf for 5-7 seconds</p>
      <p>Wait until the LED starts flashing, then click PAIR</p>
    </div>
  `, `
    <button class="btn" onclick="hideModal()">CANCEL</button>
    <button class="btn btn-start" onclick="confirmPairNanoleaf('${address}', ${port})">PAIR</button>
  `);
  lucide.createIcons();
}

export async function confirmPairNanoleaf(address, port) {
  showModal('PAIRING...', '<div class="loading">Connecting to Nanoleaf...</div>');

  try {
    const result = await API.nanoleaf.pair(address, port);

    if (!result.success) {
      showPairingFailed(result.error, address, port);

      return;
    }

    hideModal();
    log('Nanoleaf paired successfully!', 'success');
    await loadNanoleaf();
  } catch (err) {
    showModal('ERROR', `<p class="error">${err.message}</p>`,
      '<button class="btn" onclick="hideModal()">CLOSE</button>');
  }
}

function showPairingFailed(errorMessage, address, port) {
  showModal('PAIRING FAILED', `
        <p class="error">${errorMessage}</p>
        <p style="margin-top: 12px">Make sure you held the power button until the LED flashed.</p>
      `, `
        <button class="btn" onclick="hideModal()">CANCEL</button>
        <button class="btn btn-start" onclick="pairNanoleaf('${address}', ${port})">RETRY</button>
      `);
}
