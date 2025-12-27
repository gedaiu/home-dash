import { API } from '../api.js';
import { $, $$ } from '../utils.js';
import { log } from '../log.js';
import { showModal, hideModal } from '../modal.js';
import { formatRemainingTime } from '../utils.js';
import { getPanelDisplayName, attachEditableTitles } from '../panels.js';

let homeConnectDevices = [];

export function getHomeConnectDevices() {
  return homeConnectDevices;
}

function getOperationStateDisplay(state) {
  const displays = {
    'inactive': { label: 'IDLE', class: 'offline' },
    'ready': { label: 'READY', class: 'ready' },
    'delayed': { label: 'DELAYED', class: 'pending' },
    'running': { label: 'RUNNING', class: 'online' },
    'paused': { label: 'PAUSED', class: 'pending' },
    'action_required': { label: 'ACTION', class: 'warning' },
    'finished': { label: 'DONE', class: 'success' },
    'error': { label: 'ERROR', class: 'error' },
    'aborting': { label: 'STOPPING', class: 'pending' }
  };
  return displays[state] || { label: state?.toUpperCase() || 'UNKNOWN', class: 'offline' };
}

function getApplianceIcon(type) {
  const icons = {
    'Dishwasher': 'washing-machine',
    'Washer': 'washing-machine',
    'Dryer': 'wind',
    'WasherDryer': 'washing-machine',
    'Oven': 'flame',
    'CoffeeMaker': 'coffee',
    'Refrigerator': 'thermometer-snowflake',
    'Freezer': 'snowflake',
    'FridgeFreezer': 'thermometer-snowflake',
    'Hood': 'wind',
    'Cooktop': 'flame',
    'CleaningRobot': 'bot'
  };
  return icons[type] || 'cpu';
}

