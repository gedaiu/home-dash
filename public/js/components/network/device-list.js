import { html } from 'https://esm.sh/htm@3.1.1/preact';
import { selectedDeviceMac, getDeviceColor, getDeviceIcon, isDeviceVerified, getDeviceDisplayName } from '../../state.js';
import { formatBytes } from './format.js';

const REMOTE_COUNTRY_COLOR = '#ff8c00';
const REMOTE_UNKNOWN_COLOR = '#666';

export function devicesPanel({ devices, remoteDestinations, viewMode, selectedMac, onViewToggle }) {
  const isLocal = viewMode === 'local';

  return html`
    <section class="panel devices-panel">
      <div class="panel-header">
        <i data-lucide="${isLocal ? 'smartphone' : 'globe'}"></i>
        <span>${isLocal
          ? `DEVICES (${devices.filter(device => device.online).length}/${devices.length})`
          : `DESTINATIONS (${remoteDestinations.length})`
        }</span>
        <button
          class="view-toggle-btn"
          onClick=${onViewToggle}
          title=${isLocal ? 'Show remote destinations' : 'Show local devices'}
        >
          ${isLocal ? 'Remote' : 'Local'}
        </button>
      </div>
      <div class="panel-content device-list-panel">
        ${isLocal ? localDeviceRows(devices, selectedMac) : remoteDestinationRows(remoteDestinations)}
      </div>
    </section>
  `;
}

function localDeviceRows(devices, selectedMac) {
  return html`
    ${devices.length === 0 && html`
      <div class="loading">No devices detected yet...</div>
    `}
    ${devices.map(device => deviceRow(device, selectedMac))}
  `;
}

function deviceRow(device, selectedMac) {
  const { mac, hostname } = device;
  const isVerified = isDeviceVerified(mac, hostname);

  return html`
    <div
      class="device-row ${device.online ? 'online' : 'offline'} ${selectedMac === mac ? 'selected' : ''} ${isVerified ? 'verified' : ''}"
      onClick=${() => toggleDeviceSelection(device)}
    >
      <span class="device-indicator" style="background: ${getDeviceColor(mac, hostname)}">
        <i data-lucide="${getDeviceIcon(mac, hostname)}"></i>
      </span>
      <span class="device-name">
        <span class="device-name-text">${getDeviceDisplayName(mac, hostname, hostname || mac)}</span>
        ${isVerified && html`<i data-lucide="badge-check" class="verified-icon"></i>`}
      </span>
      <span class="device-ip">${device.ip}</span>
    </div>
  `;
}

function toggleDeviceSelection(device) {
  selectedDeviceMac.value = selectedDeviceMac.value === device.mac ? null : device.mac;
}

function remoteDestinationRows(remoteDestinations) {
  return html`
    ${remoteDestinations.length === 0 && html`
      <div class="loading">No remote connections yet...</div>
    `}
    ${remoteDestinations.map(destination => remoteDestinationRow(destination))}
  `;
}

function remoteDestinationRow(destination) {
  const indicatorColor = destination.country ? REMOTE_COUNTRY_COLOR : REMOTE_UNKNOWN_COLOR;

  return html`
    <div class="device-row remote-dest online">
      <span class="device-indicator" style="background: ${indicatorColor}"></span>
      <div class="remote-dest-info">
        <span class="device-name">
          ${destination.country ? `[${destination.country}] ` : ''}${destination.hostname || destination.ipAddress}
        </span>
        <span class="remote-dest-org">${destination.org || ''}</span>
      </div>
      <span class="remote-dest-traffic">${formatBytes(destination.bytes)}</span>
    </div>
  `;
}
