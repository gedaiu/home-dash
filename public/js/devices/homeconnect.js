import { API } from '../api.js';
import { $, $$ } from '../utils.js';
import { log } from '../log.js';
import { showModal, hideModal } from '../modal.js';
import { attachEditableTitles } from '../panels.js';
import { renderHomeConnectPanel } from './homeconnect-panel.js';
import { discoverHomeConnect } from './homeconnect-modals.js';

export { discoverHomeConnect, configureHomeConnect, startHomeConnectAuth } from './homeconnect-modals.js';

let homeConnectDevices = [];

const NOT_CONFIGURED_SETUP = ['NOT CONFIGURED', 'offline', 'Click the search icon to set up Home Connect'];
const NEEDS_AUTH_SETUP = ['NEEDS AUTH', 'pending', 'Click the search icon to authenticate'];
const NO_APPLIANCES_SETUP = ['CONNECTED', 'online', 'No appliances found'];

export function getHomeConnectDevices() {
  return homeConnectDevices;
}

export async function loadHomeConnect() {
  clearHomeConnectPanels();

  try {
    const status = await API.homeconnect.status();
    const setupState = getSetupState(status);

    if (setupState) {
      showSetupPanel(setupState);

      return;
    }

    const devices = await API.homeconnect.devices();
    homeConnectDevices = devices;

    if (devices.length === 0) {
      showSetupPanel(NO_APPLIANCES_SETUP);

      return;
    }

    renderDevicePanels(devices);
  } catch (err) {
    showLoadError(err);
  }
}

export function updateHomeConnect(devices) {
  homeConnectDevices = devices;

  if (devices.length === 0) {
    return;
  }

  clearHomeConnectPanels();
  renderDevicePanels(devices);
}

export async function disconnectHomeConnect() {
  showModal('DISCONNECTING...', '<div class="loading">Disconnecting...</div>');

  try {
    await API.homeconnect.disconnect();
    hideModal();
    log('Home Connect disconnected', 'success');
    await loadHomeConnect();
  } catch (err) {
    showModal('ERROR', `<p class="error">${err.message}</p>`,
      '<button class="btn" onclick="hideModal()">CLOSE</button>');
  }
}

function getSetupState(status) {
  if (!status.configured) {
    return NOT_CONFIGURED_SETUP;
  }

  return status.authenticated ? null : NEEDS_AUTH_SETUP;
}

function showSetupPanel(setupState) {
  appendToDevicesRow(renderHomeConnectSetupPanel(...setupState));
  lucide.createIcons();
  $('#discover-homeconnect').addEventListener('click', discoverHomeConnect);
}

function renderDevicePanels(devices) {
  appendToDevicesRow(devices.map(device => renderHomeConnectPanel(device)).join(''));
  lucide.createIcons();
  attachHomeConnectRefreshHandlers();
  attachEditableTitles();
}

function showLoadError(err) {
  appendToDevicesRow(`
      <section class="panel">
        <div class="panel-header">
          <i data-lucide="washing-machine"></i>
          <span>HOME CONNECT</span>
        </div>
        <div class="panel-content">
          <div class="loading error">Error: ${err.message}</div>
        </div>
      </section>
    `);
  lucide.createIcons();
}

function clearHomeConnectPanels() {
  const existing = $$('.homeconnect-device-panel, #homeconnect-setup-panel');
  existing.forEach(element => element.remove());
}

function appendToDevicesRow(html) {
  const container = $('#devices-row');
  container.insertAdjacentHTML('beforeend', html);
}

function attachHomeConnectRefreshHandlers() {
  const buttons = $$('.refresh-homeconnect');
  buttons.forEach(btn => btn.addEventListener('click', refreshHomeConnect));
}

async function refreshHomeConnect() {
  const buttons = $$('.refresh-homeconnect');
  buttons.forEach(btn => btn.classList.add('spinning'));

  try {
    const devices = await API.homeconnect.refresh();
    updateHomeConnect(devices);
  } catch (err) {
    console.error('Home Connect refresh error:', err.message);
  } finally {
    const updatedButtons = $$('.refresh-homeconnect');
    updatedButtons.forEach(btn => btn.classList.remove('spinning'));
  }
}

function renderHomeConnectSetupPanel(statusText, statusClass, message) {
  return `
    <section class="panel" id="homeconnect-setup-panel">
      <div class="panel-header">
        <i data-lucide="washing-machine"></i>
        <span>HOME CONNECT</span>
        <button class="btn-icon" id="discover-homeconnect" title="Configure">
          <i data-lucide="search"></i>
        </button>
      </div>
      <div class="panel-content">
        <div class="device-info">
          <div class="info-row">
            <span class="label">STATUS:</span>
            <span class="status-badge ${statusClass}">${statusText}</span>
          </div>
          <p style="margin-top: 12px; color: var(--text-dim)">${message}</p>
        </div>
      </div>
    </section>
  `;
}
