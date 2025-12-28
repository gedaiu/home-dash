import { html } from 'https://esm.sh/htm@3.1.1/preact';
import { useState, useEffect, useRef } from 'https://esm.sh/preact@10.19.3/hooks';
import { effect } from 'https://esm.sh/@preact/signals@1.2.1';
import { homeConnectState, addLog, getPanelDisplayName } from '../state.js';
import { Panel, StatusBadge } from './Panel.js';
import { API } from '../api.js';

function getOperationStateDisplay(state) {
  const displays = {
    'inactive': { label: 'IDLE', className: 'offline' },
    'ready': { label: 'READY', className: 'ready' },
    'delayed': { label: 'DELAYED', className: 'pending' },
    'running': { label: 'RUNNING', className: 'online' },
    'paused': { label: 'PAUSED', className: 'pending' },
    'action_required': { label: 'ACTION', className: 'warning' },
    'finished': { label: 'DONE', className: 'success' },
    'error': { label: 'ERROR', className: 'offline' },
    'aborting': { label: 'STOPPING', className: 'pending' }
  };
  return displays[state] || { label: state?.toUpperCase() || 'UNKNOWN', className: 'offline' };
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

function formatRemainingTime(seconds) {
  if (!seconds || seconds <= 0) return '--:--';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hrs > 0) {
    return `${hrs}h ${mins}m`;
  }
  return `${mins}m`;
}

function HomeConnectDevice({ device, onRefresh }) {
  const icon = getApplianceIcon(device.type);
  const status = device.status || {};
  const stateDisplay = getOperationStateDisplay(status.operationState);
  const panelKey = `homeconnect:${device.id}`;
  const displayName = getPanelDisplayName(panelKey, device.name.toUpperCase());

  const prog = status.program;
  const serverRemainingTime = prog?.remainingTime || 0;
  const [remainingTime, setRemainingTime] = useState(serverRemainingTime);
  const lastServerTimeRef = useRef(serverRemainingTime);

  useEffect(() => {
    if (serverRemainingTime !== lastServerTimeRef.current) {
      setRemainingTime(serverRemainingTime);
      lastServerTimeRef.current = serverRemainingTime;
    }
  }, [serverRemainingTime]);

  useEffect(() => {
    if (remainingTime <= 0 || status.operationState !== 'running') {
      return;
    }

    const timer = setInterval(() => {
      setRemainingTime(prev => Math.max(0, prev - 60));
    }, 60000);

    return () => clearInterval(timer);
  }, [remainingTime, status.operationState]);

  const controls = html`
    <button class="btn-icon" onClick=${onRefresh} title="Refresh">
      <i data-lucide="refresh-cw"></i>
    </button>
  `;

  if (!device.connected) {
    return html`
      <${Panel} panelKey=${panelKey} defaultName=${device.name.toUpperCase()} icon=${icon} controls=${controls}>
        <div class="device-info">
          <div class="info-row">
            <span class="label">STATUS:</span>
            <${StatusBadge} status="OFFLINE" className="offline" />
          </div>
        </div>
      <//>
    `;
  }

  const doorIcon = status.doorState === 'open' ? 'door-open' : 'door-closed';

  const warnings = status.warnings || [];
  const saltLow = warnings.includes('salt_low');
  const rinseAidLow = warnings.includes('rinse_aid_low');

  const hasProgress = prog && (prog.progress !== null && prog.progress !== undefined);
  const hasRemainingTime = remainingTime > 0;

  return html`
    <${Panel} panelKey=${panelKey} defaultName=${device.name.toUpperCase()} icon=${icon} controls=${controls}>
      <div class="device-info">
        <div class="info-row">
          <span class="label">STATUS:</span>
          <${StatusBadge} status=${stateDisplay.label} className=${stateDisplay.className} />
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
          <${StatusBadge} status=${saltLow ? 'LOW' : 'OK'} className=${saltLow ? 'warning' : 'online'} />
        </div>
        <div class="info-row">
          <span class="label">RINSE AID:</span>
          <${StatusBadge} status=${rinseAidLow ? 'LOW' : 'OK'} className=${rinseAidLow ? 'warning' : 'online'} />
        </div>
        ${prog ? html`
          <div class="info-row">
            <span class="label">PROGRAM:</span>
            <span class="value">${prog.name || 'Running'}</span>
          </div>
          ${prog.startInRelative && status.operationState === 'delayed' ? html`
            <div class="info-row">
              <span class="label">STARTS IN:</span>
              <span class="value">${formatRemainingTime(prog.startInRelative)}</span>
            </div>
          ` : null}
          ${hasProgress ? html`
            <div class="info-row">
              <span class="label">PROGRESS:</span>
              <div class="progress-bar-container">
                <div class="progress-bar-bg">
                  <div class="progress-bar" style="width: ${prog.progress}%"></div>
                </div>
                <span class="progress-text">${prog.progress}%</span>
              </div>
            </div>
          ` : null}
          ${hasRemainingTime ? html`
            <div class="info-row">
              <span class="label">REMAINING:</span>
              <span class="value">${formatRemainingTime(remainingTime)}</span>
            </div>
          ` : null}
        ` : null}
        ${status.localControlActive ? html`
          <div class="info-row">
            <span class="label">CONTROL:</span>
            <span class="value">LOCAL</span>
          </div>
        ` : null}
        ${!status.localControlActive && status.remoteControlActive && status.remoteStartAllowed ? html`
          <div class="info-row">
            <span class="label">REMOTE:</span>
            <span class="value">ENABLED</span>
          </div>
        ` : null}
      </div>
    <//>
  `;
}

