import { html } from 'https://esm.sh/htm@3.1.1/preact';

const DISPLAY_MODES = [
  { value: 'orgs', label: 'Orgs' },
  { value: 'hosts', label: 'Hosts' },
  { value: 'ips', label: 'IPs' }
];

export function networkControls({ displayMode, showIdleDevices, onDisplayModeChange, onIdleToggle }) {
  return html`
    <div class="network-controls">
      <select
        class="control-select"
        value=${displayMode}
        onChange=${(event) => onDisplayModeChange(event.target.value)}
      >
        ${DISPLAY_MODES.map(mode => html`
          <option value=${mode.value}>${mode.label}</option>
        `)}
      </select>
      <button
        class="control-btn ${showIdleDevices ? 'active' : ''}"
        onClick=${onIdleToggle}
        title="${showIdleDevices ? 'Hide' : 'Show'} idle devices"
      >
        <i data-lucide="${showIdleDevices ? 'eye' : 'eye-off'}"></i>
        <span>Idle</span>
      </button>
    </div>
  `;
}

export function routerPanel(router) {
  return html`
    <section class="panel router-panel">
      <div class="panel-header">
        <i data-lucide="server"></i>
        <span>${router.name || router.id}</span>
        <span class="router-status ${router.online ? 'online' : 'offline'}">
          ${router.online ? 'Online' : 'Offline'}
        </span>
      </div>
      <div class="panel-content">
        ${routerInfoGrid(router)}
        ${routerStats(router)}
      </div>
    </section>
  `;
}

function routerInfoGrid(router) {
  return html`
    <div class="info-grid">
      <div class="info-row">
        <span class="label">IP</span>
        <span class="value">${router.ip || '--'}</span>
      </div>
      <div class="info-row">
        <span class="label">Role</span>
        <span class="value">${router.role || '--'}</span>
      </div>
    </div>
  `;
}

function routerStats(router) {
  return html`
    <div class="router-stats">
      <div class="stat">
        <span class="stat-label">CPU</span>
        <span class="stat-value">${formatReading(router.cpu)}%</span>
      </div>
      <div class="stat">
        <span class="stat-label">MEM</span>
        <span class="stat-value">${formatReading(router.memory)}%</span>
      </div>
      <div class="stat">
        <span class="stat-label">TEMP</span>
        <span class="stat-value">${formatReading(router.temp)}C</span>
      </div>
    </div>
  `;
}

function formatReading(reading) {
  return reading == null ? '--' : reading.toFixed(1);
}
