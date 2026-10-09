const state = {
  routers: [],
  devices: [],
  connections: []
};

let broadcastFn = null;

function setBroadcast(broadcastHandler) {
  broadcastFn = broadcastHandler;
}

function broadcast(message) {
  if (broadcastFn) {
    broadcastFn(message);
  }
}

function logToUI(message, level = 'info') {
  console.log(`[OpenWrt] ${message}`);

  broadcast({ type: 'log', data: { source: 'OpenWrt', message, level } });
}

function getState() {
  return state;
}

function getRouters() {
  return state.routers;
}

const deviceMap = new Map();

function getDevices() {
  return Array.from(deviceMap.values());
}

const connectionMap = new Map();

function getConnections() {
  return Array.from(connectionMap.values());
}

const agents = new Map();

module.exports = {
  agents,
  connectionMap,
  deviceMap,
  state,
  setBroadcast,
  broadcast,
  logToUI,
  getState,
  getRouters,
  getDevices,
  getConnections
};
