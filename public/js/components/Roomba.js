import { html } from 'https://esm.sh/htm@3.1.1/preact';
import { useState, useEffect } from 'https://esm.sh/preact@10.19.3/hooks';
import { effect } from 'https://esm.sh/@preact/signals@1.2.1';
import { roombaState, addLog } from '../state.js';
import { Panel, StatusBadge } from './Panel.js';
import { API } from '../api.js';

const PHASE_DISPLAY = {
  charging: { label: 'CHARGING', class: 'online' },
  cleaning: { label: 'CLEANING', class: 'online' },
  stuck: { label: 'STUCK', class: 'error' },
  stopped: { label: 'STOPPED', class: 'offline' },
  paused: { label: 'PAUSED', class: 'pending' },
  returning: { label: 'RETURNING', class: 'pending' },
  docking: { label: 'DOCKING', class: 'pending' },
  emptying: { label: 'EMPTYING', class: 'online' },
  error: { label: 'ERROR', class: 'error' },
  cancelled: { label: 'CANCELLED', class: 'offline' }
};

function getBatteryIcon(level) {
  const icons = { full: 'battery-full', medium: 'battery-medium', low: 'battery-low' };
  return icons[level] || 'battery';
}

export function Roomba() {
  const [status, setStatus] = useState(null);
  const [detailsExpanded, setDetailsExpanded] = useState(false);

  useEffect(() => {
    API.roomba.status().then(data => {
      roombaState.value = data;
    }).catch(err => {
      console.error('Failed to load Roomba:', err);
    });

    const dispose = effect(() => {
      setStatus(roombaState.value);
    });
    return dispose;
  }, []);

  const startRoomba = async () => {
    try {
      await API.roomba.start();
      addLog('Roomba started cleaning', 'success');
    } catch (err) {
      addLog(`Failed to start Roomba: ${err.message}`, 'error');
    }
  };

  const pauseRoomba = async () => {
    try {
      await API.roomba.pause();
      addLog('Roomba paused', 'success');
    } catch (err) {
      addLog(`Failed to pause Roomba: ${err.message}`, 'error');
    }
  };

  const resumeRoomba = async () => {
    try {
      await API.roomba.resume();
      addLog('Roomba resumed', 'success');
    } catch (err) {
      addLog(`Failed to resume Roomba: ${err.message}`, 'error');
    }
  };

  const dockRoomba = async () => {
    try {
      await API.roomba.dock();
      addLog('Roomba returning to dock', 'success');
    } catch (err) {
      addLog(`Failed to dock Roomba: ${err.message}`, 'error');
    }
  };

  if (!status || !status.configured) {
    return html`
      <${Panel} panelKey="roomba" defaultName="ROOMBA" icon="bot">
        <div class="device-info">
          <div class="info-row">
            <span class="label">STATUS:</span>
            <${StatusBadge} status="NOT CONFIGURED" className="offline" />
          </div>
          <p style="margin-top: 12px; color: var(--text-dim)">
            Configure Roomba in network-config.json
          </p>
        </div>
      <//>
    `;
  }

  if (!status.connected) {
    return html`
      <${Panel} panelKey="roomba" defaultName="ROOMBA" icon="bot">
        <div class="device-info">
          <div class="info-row">
            <span class="label">STATUS:</span>
            <${StatusBadge} status="OFFLINE" className="offline" />
          </div>
          <div class="info-row">
            <span class="label">NAME:</span>
            <span class="value">${status.name || 'Roomba'}</span>
          </div>
          ${status.error ? html`<p style="margin-top: 12px; color: var(--text-dim)">${status.error}</p>` : null}
        </div>
      <//>
    `;
  }

  const phaseDisplay = PHASE_DISPLAY[status.mission?.phase] || { label: status.mission?.phase?.toUpperCase() || 'UNKNOWN', class: 'offline' };
  const batteryIcon = getBatteryIcon(status.battery?.level);
  const batteryPercent = status.battery?.percent ?? '--';

  const isActive = ['cleaning', 'returning', 'docking', 'emptying'].includes(status.mission?.phase);
  const isPaused = status.mission?.phase === 'paused';
  const isCharging = status.mission?.phase === 'charging';

  let controlButtons = null;
  if (isActive) {
    controlButtons = html`
      <button class="btn-icon" onClick=${pauseRoomba} title="Pause">
        <i data-lucide="pause"></i>
      </button>
      <button class="btn-icon" onClick=${dockRoomba} title="Dock">
        <i data-lucide="home"></i>
      </button>
    `;
  } else if (isPaused) {
    controlButtons = html`
      <button class="btn-icon" onClick=${resumeRoomba} title="Resume">
        <i data-lucide="play"></i>
      </button>
      <button class="btn-icon" onClick=${dockRoomba} title="Dock">
        <i data-lucide="home"></i>
      </button>
    `;
  } else if (isCharging || status.mission?.phase === 'stopped') {
    controlButtons = html`
      <button class="btn-icon" onClick=${startRoomba} title="Start Cleaning">
        <i data-lucide="play"></i>
      </button>
    `;
  }

  const controls = html`
    <div class="header-controls">
      ${controlButtons}
      <button class="btn-icon ${detailsExpanded ? 'active' : ''}" onClick=${() => setDetailsExpanded(!detailsExpanded)} title="Details">
        <i data-lucide="info"></i>
      </button>
    </div>
  `;

  return html`
    <${Panel} panelKey="roomba" defaultName="ROOMBA" icon="bot" controls=${controls}>
      <div class="device-info">
        <div class="info-row">
          <span class="label">STATUS:</span>
          <${StatusBadge} status=${phaseDisplay.label} className=${phaseDisplay.class} />
        </div>
        <div class="info-row">
          <span class="label">NAME:</span>
          <span class="value">${status.name}</span>
        </div>
        <div class="info-row">
          <span class="label">BATTERY:</span>
          <span class="value">
            ${batteryPercent}%
            <i data-lucide=${batteryIcon} style="width: 14px; height: 14px; margin-left: 4px;"></i>
          </span>
        </div>
        ${status.bin ? html`
          <div class="info-row">
            <span class="label">BIN:</span>
            <${StatusBadge} status=${status.bin.full ? 'FULL' : 'OK'} className=${status.bin.full ? 'warning' : 'online'} />
          </div>
        ` : null}

        <div class="roomba-details ${detailsExpanded ? 'expanded' : ''}">
          ${status.lifetime ? html`
            <div class="roomba-section">
              <div class="section-title">LIFETIME STATS</div>
              <div class="info-row">
                <span class="label">TOTAL TIME:</span>
                <span class="value">${status.lifetime.totalHours > 0 ? `${status.lifetime.totalHours}h ${status.lifetime.totalMinutes}m` : `${status.lifetime.totalMinutes}m`}</span>
              </div>
              <div class="info-row">
                <span class="label">MISSIONS:</span>
                <span class="value">${status.lifetime.totalMissions} (${status.lifetime.successRate}% success)</span>
              </div>
              <div class="info-row">
                <span class="label">AVG MISSION:</span>
                <span class="value">${status.lifetime.avgMissionMinutes} min</span>
              </div>
            </div>
          ` : null}

          ${status.settings ? html`
            <div class="roomba-section">
              <div class="section-title">SETTINGS</div>
              <div class="info-row">
                <span class="label">ACTIVE:</span>
                <span class="value">${(() => {
                  const active = [];
                  if (status.settings.carpetBoost) active.push('Carpet Boost');
                  if (status.settings.vacHigh) active.push('High Vacuum');
                  if (status.settings.twoPass) active.push('Two Pass');
                  if (status.settings.binPause) active.push('Bin Pause');
                  if (status.settings.ecoCharge) active.push('Eco Charge');
                  return active.length > 0 ? active.join(', ') : 'Default';
                })()}</span>
              </div>
            </div>
          ` : null}

          ${status.lastCommand?.command ? html`
            <div class="roomba-section">
              <div class="section-title">LAST ACTIVITY</div>
              <div class="info-row">
                <span class="label">COMMAND:</span>
                <span class="value">${status.lastCommand.command} (${status.lastCommand.initiator})</span>
              </div>
              <div class="info-row">
                <span class="label">TIME:</span>
                <span class="value">${status.lastCommand.time ? new Date(status.lastCommand.time).toLocaleString() : 'Unknown'}</span>
              </div>
            </div>
          ` : null}

          ${status.deviceInfo?.sku ? html`
            <div class="roomba-section">
              <div class="section-title">DEVICE INFO</div>
              <div class="info-row">
                <span class="label">MODEL:</span>
                <span class="value">${status.deviceInfo.sku}</span>
              </div>
              <div class="info-row">
                <span class="label">FIRMWARE:</span>
                <span class="value">${status.deviceInfo.softwareVer || 'Unknown'}</span>
              </div>
            </div>
          ` : null}
        </div>
      </div>
    <//>
  `;
}