function renderHomeConnectPanel(device) {
  const icon = getApplianceIcon(device.type);
  const status = device.status || {};
  const stateDisplay = getOperationStateDisplay(status.operationState);
  const panelKey = `homeconnect:${device.id}`;
  const displayName = getPanelDisplayName(panelKey, device.name.toUpperCase());

  let contentHtml = '';

  if (!device.connected) {
    contentHtml = `
      <div class="device-info">
        <div class="info-row">
          <span class="label">STATUS:</span>
          <span class="status-badge offline">OFFLINE</span>
        </div>
      </div>
    `;
  } else {
    const doorIcon = status.doorState === 'open' ? 'door-open' : 'door-closed';
    const warnings = status.warnings || [];

    const saltLow = warnings.includes('salt_low');
    const rinseAidLow = warnings.includes('rinse_aid_low');

    const saltStatus = saltLow
      ? '<span class="status-badge warning">LOW</span>'
      : '<span class="status-badge online">OK</span>';
    const rinseAidStatus = rinseAidLow
      ? '<span class="status-badge warning">LOW</span>'
      : '<span class="status-badge online">OK</span>';

    let programHtml = '';
    if (status.program) {
      const prog = status.program;

      let delayedStartHtml = '';
      if (prog.startInRelative && status.operationState === 'delayed') {
        delayedStartHtml = `
          <div class="info-row">
            <span class="label">STARTS IN:</span>
            <span class="value">${formatRemainingTime(prog.startInRelative)}</span>
          </div>
        `;
      }

      let progressHtml = '';
      if (prog.progress !== null && prog.progress !== undefined) {
        progressHtml = `
          <div class="info-row">
            <span class="label">PROGRESS:</span>
            <div class="progress-bar-container">
              <div class="progress-bar-bg">
                <div class="progress-bar" style="width: ${prog.progress}%"></div>
              </div>
              <span class="progress-text">${prog.progress}%</span>
            </div>
          </div>
        `;
      }

      let timeHtml = '';
      if (prog.remainingTime) {
        const elapsed = prog.elapsedTime ? formatRemainingTime(prog.elapsedTime) : null;
        const remaining = formatRemainingTime(prog.remainingTime);
        if (elapsed) {
          timeHtml = `
            <div class="info-row">
              <span class="label">TIME:</span>
              <span class="value">${elapsed} / ${remaining} left</span>
            </div>
          `;
        } else {
          timeHtml = `
            <div class="info-row">
              <span class="label">REMAINING:</span>
              <span class="value">${remaining}</span>
            </div>
          `;
        }
      }

      programHtml = `
        <div class="info-row">
          <span class="label">PROGRAM:</span>
          <span class="value">${prog.name || 'Running'}</span>
        </div>
        ${delayedStartHtml}
        ${progressHtml}
        ${timeHtml}
      `;
    }

    let remoteHtml = '';
    if (status.localControlActive) {
      remoteHtml = `
        <div class="info-row">
          <span class="label">CONTROL:</span>
          <span class="value">LOCAL</span>
        </div>
      `;
    } else if (status.remoteControlActive && status.remoteStartAllowed) {
      remoteHtml = `
        <div class="info-row">
          <span class="label">REMOTE:</span>
          <span class="value">ENABLED</span>
        </div>
      `;
    }

    contentHtml = `
      <div class="device-info">
        <div class="info-row">
          <span class="label">STATUS:</span>
          <span class="status-badge ${stateDisplay.class}">${stateDisplay.label}</span>
        </div>
        <div class="info-row">
          <span class="label">DOOR:</span>
          <span class="value">
            ${status.doorState?.toUpperCase() || 'UNKNOWN'}
            <i data-lucide="${doorIcon}" style="width: 14px; height: 14px; margin-left: 4px;"></i>
          </span>
        </div>
        <div class="info-row">
          <span class="label">SALT:</span>
          ${saltStatus}
        </div>
        <div class="info-row">
          <span class="label">RINSE AID:</span>
          ${rinseAidStatus}
        </div>
        ${programHtml}
        ${remoteHtml}
      </div>
    `;
  }

  return `
    <section class="panel homeconnect-device-panel" data-device-id="${device.id}" data-panel-key="${panelKey}" data-default-name="${device.name.toUpperCase()}">
      <div class="panel-header">
        <i data-lucide="${icon}"></i>
        <span class="panel-title">${displayName}</span>
        <button class="btn-icon refresh-homeconnect" title="Refresh">
          <i data-lucide="refresh-cw"></i>
        </button>
      </div>
      <div class="panel-content">
        ${contentHtml}
      </div>
    </section>
  `;
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

function clearHomeConnectPanels() {
  const existing = $$('.homeconnect-device-panel, #homeconnect-setup-panel');
  existing.forEach(el => el.remove());
}

function appendToDevicesRow(html) {
  const container = $('#devices-row');
  container.insertAdjacentHTML('beforeend', html);
}

export async function loadHomeConnect() {
  clearHomeConnectPanels();

  try {
    const status = await API.homeconnect.status();

    if (!status.configured) {
      appendToDevicesRow(renderHomeConnectSetupPanel(
        'NOT CONFIGURED',
        'offline',
        'Click the search icon to set up Home Connect'
      ));
      lucide.createIcons();
      $('#discover-homeconnect').addEventListener('click', discoverHomeConnect);
      return;
    }

    if (!status.authenticated) {
      appendToDevicesRow(renderHomeConnectSetupPanel(
        'NEEDS AUTH',
        'pending',
        'Click the search icon to authenticate'
      ));
      lucide.createIcons();
      $('#discover-homeconnect').addEventListener('click', discoverHomeConnect);
      return;
    }

    const devices = await API.homeconnect.devices();
    homeConnectDevices = devices;

    if (devices.length === 0) {
      appendToDevicesRow(renderHomeConnectSetupPanel(
        'CONNECTED',
        'online',
        'No appliances found'
      ));
      lucide.createIcons();
      $('#discover-homeconnect').addEventListener('click', discoverHomeConnect);
      return;
    }

    appendToDevicesRow(devices.map(d => renderHomeConnectPanel(d)).join(''));
    lucide.createIcons();
    attachHomeConnectRefreshHandlers();
    attachEditableTitles();
  } catch (err) {
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
}

export function updateHomeConnect(devices) {
  homeConnectDevices = devices;

  if (devices.length === 0) {
    return;
  }

  clearHomeConnectPanels();
  appendToDevicesRow(devices.map(d => renderHomeConnectPanel(d)).join(''));
  lucide.createIcons();
  attachHomeConnectRefreshHandlers();
  attachEditableTitles();
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

function attachHomeConnectRefreshHandlers() {
  const buttons = $$('.refresh-homeconnect');
  buttons.forEach(btn => btn.addEventListener('click', refreshHomeConnect));
}

export async function discoverHomeConnect() {
  const status = await API.homeconnect.status();

  if (!status.configured) {
    showModal('CONFIGURE HOME CONNECT', `
      <p style="margin-bottom: 12px; color: var(--text-dim)">
        To connect your Bosch/Siemens appliances, you need to register at
        <a href="https://developer.home-connect.com" target="_blank" style="color: var(--accent)">developer.home-connect.com</a>
      </p>
      <p style="margin-bottom: 16px; color: var(--text-dim)">
        Create an application with OAuth redirect URI:<br>
        <code style="color: var(--accent)">${window.location.origin}/api/homeconnect/auth/callback</code>
      </p>
      <div class="input-row">
        <label>Client ID:</label>
        <input type="text" id="hc-client-id" class="modal-input" placeholder="Your Client ID">
      </div>
      <div class="input-row" style="margin-top: 8px">
        <label>Client Secret:</label>
        <input type="password" id="hc-client-secret" class="modal-input" placeholder="Your Client Secret">
      </div>
    `, `
      <button class="btn" onclick="hideModal()">CANCEL</button>
      <button class="btn btn-start" onclick="configureHomeConnect()">SAVE</button>
    `);
    return;
  }

  if (!status.authenticated) {
    showModal('AUTHENTICATE HOME CONNECT', `
      <p style="margin-bottom: 12px; color: var(--text-dim)">
        You need to authorize access to your Home Connect appliances.
      </p>
      <p style="color: var(--text-dim)">
        Click the button below to open the Home Connect login page.
      </p>
    `, `
      <button class="btn" onclick="hideModal()">CANCEL</button>
      <button class="btn btn-start" onclick="startHomeConnectAuth()">AUTHORIZE</button>
    `);
    return;
  }

  showModal('HOME CONNECT', `
    <div class="device-info">
      <div class="info-row">
        <span class="label">STATUS:</span>
        <span class="status-badge online">CONNECTED</span>
      </div>
    </div>
    <p style="margin-top: 12px; color: var(--text-dim)">
      Your appliances are connected and syncing.
    </p>
  `, `
    <button class="btn btn-stop" onclick="disconnectHomeConnect()">DISCONNECT</button>
    <button class="btn" onclick="hideModal()">CLOSE</button>
  `);
}

export async function configureHomeConnect() {
  const clientId = $('#hc-client-id').value.trim();
  const clientSecret = $('#hc-client-secret').value.trim();

  if (!clientId || !clientSecret) {
    log('Client ID and Secret are required', 'error');
    return;
  }

  showModal('SAVING...', '<div class="loading">Saving configuration...</div>');

  try {
    await API.homeconnect.configure(clientId, clientSecret);
    hideModal();
    log('Home Connect configured', 'success');
    await discoverHomeConnect();
  } catch (err) {
    showModal('ERROR', `<p class="error">${err.message}</p>`,
      '<button class="btn" onclick="hideModal()">CLOSE</button>');
  }
}

export async function startHomeConnectAuth() {
  try {
    const { authUrl } = await API.homeconnect.authUrl();
    window.location.href = authUrl;
  } catch (err) {
    showModal('ERROR', `<p class="error">${err.message}</p>`,
      '<button class="btn" onclick="hideModal()">CLOSE</button>');
  }
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
