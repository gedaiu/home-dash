import { API } from '../api.js';
import { $ } from '../utils.js';
import { log } from '../log.js';
import { showModal, hideModal } from '../modal.js';

export async function discoverHomeConnect() {
  const status = await API.homeconnect.status();

  if (!status.configured) {
    showConfigureModal();

    return;
  }

  if (!status.authenticated) {
    showAuthenticateModal();

    return;
  }

  showConnectedModal();
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

function showConfigureModal() {
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
}

function showAuthenticateModal() {
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
}

function showConnectedModal() {
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
