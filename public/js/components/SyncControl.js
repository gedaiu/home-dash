import { html } from 'https://esm.sh/htm@3.1.1/preact';
import { useState, useEffect } from 'https://esm.sh/preact@10.19.3/hooks';
import { effect } from 'https://esm.sh/@preact/signals@1.2.1';
import { syncState, roomsState, addLog } from '../state.js';
import { Panel, StatusBadge } from './Panel.js';
import { API } from '../api.js';

const SYNCABLE_CATEGORIES = ['bulb', 'lamp', 'spot', 'ceiling', 'strip', 'candle'];
const DEFAULT_MIN_BRIGHTNESS = 5;
const DEFAULT_MAX_BRIGHTNESS = 100;

export function renderSyncControl() {
  const controlState = useSyncControlState();
  const { status } = controlState;
  const onSourceChange = createSourceChangeHandler(controlState.setSelectedLight);
  const onBrightnessChange = createBrightnessHandler(controlState);
  const controls = html`
    <button class="btn-icon ${status.running ? 'btn-stop' : 'btn-start'}" onClick=${() => toggleSync(status)} title=${status.running ? 'Stop' : 'Start'}>
      <i data-lucide=${status.running ? 'square' : 'play'}></i>
    </button>
  `;

  return html`
    <${Panel} panelKey="sync" defaultName="SYNC CONTROL" icon="activity" controls=${controls}>
      <div class="sync-content">
        <div class="sync-status">
          <div class="sync-info">
            <div class="sync-row">
              <span class="label">STATUS:</span>
              <${StatusBadge} status=${status.running ? 'RUNNING' : 'STOPPED'} className=${status.running ? 'online' : 'offline'} />
            </div>
            ${renderSourceRow({ controlState, onSourceChange })}
            ${renderLastSyncRow(status.lastSync)}
            ${renderColorRow(status.currentColor)}
          </div>
        </div>
        ${renderBrightnessConfig({ controlState, onBrightnessChange })}
      </div>
    <//>
  `;
}

export { renderSyncControl as SyncControl };

function useSyncControlState() {
  const [status, setStatus] = useState({ running: false });
  const [config, setConfig] = useState(null);
  const [selectedLight, setSelectedLight] = useState('');
  const [minBrightness, setMinBrightness] = useState(DEFAULT_MIN_BRIGHTNESS);
  const [maxBrightness, setMaxBrightness] = useState(DEFAULT_MAX_BRIGHTNESS);
  const [rooms, setRooms] = useState([]);

  useEffect(() => {
    return subscribeSyncData({ setConfig, setStatus, setSelectedLight, setMinBrightness, setMaxBrightness, setRooms });
  }, []);

  useEffect(refreshIcons, [status.running]);

  return { status, config, selectedLight, minBrightness, maxBrightness, rooms, setSelectedLight, setMinBrightness, setMaxBrightness };
}

function subscribeSyncData(setters) {
  loadSyncData(setters);

  const disposeSync = effect(() => {
    if (syncState.value) {
      setters.setStatus(syncState.value);
    }
  });

  const disposeRooms = effect(() => {
    const allRooms = roomsState.value || [];
    setters.setRooms(allRooms.filter(room => room.id !== 'sensors'));
  });

  return () => {
    disposeSync();
    disposeRooms();
  };
}

async function loadSyncData(setters) {
  try {
    const [syncCfg, syncStatus, nanoleafCfg] = await Promise.all([
      API.sync.config(),
      API.sync.status(),
      API.nanoleaf.config()
    ]);

    applyLoadedConfig({ syncCfg, syncStatus, nanoleafCfg, setters });
  } catch (err) {
    console.error('Failed to load sync config:', err);
  }
}

function applyLoadedConfig({ syncCfg, syncStatus, nanoleafCfg, setters }) {
  setters.setConfig(syncCfg);
  setters.setStatus(syncStatus);

  if (syncCfg.hueDeviceId) {
    setters.setSelectedLight(syncCfg.hueDeviceId);
  }

  if (nanoleafCfg.configured) {
    setters.setMinBrightness(nanoleafCfg.minBrightness || DEFAULT_MIN_BRIGHTNESS);
    setters.setMaxBrightness(nanoleafCfg.maxBrightness || DEFAULT_MAX_BRIGHTNESS);
  }
}

