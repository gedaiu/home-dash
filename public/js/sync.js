import { API } from './api.js';
import { $, $$ } from './utils.js';
import { log } from './log.js';
import { setSelectedLightId, setConfigLocked, getAllLights, populateLightSelect } from './rooms.js';

let syncConfig = null;

export async function loadSyncConfig() {
  try {
    syncConfig = await API.sync.config();
    setConfigLocked(syncConfig.allowChange === false);

    const select = $('#sync-source-select');
    if (select) {
      select.disabled = syncConfig.allowChange === false;
      if (syncConfig.hueDeviceId) {
        setSelectedLightId(syncConfig.hueDeviceId);
        select.value = syncConfig.hueDeviceId;
      }
    }

    const nanoleafConfig = await API.nanoleaf.config();
    if (nanoleafConfig.configured) {
      $('#min-brightness').value = nanoleafConfig.minBrightness;
      $('#max-brightness').value = nanoleafConfig.maxBrightness;
      $('#min-brightness-value').textContent = `${nanoleafConfig.minBrightness}%`;
      $('#max-brightness-value').textContent = `${nanoleafConfig.maxBrightness}%`;
      $('#brightness-range').textContent = `${nanoleafConfig.minBrightness}% - ${nanoleafConfig.maxBrightness}%`;
    }

    const status = await API.sync.status();
    updateSyncStatus(status);
  } catch (err) {
    log(`Error loading config: ${err.message}`, 'error');
  }
}

export function updateSyncStatus(status) {
  const statusEl = $('#sync-status');
  const lastEl = $('#sync-last');
  const colorPreview = $('#color-preview');
  const colorValue = $('#color-value');
  const btnToggle = $('#btn-sync-toggle');

  if (status.running) {
    statusEl.textContent = 'RUNNING';
    statusEl.classList.add('online');
    statusEl.classList.remove('offline');
    btnToggle.innerHTML = '<i data-lucide="square"></i>';
    btnToggle.title = 'Stop';
    btnToggle.classList.add('btn-stop');
    btnToggle.classList.remove('btn-start');
  } else {
    statusEl.textContent = 'STOPPED';
    statusEl.classList.add('offline');
    statusEl.classList.remove('online');
    btnToggle.innerHTML = '<i data-lucide="play"></i>';
    btnToggle.title = 'Start';
    btnToggle.classList.add('btn-start');
    btnToggle.classList.remove('btn-stop');
  }
  lucide.createIcons({ nodes: [btnToggle] });

  if (status.lastSync) {
    lastEl.textContent = new Date(status.lastSync).toLocaleTimeString();
  }

  if (status.currentColor) {
    const { r, g, b } = status.currentColor;
    colorPreview.style.backgroundColor = `rgb(${r}, ${g}, ${b})`;
    colorValue.textContent = `RGB(${r}, ${g}, ${b})`;
  }
}

export async function toggleSync() {
  const isRunning = $('#sync-status').textContent === 'RUNNING';
  if (isRunning) {
    await API.sync.stop();
  } else {
    const result = await API.sync.start();
    if (!result.success) {
      log(`Failed to start: ${result.error}`, 'error');
    }
  }
}

export async function onSourceSelectChange(e) {
  const select = e.target;
  const id = parseInt(select.value, 10);
  if (!id) {
    return;
  }

  const allLights = getAllLights();
  const light = allLights.find(l => l.id === id);
  if (!light) {
    return;
  }

  const previousId = select.dataset.previousValue;
  const confirmed = confirm(`Change sync source to "${light.name}"?`);

  if (!confirmed) {
    select.value = previousId || '';
    return;
  }

  setSelectedLightId(id);
  select.dataset.previousValue = id;

  $$('.light-item').forEach(item => {
    item.classList.toggle('selected', String(item.dataset.id) === String(id));
  });

  await API.sync.setConfig({ hueDeviceId: id, hueDeviceName: light.name });
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

  $('#min-brightness').addEventListener('input', (e) => {
    $('#min-brightness-value').textContent = `${e.target.value}%`;
  });

  $('#max-brightness').addEventListener('input', (e) => {
    $('#max-brightness-value').textContent = `${e.target.value}%`;
  });

  $('#min-brightness').addEventListener('change', async (e) => {
    await API.nanoleaf.updateConfig({ minBrightness: parseInt(e.target.value, 10) });
    updateBrightnessRange();
  });

  $('#max-brightness').addEventListener('change', async (e) => {
    await API.nanoleaf.updateConfig({ maxBrightness: parseInt(e.target.value, 10) });
    updateBrightnessRange();
  });
}
