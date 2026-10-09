import { API } from './api.js';
import { $, $$ } from './utils.js';
import { log } from './log.js';
import { setSelectedLightId, setConfigLocked, getAllLights, populateLightSelect } from './rooms.js';

let syncConfig = null;

export async function loadSyncConfig() {
  try {
    syncConfig = await API.sync.config();
    setConfigLocked(syncConfig.allowChange === false);
    applySourceSelectConfig(syncConfig);

    const nanoleafConfig = await API.nanoleaf.config();
    applyBrightnessConfig(nanoleafConfig);

    const status = await API.sync.status();
    updateSyncStatus(status);
  } catch (err) {
    log(`Error loading config: ${err.message}`, 'error');
  }
}

function applySourceSelectConfig(config) {
  const select = $('#sync-source-select');

  if (!select) {
    return;
  }

  select.disabled = config.allowChange === false;

  if (!config.hueDeviceId) {
    return;
  }

  setSelectedLightId(config.hueDeviceId);
  select.value = config.hueDeviceId;
}

function applyBrightnessConfig(nanoleafConfig) {
  if (!nanoleafConfig.configured) {
    return;
  }

  $('#min-brightness').value = nanoleafConfig.minBrightness;
  $('#max-brightness').value = nanoleafConfig.maxBrightness;
  $('#min-brightness-value').textContent = `${nanoleafConfig.minBrightness}%`;
  $('#max-brightness-value').textContent = `${nanoleafConfig.maxBrightness}%`;
  $('#brightness-range').textContent = `${nanoleafConfig.minBrightness}% - ${nanoleafConfig.maxBrightness}%`;
}

export function updateSyncStatus(status) {
  const lastEl = $('#sync-last');
  const colorPreview = $('#color-preview');
  const colorValue = $('#color-value');
  const btnToggle = $('#btn-sync-toggle');

  renderRunningState($('#sync-status'), btnToggle, status.running);
  lucide.createIcons({ nodes: [btnToggle] });

  if (status.lastSync) {
    lastEl.textContent = new Date(status.lastSync).toLocaleTimeString();
  }

  if (status.currentColor) {
    const { r: red, g: green, b: blue } = status.currentColor;
    colorPreview.style.backgroundColor = `rgb(${red}, ${green}, ${blue})`;
    colorValue.textContent = `RGB(${red}, ${green}, ${blue})`;
  }
}

const RUNNING_STATE = {
  label: 'RUNNING',
  statusAdd: 'online',
  statusRemove: 'offline',
  icon: 'square',
  title: 'Stop',
  buttonAdd: 'btn-stop',
  buttonRemove: 'btn-start'
};

const STOPPED_STATE = {
  label: 'STOPPED',
  statusAdd: 'offline',
  statusRemove: 'online',
  icon: 'play',
  title: 'Start',
  buttonAdd: 'btn-start',
  buttonRemove: 'btn-stop'
};

function renderRunningState(statusEl, btnToggle, isRunning) {
  const state = isRunning ? RUNNING_STATE : STOPPED_STATE;
  statusEl.textContent = state.label;
  statusEl.classList.add(state.statusAdd);
  statusEl.classList.remove(state.statusRemove);
  btnToggle.innerHTML = `<i data-lucide="${state.icon}"></i>`;
  btnToggle.title = state.title;
  btnToggle.classList.add(state.buttonAdd);
  btnToggle.classList.remove(state.buttonRemove);
}

export async function toggleSync() {
  const isRunning = $('#sync-status').textContent === 'RUNNING';

  if (isRunning) {
    await API.sync.stop();

    return;
  }

  const result = await API.sync.start();

  if (!result.success) {
    log(`Failed to start: ${result.error}`, 'error');
  }
}

export async function onSourceSelectChange(event) {
  const select = event.target;
  const lightId = parseInt(select.value, 10);

  if (!lightId) {
    return;
  }

  const light = getAllLights().find(candidate => candidate.id === lightId);

  if (!light) {
    return;
  }

  const previousId = select.dataset.previousValue;
  const confirmed = confirm(`Change sync source to "${light.name}"?`);

  if (!confirmed) {
    select.value = previousId || '';

    return;
  }

  await applySelectedLight(select, light);
}

async function applySelectedLight(select, light) {
  setSelectedLightId(light.id);
  select.dataset.previousValue = light.id;

  $$('.light-item').forEach(lightItem => {
    lightItem.classList.toggle('selected', String(lightItem.dataset.id) === String(light.id));
  });

  await API.sync.setConfig({ hueDeviceId: light.id, hueDeviceName: light.name });
  log(`Selected light: ${light.name}`);
}

export function updateBrightnessRange() {
  const min = $('#min-brightness').value;
  const max = $('#max-brightness').value;
  $('#brightness-range').textContent = `${min}% - ${max}%`;
}

export function initSyncControls() {
  $('#btn-sync-toggle').addEventListener('click', toggleSync);

  $('#sync-source-select').addEventListener('change', onSourceSelectChange);

  $('#min-brightness').addEventListener('input', (event) => {
    $('#min-brightness-value').textContent = `${event.target.value}%`;
  });

  $('#max-brightness').addEventListener('input', (event) => {
    $('#max-brightness-value').textContent = `${event.target.value}%`;
  });

  $('#min-brightness').addEventListener('change', async (event) => {
    await API.nanoleaf.updateConfig({ minBrightness: parseInt(event.target.value, 10) });
    updateBrightnessRange();
  });

  $('#max-brightness').addEventListener('change', async (event) => {
    await API.nanoleaf.updateConfig({ maxBrightness: parseInt(event.target.value, 10) });
    updateBrightnessRange();
  });
}
