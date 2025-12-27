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

export async function pairNanoleaf(ip, port) {
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

export async function confirmPairNanoleaf(ip, port) {
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