function refreshIcons() {
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

async function toggleSync(status) {
  try {
    await (status.running ? stopSync() : startSync());
  } catch (err) {
    addLog(`Sync error: ${err.message}`, 'error');
  }
}

async function stopSync() {
  await API.sync.stop();
  addLog('Sync stopped', 'info');
}

async function startSync() {
  const result = await API.sync.start();

  if (result.success) {
    addLog('Sync started', 'success');

    return;
  }

  addLog(`Failed to start sync: ${result.error}`, 'error');
}

function createSourceChangeHandler(setSelectedLight) {
  return async function onSourceChange(event) {
    const lightId = event.target.value;
    setSelectedLight(lightId);

    try {
      await API.sync.setConfig({ hueDeviceId: lightId });
      addLog(`Sync source changed`, 'info');
    } catch (err) {
      addLog(`Failed to set source: ${err.message}`, 'error');
    }
  };
}

function createBrightnessHandler({ minBrightness, maxBrightness, setMinBrightness, setMaxBrightness }) {
  return async function onBrightnessChange(type, value) {
    const newMin = type === 'min' ? value : minBrightness;
    const newMax = type === 'max' ? value : maxBrightness;
    const setBrightness = type === 'min' ? setMinBrightness : setMaxBrightness;
    setBrightness(value);

    try {
      await API.nanoleaf.updateConfig({
        minBrightness: newMin,
        maxBrightness: newMax
      });
    } catch (err) {
      console.error('Failed to update brightness:', err);
    }
  };
}

function renderSourceRow({ controlState, onSourceChange }) {
  const { config, rooms, selectedLight } = controlState;

  return html`
    <div class="sync-row">
      <span class="label">SOURCE:</span>
      <span class="value">
        <select class="control-select" value=${selectedLight} onChange=${onSourceChange} disabled=${config?.allowChange === false}>
          <option value="">-- Select a light --</option>
          ${rooms.map(room => renderRoomOptions(room, selectedLight))}
        </select>
      </span>
    </div>
  `;
}

function renderRoomOptions(room, selectedLight) {
  const syncable = room.lights.filter(light => SYNCABLE_CATEGORIES.includes(light.category));

  if (syncable.length === 0) {
    return null;
  }

  return html`
    <optgroup label=${room.name}>
      ${syncable.map(light => html`
        <option value=${light.id} selected=${String(light.id) === String(selectedLight)}>${light.name}</option>
      `)}
    </optgroup>
  `;
}

function renderLastSyncRow(lastSyncTime) {
  const lastSync = lastSyncTime ? new Date(lastSyncTime).toLocaleTimeString() : '--:--:--';

  return html`
    <div class="sync-row">
      <span class="label">LAST SYNC:</span>
      <span class="value">${lastSync}</span>
    </div>
  `;
}

function renderColorRow(color) {
  const colorStyle = color ? `rgb(${color.r}, ${color.g}, ${color.b})` : 'transparent';
  const colorText = color ? `RGB(${color.r}, ${color.g}, ${color.b})` : '---';

  return html`
    <div class="sync-row">
      <span class="label">COLOR:</span>
      <span class="value">
        <span class="color-preview" style="background-color: ${colorStyle}"></span>
        <span>${colorText}</span>
      </span>
    </div>
  `;
}

function renderBrightnessConfig({ controlState, onBrightnessChange }) {
  const { minBrightness, maxBrightness } = controlState;

  return html`
    <div class="brightness-config">
      <div class="config-row">
        <span class="label">BRIGHTNESS RANGE:</span>
        <span class="value">${minBrightness}% - ${maxBrightness}%</span>
      </div>
      ${renderBrightnessSlider({ label: 'MIN:', value: minBrightness, onChange: (value) => onBrightnessChange('min', value) })}
      ${renderBrightnessSlider({ label: 'MAX:', value: maxBrightness, onChange: (value) => onBrightnessChange('max', value) })}
    </div>
  `;
}

function renderBrightnessSlider({ label, value, onChange }) {
  return html`
    <div class="slider-row">
      <label>${label}</label>
      <input type="range" min="0" max="100" value=${value} onInput=${(event) => onChange(parseInt(event.target.value))} />
      <span>${value}%</span>
    </div>
  `;
}
