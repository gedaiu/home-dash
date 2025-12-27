import { html } from 'htm/preact';
import { useState, useEffect } from 'preact/hooks';
import { sync, hue, nanoleaf, addLog } from '../state.js';
import { API } from '../api.js';
import { Panel } from '../components/Panel.js';
import { StatusBadge } from '../components/StatusBadge.js';

export function SyncControl() {
  const [minBrightness, setMinBrightness] = useState(5);
  const [maxBrightness, setMaxBrightness] = useState(100);
  const [selectedLightId, setSelectedLightId] = useState(null);

  const syncState = sync.value;
  const lights = hue.value.lights || [];

  useEffect(() => {
    loadConfig();
  }, []);

  async function loadConfig() {
    try {
      const config = await API.sync.config();
      if (config.hueDeviceId) {
        setSelectedLightId(config.hueDeviceId);
      }

      const nanoleafConfig = await API.nanoleaf.config();
      if (nanoleafConfig.configured) {
        setMinBrightness(nanoleafConfig.minBrightness || 5);
        setMaxBrightness(nanoleafConfig.maxBrightness || 100);
      }
    } catch (err) {
      addLog(`Error loading sync config: ${err.message}`, 'error');
    }
  }

  async function toggleSync() {
    if (syncState.running) {
      await API.sync.stop();
    } else {
      const result = await API.sync.start();
      if (!result.success) {
        addLog(`Failed to start: ${result.error}`, 'error');
      }
    }
  }

  async function onSourceChange(e) {
    const id = parseInt(e.target.value, 10);
    if (!id) {
      return;
    }

    const light = lights.find(l => l.id === id);
    if (!light) {
      return;
    }

    const confirmed = confirm(`Change sync source to "${light.name}"?`);
    if (!confirmed) {
      e.target.value = selectedLightId || '';
      return;
    }

    setSelectedLightId(id);
    await API.sync.setConfig({ hueDeviceId: id, hueDeviceName: light.name });
    addLog(`Selected light: ${light.name}`);
  }

  async function onMinBrightnessChange(value) {
    setMinBrightness(value);
    await API.nanoleaf.updateConfig({ minBrightness: value });
  }

  async function onMaxBrightnessChange(value) {
    setMaxBrightness(value);
    await API.nanoleaf.updateConfig({ maxBrightness: value });
  }

  const toggleButton = html`
    <button
      class=${`btn-icon ${syncState.running ? 'btn-stop' : 'btn-start'}`}
      onClick=${toggleSync}
      title=${syncState.running ? 'Stop' : 'Start'}
    >
      <i data-lucide=${syncState.running ? 'square' : 'play'}></i>
    </button>
  `;

  const colorStyle = syncState.color
    ? `background-color: rgb(${syncState.color.r}, ${syncState.color.g}, ${syncState.color.b})`
    : 'background-color: #333';

  const colorText = syncState.color
    ? `RGB(${syncState.color.r}, ${syncState.color.g}, ${syncState.color.b})`
    : '--';

  return html`
    <${Panel} icon="zap" title="SYNC CONTROL" controls=${toggleButton}>
      <div class="sync-content">
        <div class="device-info">
          <div class="info-row">
            <span class="label">STATUS:</span>
            <${StatusBadge} status=${syncState.running ? 'online' : 'offline'}>
              ${syncState.running ? 'RUNNING' : 'STOPPED'}
            <//>
          </div>

          ${syncState.lastSync && html`
            <div class="info-row">
              <span class="label">LAST:</span>
              <span class="value">${new Date(syncState.lastSync).toLocaleTimeString()}</span>
            </div>
          `}

          <div class="info-row">
            <span class="label">COLOR:</span>
            <span class="value">
              <span class="color-preview" style=${colorStyle}></span>
              ${colorText}
            </span>
          </div>
        </div>

        <div class="sync-source">
          <div class="control-row">
            <span class="label">SOURCE:</span>
            <select
              class="control-select"
              value=${selectedLightId || ''}
              onChange=${onSourceChange}
            >
              <option value="">Select light...</option>
              ${lights.map(light => html`
                <option key=${light.id} value=${light.id}>${light.name}</option>
              `)}
            </select>
          </div>
        </div>

        <div class="brightness-config">
          <div class="slider-row">
            <span class="label">MIN BRI:</span>
            <input
              type="range"
              min="0"
              max="100"
              value=${minBrightness}
              onInput=${(e) => setMinBrightness(parseInt(e.target.value, 10))}
              onChange=${(e) => onMinBrightnessChange(parseInt(e.target.value, 10))}
            />
            <span class="value">${minBrightness}%</span>
          </div>

          <div class="slider-row">
            <span class="label">MAX BRI:</span>
            <input
              type="range"
              min="0"
              max="100"
              value=${maxBrightness}
              onInput=${(e) => setMaxBrightness(parseInt(e.target.value, 10))}
              onChange=${(e) => onMaxBrightnessChange(parseInt(e.target.value, 10))}
            />
            <span class="value">${maxBrightness}%</span>
          </div>

          <div class="info-row" style="margin-top: 8px">
            <span class="label">RANGE:</span>
            <span class="value">${minBrightness}% - ${maxBrightness}%</span>
          </div>
        </div>
      </div>
    <//>
  `;
}

// Legacy exports for backwards compatibility
export async function loadSyncConfig() {
  try {
    const config = await API.sync.config();
    const status = await API.sync.status();

    sync.value = {
      ...sync.value,
      running: status.running,
      lastSync: status.lastSync,
      color: status.currentColor,
      sourceId: config.hueDeviceId
    };

    const nanoleafConfig = await API.nanoleaf.config();
    if (nanoleafConfig.configured) {
      sync.value = {
        ...sync.value,
        minBrightness: nanoleafConfig.minBrightness,
        maxBrightness: nanoleafConfig.maxBrightness
      };
    }
  } catch (err) {
    addLog(`Error loading sync config: ${err.message}`, 'error');
  }
}

export function updateSyncStatus(status) {
  sync.value = {
    ...sync.value,
    running: status.running,
    lastSync: status.lastSync,
    color: status.currentColor
  };
}