export function HomeConnect() {
  const [devices, setDevices] = useState([]);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadStatus = async () => {
    try {
      const s = await API.homeconnect.status();
      setStatus(s);

      if (s.configured && s.authenticated) {
        const d = await API.homeconnect.devices();
        homeConnectState.value = d;
        setDevices(d);
      }
      setLoading(false);
    } catch (err) {
      console.error('Failed to load HomeConnect:', err);
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();

    const dispose = effect(() => {
      const data = homeConnectState.value;
      if (Array.isArray(data)) {
        setDevices(data);
      }
    });
    return dispose;
  }, []);

  useEffect(() => {
    if (window.lucide) {
      window.lucide.createIcons();
    }
  }, [devices, status]);

  const refresh = async () => {
    try {
      const d = await API.homeconnect.refresh();
      homeConnectState.value = d;
      setDevices(d);
    } catch (err) {
      addLog(`HomeConnect refresh failed: ${err.message}`, 'error');
    }
  };

  if (loading) {
    return html`
      <${Panel} panelKey="homeconnect" defaultName="HOME CONNECT" icon="washing-machine">
        <div class="loading">Connecting...</div>
      <//>
    `;
  }

  if (!status?.configured) {
    return html`
      <${Panel} panelKey="homeconnect" defaultName="HOME CONNECT" icon="washing-machine">
        <div class="device-info">
          <div class="info-row">
            <span class="label">STATUS:</span>
            <${StatusBadge} status="NOT CONFIGURED" className="offline" />
          </div>
          <p style="margin-top: 12px; color: var(--text-dim)">
            Configure in settings
          </p>
        </div>
      <//>
    `;
  }

  if (!status?.authenticated) {
    return html`
      <${Panel} panelKey="homeconnect" defaultName="HOME CONNECT" icon="washing-machine">
        <div class="device-info">
          <div class="info-row">
            <span class="label">STATUS:</span>
            <${StatusBadge} status="NEEDS AUTH" className="pending" />
          </div>
          <p style="margin-top: 12px; color: var(--text-dim)">
            Authentication required
          </p>
        </div>
      <//>
    `;
  }

  if (devices.length === 0) {
    return html`
      <${Panel} panelKey="homeconnect" defaultName="HOME CONNECT" icon="washing-machine">
        <div class="device-info">
          <div class="info-row">
            <span class="label">STATUS:</span>
            <${StatusBadge} status="CONNECTED" className="online" />
          </div>
          <p style="margin-top: 12px; color: var(--text-dim)">
            No appliances found
          </p>
        </div>
      <//>
    `;
  }

  return html`
    ${devices.map(device => html`
      <${HomeConnectDevice} key=${device.id} device=${device} onRefresh=${refresh} />
    `)}
  `;
}
