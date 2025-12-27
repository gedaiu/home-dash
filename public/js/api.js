export const API = {
  hue: {
    discover: () => fetch('/api/hue/discover').then(r => r.json()),
    bridge: () => fetch('/api/hue/bridge').then(r => r.json()),
    pair: (ip) => fetch('/api/hue/bridge/pair', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ip })
    }).then(r => r.json()),
    remove: () => fetch('/api/hue/bridge', { method: 'DELETE' }).then(r => r.json()),
    rooms: () => fetch('/api/hue/rooms').then(r => r.json()),
    lights: () => fetch('/api/hue/lights').then(r => r.json())
  },

  nanoleaf: {
    discover: () => fetch('/api/nanoleaf/discover').then(r => r.json()),
    device: () => fetch('/api/nanoleaf/device').then(r => r.json()),
    pair: (ip, port) => fetch('/api/nanoleaf/device/pair', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ip, port })
    }).then(r => r.json()),
    remove: () => fetch('/api/nanoleaf/device', { method: 'DELETE' }).then(r => r.json()),
    config: () => fetch('/api/nanoleaf/config').then(r => r.json()),
    updateConfig: (config) => fetch('/api/nanoleaf/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    }).then(r => r.json())
  },

  sync: {
    config: () => fetch('/api/sync/config').then(r => r.json()),
    setConfig: (config) => fetch('/api/sync/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    }).then(r => r.json()),
    start: () => fetch('/api/sync/start', { method: 'POST' }).then(r => r.json()),
    stop: () => fetch('/api/sync/stop', { method: 'POST' }).then(r => r.json()),
    status: () => fetch('/api/sync/status').then(r => r.json())
  },

  homeconnect: {
    status: () => fetch('/api/homeconnect/status').then(r => r.json()),
    devices: () => fetch('/api/homeconnect/devices').then(r => r.json()),
    refresh: () => fetch('/api/homeconnect/refresh', { method: 'POST' }).then(r => r.json()),
    authUrl: () => fetch('/api/homeconnect/auth/url').then(r => r.json()),
    configure: (clientId, clientSecret) => fetch('/api/homeconnect/configure', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId, clientSecret })
    }).then(r => r.json()),
    disconnect: () => fetch('/api/homeconnect/disconnect', { method: 'DELETE' }).then(r => r.json())
  },

  roomba: {
    status: () => fetch('/api/roomba/status').then(r => r.json()),
    start: () => fetch('/api/roomba/start', { method: 'POST' }).then(r => r.json()),
    stop: () => fetch('/api/roomba/stop', { method: 'POST' }).then(r => r.json()),
    pause: () => fetch('/api/roomba/pause', { method: 'POST' }).then(r => r.json()),
    resume: () => fetch('/api/roomba/resume', { method: 'POST' }).then(r => r.json()),
    dock: () => fetch('/api/roomba/dock', { method: 'POST' }).then(r => r.json())
  },

  airpurifier: {
    devices: () => fetch('/api/airpurifier/devices').then(r => r.json()),
    status: (index) => fetch(`/api/airpurifier/devices/${index}/status`).then(r => r.json()),
    add: (ip, name) => fetch('/api/airpurifier/devices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ip, name })
    }).then(r => r.json()),
    remove: (index) => fetch(`/api/airpurifier/devices/${index}`, { method: 'DELETE' }).then(r => r.json()),
    connect: (index) => fetch(`/api/airpurifier/devices/${index}/connect`, { method: 'POST' }).then(r => r.json()),
    disconnect: (index) => fetch(`/api/airpurifier/devices/${index}/disconnect`, { method: 'POST' }).then(r => r.json()),
    power: (index, on) => fetch(`/api/airpurifier/devices/${index}/power`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ on })
    }).then(r => r.json()),
    mode: (index, mode) => fetch(`/api/airpurifier/devices/${index}/mode`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode })
    }).then(r => r.json()),
    fan: (index, speed) => fetch(`/api/airpurifier/devices/${index}/fan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ speed })
    }).then(r => r.json())
  },

  panels: {
    getNames: () => fetch('/api/panels/names').then(r => r.json()),
    setName: (key, name) => fetch(`/api/panels/names/${encodeURIComponent(key)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    }).then(r => r.json()),
    deleteName: (key) => fetch(`/api/panels/names/${encodeURIComponent(key)}`, {
      method: 'DELETE'
    }).then(r => r.json())
  }
};
