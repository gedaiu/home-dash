import { formatRemainingTime } from '../utils.js';
import { getPanelDisplayName } from '../panels.js';

const OFFLINE_CONTENT = `
      <div class="device-info">
        <div class="info-row">
          <span class="label">STATUS:</span>
          <span class="status-badge offline">OFFLINE</span>
        </div>
      </div>
    `;
const LOW_BADGE = '<span class="status-badge warning">LOW</span>';
const OK_BADGE = '<span class="status-badge online">OK</span>';
const OPERATION_STATE_DISPLAYS = {
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

export function renderHomeConnectPanel(device) {
  const panelKey = `homeconnect:${device.id}`;
  const upperName = device.name.toUpperCase();
  const displayName = getPanelDisplayName(panelKey, upperName);
  const contentHtml = device.connected ? renderConnectedContent(device.status || {}) : OFFLINE_CONTENT;

  return `
    <section class="panel homeconnect-device-panel" data-device-id="${device.id}" data-panel-key="${panelKey}" data-default-name="${upperName}">
      <div class="panel-header">
        <i data-lucide="${APPLIANCE_ICONS[device.type] || 'cpu'}"></i>
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

function renderConnectedContent(status) {
  const stateDisplay = getOperationStateDisplay(status.operationState);
  const doorIcon = status.doorState === 'open' ? 'door-open' : 'door-closed';
  const warnings = status.warnings || [];
  const doorValue = `
            ${status.doorState?.toUpperCase() || 'UNKNOWN'}
            <i data-lucide="${doorIcon}" style="width: 14px; height: 14px; margin-left: 4px;"></i>
          `;

  return `
      <div class="device-info">
        ${renderRow('STATUS', `<span class="status-badge ${stateDisplay.class}">${stateDisplay.label}</span>`)}
        ${renderRow('DOOR', renderValue(doorValue))}
        ${renderWarningRow('SALT', warnings.includes('salt_low'))}
        ${renderWarningRow('RINSE AID', warnings.includes('rinse_aid_low'))}
        ${renderProgram(status)}
        ${renderControlMode(status)}
      </div>
    `;
}

function getOperationStateDisplay(state) {
  return OPERATION_STATE_DISPLAYS[state] || { label: state?.toUpperCase() || 'UNKNOWN', class: 'offline' };
}

function renderProgram(status) {
  const program = status.program;

  if (!program) {
    return '';
  }

  return `
        ${renderRow('PROGRAM', renderValue(program.name || 'Running'))}
        ${renderDelayedStart(program, status.operationState)}
        ${renderProgress(program.progress)}
        ${renderTimes(program)}
      `;
}

function renderDelayedStart(program, operationState) {
  if (!program.startInRelative || operationState !== 'delayed') {
    return '';
  }

  return renderRow('STARTS IN', renderValue(formatRemainingTime(program.startInRelative)));
}

function renderProgress(progress) {
  if (progress === null || progress === undefined) {
    return '';
  }

  return renderRow('PROGRESS', `
            <div class="progress-bar-container">
              <div class="progress-bar-bg">
                <div class="progress-bar" style="width: ${progress}%"></div>
              </div>
              <span class="progress-text">${progress}%</span>
            </div>
          `);
}

function renderTimes(program) {
  if (!program.remainingTime) {
    return '';
  }

  const elapsed = program.elapsedTime ? formatRemainingTime(program.elapsedTime) : null;
  const remaining = formatRemainingTime(program.remainingTime);

  if (elapsed) {
    return renderRow('TIME', renderValue(`${elapsed} / ${remaining} left`));
  }

  return renderRow('REMAINING', renderValue(remaining));
}

function renderControlMode(status) {
  if (status.localControlActive) {
    return renderRow('CONTROL', renderValue('LOCAL'));
  }

  if (status.remoteControlActive && status.remoteStartAllowed) {
    return renderRow('REMOTE', renderValue('ENABLED'));
  }

  return '';
}

function renderWarningRow(label, isLow) {
  return renderRow(label, isLow ? LOW_BADGE : OK_BADGE);
}

function renderRow(label, valueMarkup) {
  return `
        <div class="info-row">
          <span class="label">${label}:</span>
          ${valueMarkup}
        </div>
      `;
}

function renderValue(content) {
  return `<span class="value">${content}</span>`;
}
