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

// Read initial page from URL hash
function getPageFromHash() {
  const hash = window.location.hash.slice(1);
  const validPages = ['home', 'network', 'outside'];
  return validPages.includes(hash) ? hash : 'home';
}

export const currentPage = signal(getPageFromHash());

// Navigate to a page and update URL
export function navigateTo(page) {
  currentPage.value = page;
  window.history.pushState(null, '', `#${page}`);
}

// Handle browser back/forward
window.addEventListener('popstate', () => {
  currentPage.value = getPageFromHash();
});

// OpenWrt states
export const openwrtState = signal({
  routers: [],
  devices: [],
  connections: []
});

export const selectedDeviceMac = signal(null);
export const selectedCountry = signal(null);
export const selectedDestination = signal(null);

// Outside page states
export const weatherState = signal(null);
export const transportState = signal(null);

// Resolver state
export const resolverState = signal({
  total: 0,
  resolved: 0,
  pending: 0,
  inProgress: false
});

// Device customizations (keyed by MAC address)
export const deviceCustomizations = signal({});

// Device types available for selection
export const DEVICE_TYPES = [
  { id: 'unknown', label: 'Unknown', icon: 'help-circle' },
  { id: 'desktop', label: 'Desktop', icon: 'monitor' },
  { id: 'laptop', label: 'Laptop', icon: 'laptop' },
  { id: 'phone', label: 'Phone', icon: 'smartphone' },
  { id: 'tablet', label: 'Tablet', icon: 'tablet' },
  { id: 'tv', label: 'Smart TV', icon: 'tv' },
  { id: 'speaker', label: 'Speaker', icon: 'speaker' },
  { id: 'iot', label: 'IoT Device', icon: 'cpu' },
  { id: 'camera', label: 'Camera', icon: 'camera' },
  { id: 'printer', label: 'Printer', icon: 'printer' },
  { id: 'gaming', label: 'Gaming', icon: 'gamepad-2' },
  { id: 'ap', label: 'Access Point', icon: 'wifi' },
  { id: 'router', label: 'Router', icon: 'router' },
  { id: 'server', label: 'Server', icon: 'server' },
  { id: 'nas', label: 'NAS', icon: 'hard-drive' }
];

// Device colors available for selection
export const DEVICE_COLORS = [
  { id: 'default', label: 'Default', color: '#00d4aa' },
  { id: 'blue', label: 'Blue', color: '#4a9eff' },
  { id: 'purple', label: 'Purple', color: '#a855f7' },
  { id: 'pink', label: 'Pink', color: '#ec4899' },
  { id: 'red', label: 'Red', color: '#ef4444' },
  { id: 'orange', label: 'Orange', color: '#f97316' },
  { id: 'yellow', label: 'Yellow', color: '#eab308' },
  { id: 'green', label: 'Green', color: '#22c55e' },
  { id: 'teal', label: 'Teal', color: '#14b8a6' },
  { id: 'gray', label: 'Gray', color: '#6b7280' }
];

export async function loadDeviceCustomizations() {
  try {
    const response = await fetch('/api/devices');
    if (response.ok) {
      deviceCustomizations.value = await response.json();
    }
  } catch (e) {
    console.error('Failed to load device customizations:', e);
  }
}

export async function saveDeviceCustomization(mac, config) {
  try {
    const response = await fetch(`/api/devices/${encodeURIComponent(mac)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });
    if (response.ok) {
      const device = await response.json();
      deviceCustomizations.value = { ...deviceCustomizations.value, [mac]: device };
      return device;
    }
  } catch (e) {
    console.error('Failed to save device customization:', e);
  }
  return null;
}

// Find device customization by MAC address or hostname
// Devices with changing MACs can be matched by hostname
export function findDeviceCustomization(mac, hostname) {
  // First try exact MAC match
  if (mac && deviceCustomizations.value[mac]) {
    return deviceCustomizations.value[mac];
  }

  // Then try hostname match (for devices with changing MACs)
  if (hostname) {
    const normalizedHostname = hostname.toLowerCase();
    for (const custom of Object.values(deviceCustomizations.value)) {
      if (custom.hostname && custom.hostname.toLowerCase() === normalizedHostname) {
        return custom;
      }
    }
  }

  return null;
}

export function getDeviceCustomization(mac, hostname) {
  return findDeviceCustomization(mac, hostname);
}

export function getDeviceIcon(mac, hostname) {
  const custom = findDeviceCustomization(mac, hostname);
  if (custom?.type) {
    const deviceType = DEVICE_TYPES.find(t => t.id === custom.type);
    if (deviceType) {
      return deviceType.icon;
    }
  }
  return 'help-circle';
}

export function getDeviceColor(mac, hostname) {
  const custom = findDeviceCustomization(mac, hostname);
  if (custom?.color) {
    const deviceColor = DEVICE_COLORS.find(c => c.id === custom.color);
    if (deviceColor) {
      return deviceColor.color;
    }
  }
  return '#00d4aa';
}

export function getDeviceDisplayName(mac, hostname, fallback) {
  const custom = findDeviceCustomization(mac, hostname);
  return custom?.name || fallback;
}

export function isDeviceVerified(mac, hostname) {
  const custom = findDeviceCustomization(mac, hostname);
  return custom?.verified || false;
}

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

export function deletePanelDisplayName(panelKey) {
  const { [panelKey]: _, ...rest } = panelNames.value;
  panelNames.value = rest;
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
