const REQUEST_TIMEOUT_MS = 15000;

export const API = {
  hue: {
    discover: () => request('/api/hue/discover'),
    bridge: () => request('/api/hue/bridge'),
    pair: (ipAddress) => request('/api/hue/bridge/pair', jsonOptions('POST', { 'ip': ipAddress })),
    remove: () => request('/api/hue/bridge', { method: 'DELETE' }),
    rooms: () => request('/api/hue/rooms'),
    lights: () => request('/api/hue/lights')
  },

  nanoleaf: {
    discover: () => request('/api/nanoleaf/discover'),
    device: () => request('/api/nanoleaf/device'),
    pair: (ipAddress, port) => request('/api/nanoleaf/device/pair', jsonOptions('POST', { 'ip': ipAddress, port })),
    remove: () => request('/api/nanoleaf/device', { method: 'DELETE' }),
    config: () => request('/api/nanoleaf/config'),
    updateConfig: (config) => request('/api/nanoleaf/config', jsonOptions('PUT', config))
  },

  sync: {
    config: () => request('/api/sync/config'),
    setConfig: (config) => request('/api/sync/config', jsonOptions('PUT', config)),
    start: () => request('/api/sync/start', { method: 'POST' }),
    stop: () => request('/api/sync/stop', { method: 'POST' }),
    status: () => request('/api/sync/status')
  },

  homeconnect: {
    status: () => request('/api/homeconnect/status'),
    devices: () => request('/api/homeconnect/devices'),
    refresh: () => request('/api/homeconnect/refresh', { method: 'POST' }),
    authUrl: () => request('/api/homeconnect/auth/url'),
    configure: (clientId, clientSecret) => request('/api/homeconnect/configure', jsonOptions('POST', { clientId, clientSecret })),
    disconnect: () => request('/api/homeconnect/disconnect', { method: 'DELETE' })
  },

  roomba: {
    status: () => request('/api/roomba/status'),
    start: () => request('/api/roomba/start', { method: 'POST' }),
    stop: () => request('/api/roomba/stop', { method: 'POST' }),
    pause: () => request('/api/roomba/pause', { method: 'POST' }),
    resume: () => request('/api/roomba/resume', { method: 'POST' }),
    dock: () => request('/api/roomba/dock', { method: 'POST' })
  },

  airpurifier: {
    devices: () => request('/api/airpurifier/devices'),
    status: (index) => request(`/api/airpurifier/devices/${index}/status`),
    add: (ipAddress, name) => request('/api/airpurifier/devices', jsonOptions('POST', { 'ip': ipAddress, name })),
    remove: (index) => request(`/api/airpurifier/devices/${index}`, { method: 'DELETE' }),
    connect: (index) => request(`/api/airpurifier/devices/${index}/connect`, { method: 'POST' }),
    disconnect: (index) => request(`/api/airpurifier/devices/${index}/disconnect`, { method: 'POST' }),
    power: (index, isOn) => request(`/api/airpurifier/devices/${index}/power`, jsonOptions('POST', { 'on': isOn })),
    mode: (index, mode) => request(`/api/airpurifier/devices/${index}/mode`, jsonOptions('POST', { mode })),
    fan: (index, speed) => request(`/api/airpurifier/devices/${index}/fan`, jsonOptions('POST', { speed }))
  },

  panels: {
    getNames: () => request('/api/panels/names'),
    setName: (key, name) => request(`/api/panels/names/${encodeURIComponent(key)}`, jsonOptions('PUT', { name })),
    deleteName: (key) => request(`/api/panels/names/${encodeURIComponent(key)}`, { method: 'DELETE' })
  }
};

async function request(url, options = {}) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });

  return response.json();
}

function jsonOptions(method, payload) {
  return {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  };
}
