import { html } from 'htm/preact';
import { useState, useEffect } from 'preact/hooks';
import { sync, hue, nanoleaf, addLog } from '../state.js';
import { API } from '../api.js';
import { Panel } from '../components/Panel.js';
import { StatusBadge } from '../components/StatusBadge.js';

const DEFAULT_MIN_BRIGHTNESS = 5;
const DEFAULT_MAX_BRIGHTNESS = 100;

export function renderSyncControl() {
  const [minBrightness, setMinBrightness] = useState(DEFAULT_MIN_BRIGHTNESS);
  const [maxBrightness, setMaxBrightness] = useState(DEFAULT_MAX_BRIGHTNESS);
  const [selectedLightId, setSelectedLightId] = useState(null);

  const syncState = sync.value;
  const lights = hue.value.lights || [];

  useEffect(() => {
    loadConfig({ setSelectedLightId, setMinBrightness, setMaxBrightness });
  }, []);

  const toggleButton = html`
    <button
      class=${`btn-icon ${syncState.running ? 'btn-stop' : 'btn-start'}`}
      onClick=${() => toggleSync(syncState)}
      title=${syncState.running ? 'Stop' : 'Start'}
    >
      <i data-lucide=${syncState.running ? 'square' : 'play'}></i>
    </button>
  `;

  return html`
    <${Panel} icon="zap" title="SYNC CONTROL" controls=${toggleButton}>
      <div class="sync-content">
        ${renderDeviceInfo(syncState)}
        ${renderSourceSelect({ lights, selectedLightId, setSelectedLightId })}
        ${renderBrightnessConfig({ minBrightness, maxBrightness, setMinBrightness, setMaxBrightness })}
      </div>
    <//>
  `;
}

export { renderSyncControl as SyncControl };

async function loadConfig({ setSelectedLightId, setMinBrightness, setMaxBrightness }) {
  try {
    const config = await API.sync.config();

    if (config.hueDeviceId) {
      setSelectedLightId(config.hueDeviceId);
    }

    const nanoleafConfig = await API.nanoleaf.config();

    if (nanoleafConfig.configured) {
      setMinBrightness(nanoleafConfig.minBrightness || DEFAULT_MIN_BRIGHTNESS);
      setMaxBrightness(nanoleafConfig.maxBrightness || DEFAULT_MAX_BRIGHTNESS);
    }
  } catch (err) {
    addLog(`Error loading sync config: ${err.message}`, 'error');
  }
}

async function toggleSync(syncState) {
  if (syncState.running) {
    await API.sync.stop();

    return;
  }

  const result = await API.sync.start();

  if (!result.success) {
    addLog(`Failed to start: ${result.error}`, 'error');
  }
}

function renderDeviceInfo(syncState) {
  const { color, lastSync, running } = syncState;
  const { colorStyle, colorText } = describeColor(color);

  return html`
    <div class="device-info">
      <div class="info-row">
        <span class="label">STATUS:</span>
        <${StatusBadge} status=${running ? 'online' : 'offline'}>
          ${running ? 'RUNNING' : 'STOPPED'}
        <//>
      </div>

      ${lastSync && html`
        <div class="info-row">
          <span class="label">LAST:</span>
          <span class="value">${new Date(lastSync).toLocaleTimeString()}</span>
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
  `;
}

function describeColor(color) {
  if (!color) {
    return { colorStyle: 'background-color: #333', colorText: '--' };
  }

  return {
    colorStyle: `background-color: rgb(${color.r}, ${color.g}, ${color.b})`,
    colorText: `RGB(${color.r}, ${color.g}, ${color.b})`
  };
}

function renderSourceSelect({ lights, selectedLightId, setSelectedLightId }) {
  const onSourceChange = createSourceChangeHandler({ lights, selectedLightId, setSelectedLightId });

  return html`
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
  `;
}

function createSourceChangeHandler({ lights, selectedLightId, setSelectedLightId }) {
  return async function onSourceChange(event) {
    const id = parseInt(event.target.value, 10);
    const light = id ? lights.find(candidate => candidate.id === id) : null;

    if (!light) {
      return;
    }

    if (!confirm(`Change sync source to "${light.name}"?`)) {
      event.target.value = selectedLightId || '';

      return;
    }

    setSelectedLightId(id);
    await API.sync.setConfig({ hueDeviceId: id, hueDeviceName: light.name });
    addLog(`Selected light: ${light.name}`);
  };
}

function renderBrightnessConfig({ minBrightness, maxBrightness, setMinBrightness, setMaxBrightness }) {
  return html`
    <div class="brightness-config">
      ${renderBrightnessSlider({
        label: 'MIN BRI:',
        value: minBrightness,
        setValue: setMinBrightness,
        configKey: 'minBrightness'
      })}
      ${renderBrightnessSlider({
        label: 'MAX BRI:',
        value: maxBrightness,
        setValue: setMaxBrightness,
        configKey: 'maxBrightness'
      })}

      <div class="info-row" style="margin-top: 8px">
        <span class="label">RANGE:</span>
        <span class="value">${minBrightness}% - ${maxBrightness}%</span>
      </div>
    </div>
  `;
}

function renderBrightnessSlider({ label, value, setValue, configKey }) {
  return html`
    <div class="slider-row">
      <span class="label">${label}</span>
      <input
        type="range"
        min="0"
        max="100"
        value=${value}
        onInput=${(event) => setValue(readSliderValue(event))}
        onChange=${(event) => updateBrightness({ setValue, configKey, value: readSliderValue(event) })}
      />
      <span class="value">${value}%</span>
    </div>
  `;
}

function readSliderValue(event) {
  return parseInt(event.target.value, 10);
}

async function updateBrightness({ setValue, configKey, value }) {
  setValue(value);
  await API.nanoleaf.updateConfig({ [configKey]: value });
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
