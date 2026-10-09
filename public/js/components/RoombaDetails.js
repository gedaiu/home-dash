import { html } from 'https://esm.sh/htm@3.1.1/preact';

const SETTING_LABELS = [
  ['carpetBoost', 'Carpet Boost'],
  ['vacHigh', 'High Vacuum'],
  ['twoPass', 'Two Pass'],
  ['binPause', 'Bin Pause'],
  ['ecoCharge', 'Eco Charge']
];

export function renderRoombaDetails(status, expanded) {
  return html`
    <div class="roomba-details ${expanded ? 'expanded' : ''}">
      ${renderLifetime(status.lifetime)}
      ${renderSettings(status.settings)}
      ${renderLastActivity(status.lastCommand)}
      ${renderDeviceInfo(status.deviceInfo)}
    </div>
  `;
}

function renderLifetime(lifetime) {
  if (!lifetime) {
    return null;
  }

  const totalTime = lifetime.totalHours > 0 ? `${lifetime.totalHours}h ${lifetime.totalMinutes}m` : `${lifetime.totalMinutes}m`;

  return html`
    <div class="roomba-section">
      <div class="section-title">LIFETIME STATS</div>
      <div class="info-row">
        <span class="label">TOTAL TIME:</span>
        <span class="value">${totalTime}</span>
      </div>
      <div class="info-row">
        <span class="label">MISSIONS:</span>
        <span class="value">${lifetime.totalMissions} (${lifetime.successRate}% success)</span>
      </div>
      <div class="info-row">
        <span class="label">AVG MISSION:</span>
        <span class="value">${lifetime.avgMissionMinutes} min</span>
      </div>
    </div>
  `;
}

function renderSettings(settings) {
  if (!settings) {
    return null;
  }

  const active = SETTING_LABELS.filter(([key]) => settings[key]).map(([, label]) => label);

  return html`
    <div class="roomba-section">
      <div class="section-title">SETTINGS</div>
      <div class="info-row">
        <span class="label">ACTIVE:</span>
        <span class="value">${active.length > 0 ? active.join(', ') : 'Default'}</span>
      </div>
    </div>
  `;
}

function renderLastActivity(lastCommand) {
  if (!lastCommand?.command) {
    return null;
  }

  const time = lastCommand.time ? new Date(lastCommand.time).toLocaleString() : 'Unknown';

  return html`
    <div class="roomba-section">
      <div class="section-title">LAST ACTIVITY</div>
      <div class="info-row">
        <span class="label">COMMAND:</span>
        <span class="value">${lastCommand.command} (${lastCommand.initiator})</span>
      </div>
      <div class="info-row">
        <span class="label">TIME:</span>
        <span class="value">${time}</span>
      </div>
    </div>
  `;
}

function renderDeviceInfo(deviceInfo) {
  if (!deviceInfo?.sku) {
    return null;
  }

  return html`
    <div class="roomba-section">
      <div class="section-title">DEVICE INFO</div>
      <div class="info-row">
        <span class="label">MODEL:</span>
        <span class="value">${deviceInfo.sku}</span>
      </div>
      <div class="info-row">
        <span class="label">FIRMWARE:</span>
        <span class="value">${deviceInfo.softwareVer || 'Unknown'}</span>
      </div>
    </div>
  `;
}
