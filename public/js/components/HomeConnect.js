import { html } from 'https://esm.sh/htm@3.1.1/preact';
import { useState, useEffect } from 'https://esm.sh/preact@10.19.3/hooks';
import { effect } from 'https://esm.sh/@preact/signals@1.2.1';
import { homeConnectState, addLog } from '../state.js';
import { Panel, StatusBadge } from './Panel.js';
import { homeConnectDevice } from './HomeConnectDevice.js';
import { API } from '../api.js';

function homeConnect() {
  const [devices, setDevices] = useState([]);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStatus({ setStatus, setDevices, setLoading });

    const dispose = effect(() => {
      const stateDevices = homeConnectState.value;

      if (Array.isArray(stateDevices)) {
        setDevices(stateDevices);
      }
    });

    return dispose;
  }, []);

  useLucideIcons([devices, status]);

  if (loading) {
    return renderHomeConnectPanel(html`<div class="loading">Connecting...</div>`);
  }

  const placeholder = renderPlaceholder(status, devices);

  if (placeholder) {
    return renderHomeConnectPanel(placeholder);
  }

  return html`
    ${devices.map(device => html`
      <${homeConnectDevice} key=${device.id} device=${device} onRefresh=${() => refreshDevices(setDevices)} />
    `)}
  `;
}

function useLucideIcons(dependencies) {
  useEffect(() => {
    if (window.lucide) {
      window.lucide.createIcons();
    }
  }, dependencies);
}

async function loadStatus({ setStatus, setDevices, setLoading }) {
  const homeConnectApi = API.homeconnect;

  try {
    const connection = await homeConnectApi.status();
    setStatus(connection);

    if (connection.configured && connection.authenticated) {
      const loadedDevices = await homeConnectApi.devices();
      homeConnectState.value = loadedDevices;
      setDevices(loadedDevices);
    }
  } catch (err) {
    console.error('Failed to load HomeConnect:', err);
  }

  setLoading(false);
}

async function refreshDevices(setDevices) {
  const homeConnectApi = API.homeconnect;

  try {
    const refreshedDevices = await homeConnectApi.refresh();
    homeConnectState.value = refreshedDevices;
    setDevices(refreshedDevices);
  } catch (err) {
    addLog(`HomeConnect refresh failed: ${err.message}`, 'error');
  }
}

function renderHomeConnectPanel(content) {
  return html`
    <${Panel} panelKey="homeconnect" defaultName="HOME CONNECT" icon="washing-machine">
      ${content}
    <//>
  `;
}

function renderPlaceholder(status, devices) {
  if (!status?.configured) {
    return renderNotice('NOT CONFIGURED', 'offline', 'Configure in settings');
  }

  if (!status?.authenticated) {
    return renderNotice('NEEDS AUTH', 'pending', 'Authentication required');
  }

  if (devices.length === 0) {
    return renderNotice('CONNECTED', 'online', 'No appliances found');
  }

  return null;
}

function renderNotice(badge, className, message) {
  return html`
    <div class="device-info">
      <div class="info-row">
        <span class="label">STATUS:</span>
        <${StatusBadge} status=${badge} className=${className} />
      </div>
      <p style="margin-top: 12px; color: var(--text-dim)">
        ${message}
      </p>
    </div>
  `;
}

export { homeConnect as HomeConnect };
