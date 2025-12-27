import { signal } from 'https://esm.sh/@preact/signals@1.2.1';

// Device states
export const roombaState = signal(null);
export const airPurifierState = signal([]);
export const homeConnectState = signal([]);
export const hueState = signal(null);
export const nanoleafState = signal(null);
export const roomsState = signal([]);
export const syncState = signal(null);

// UI states
export const logs = signal([]);
export const panelNames = signal({});
export const wsConnected = signal(false);
export const wsLatency = signal(null);

// Log management
export function addLog(message, type = '') {
  const time = new Date().toLocaleTimeString();
  const newLogs = [...logs.value, { time, message, type }];
  if (newLogs.length > 100) {
    newLogs.shift();
  }
  logs.value = newLogs;
}

export function clearLogs() {
  logs.value = [];
  addLog('Log cleared');
}

// Panel name management
export function getPanelDisplayName(panelKey, defaultName) {
  return panelNames.value[panelKey] || defaultName;
}

export function setPanelDisplayName(panelKey, name) {
  panelNames.value = { ...panelNames.value, [panelKey]: name };
  localStorage.setItem('panelNames', JSON.stringify(panelNames.value));
}

export function loadPanelNames() {
  try {
    const stored = localStorage.getItem('panelNames');
    if (stored) {
      panelNames.value = JSON.parse(stored);
    }
  } catch (e) {
    console.error('Failed to load panel names:', e);
  }
}
