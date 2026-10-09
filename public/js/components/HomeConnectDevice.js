import { html } from 'https://esm.sh/htm@3.1.1/preact';
import { useState, useEffect, useRef } from 'https://esm.sh/preact@10.19.3/hooks';
import { getPanelDisplayName } from '../state.js';
import { Panel, StatusBadge } from './Panel.js';

const SECONDS_PER_HOUR = 3600;
const SECONDS_PER_MINUTE = 60;
const MS_PER_MINUTE = 60000;
const OPERATION_STATE_DISPLAY = {
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
const APPLIANCE_ICONS = {
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

function homeConnectDevice({ device, onRefresh }) {
  const status = device.status || {};
  const panelKey = `homeconnect:${device.id}`;
  getPanelDisplayName(panelKey, device.name.toUpperCase());

  const remainingTime = useRemainingTime(status);

  const controls = html`
    <button class="btn-icon" onClick=${onRefresh} title="Refresh">
      <i data-lucide="refresh-cw"></i>
    </button>
  `;

  const content = device.connected ? renderApplianceStatus(status, remainingTime) : renderOffline();

  return html`
    <${Panel} panelKey=${panelKey} defaultName=${device.name.toUpperCase()} icon=${APPLIANCE_ICONS[device.type] || 'cpu'} controls=${controls}>
      ${content}
    <//>
  `;
}

function useRemainingTime(status) {
  const serverRemainingTime = status.program?.remainingTime || 0;
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
      setRemainingTime(previous => Math.max(0, previous - SECONDS_PER_MINUTE));
    }, MS_PER_MINUTE);

    return () => clearInterval(timer);
  }, [remainingTime, status.operationState]);

  return remainingTime;
}

function renderOffline() {
  return html`
    <div class="device-info">
      ${renderBadgeRow('STATUS:', 'OFFLINE', 'offline')}
    </div>
  `;
}

function renderApplianceStatus(status, remainingTime) {
  const stateDisplay = getOperationStateDisplay(status.operationState);
  const warnings = status.warnings || [];
  const salt = getConsumableLevel(warnings, 'salt_low', 'salt_empty');
  const rinseAid = getConsumableLevel(warnings, 'rinse_aid_low', 'rinse_aid_empty');

  return html`
    <div class="device-info">
      ${renderBadgeRow('STATUS:', stateDisplay.label, stateDisplay.className)}
      ${renderDoorRow(status.doorState)}
      ${renderBadgeRow('SALT:', salt.status, salt.className)}
      ${renderBadgeRow('RINSE AID:', rinseAid.status, rinseAid.className)}
      ${renderProgram(status, remainingTime)}
      ${status.localControlActive ? renderValueRow('CONTROL:', 'LOCAL') : null}
      ${isRemoteEnabled(status) ? renderValueRow('REMOTE:', 'ENABLED') : null}
    </div>
  `;
}

function getOperationStateDisplay(state) {
  return OPERATION_STATE_DISPLAY[state] || { label: state?.toUpperCase() || 'UNKNOWN', className: 'offline' };
}

function getConsumableLevel(warnings, lowWarning, emptyWarning) {
  if (warnings.includes(emptyWarning)) {
    return { status: 'EMPTY', className: 'error' };
  }

  if (warnings.includes(lowWarning)) {
    return { status: 'LOW', className: 'warning' };
  }

  return { status: 'OK', className: 'online' };
}

function isRemoteEnabled(status) {
  return !status.localControlActive && status.remoteControlActive && status.remoteStartAllowed;
}

function renderBadgeRow(label, status, className) {
  return html`
    <div class="info-row">
      <span class="label">${label}</span>
      <${StatusBadge} status=${status} className=${className} />
    </div>
  `;
}

function renderValueRow(label, value) {
  return html`
    <div class="info-row">
      <span class="label">${label}</span>
      <span class="value">${value}</span>
    </div>
  `;
}

function renderDoorRow(doorState) {
  const doorIcon = doorState === 'open' ? 'door-open' : 'door-closed';

  return html`
    <div class="info-row">
      <span class="label">DOOR:</span>
      <span class="value">
        ${doorState?.toUpperCase() || 'UNKNOWN'}
        <i data-lucide="${doorIcon}" style="width: 14px; height: 14px; margin-left: 4px;"></i>
      </span>
    </div>
  `;
}

function renderProgram(status, remainingTime) {
  const program = status.program;

  if (!program) {
    return null;
  }

  return html`
    ${renderValueRow('PROGRAM:', program.name || 'Running')}
    ${isDelayedStart(program, status.operationState) ? renderValueRow('STARTS IN:', formatRemainingTime(program.startInRelative)) : null}
    ${hasProgress(program) ? renderProgressRow(program.progress) : null}
    ${remainingTime > 0 ? renderValueRow('REMAINING:', formatRemainingTime(remainingTime)) : null}
  `;
}

function isDelayedStart(program, operationState) {
  return program.startInRelative && operationState === 'delayed';
}

function hasProgress(program) {
  return program.progress !== null && program.progress !== undefined;
}

function renderProgressRow(progress) {
  return html`
    <div class="info-row">
      <span class="label">PROGRESS:</span>
      <div class="progress-bar-container">
        <div class="progress-bar-bg">
          <div class="progress-bar" style="width: ${progress}%"></div>
        </div>
        <span class="progress-text">${progress}%</span>
      </div>
    </div>
  `;
}

function formatRemainingTime(seconds) {
  if (!seconds || seconds <= 0) {
    return '--:--';
  }

  const hrs = Math.floor(seconds / SECONDS_PER_HOUR);
  const mins = Math.floor((seconds % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE);

  if (hrs > 0) {
    return `${hrs}h ${mins}m`;
  }

  return `${mins}m`;
}

export { homeConnectDevice };
