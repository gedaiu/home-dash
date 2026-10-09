const websocketLib = require('ws');
const url = require('url');
const PERIODIC_SERVICES = require('./lib/periodic-services');
const syncService = require('./services/sync');
const airpurifierService = require('./services/airpurifier');
const openwrtService = require('./services/openwrt');

const AGENT_PATH = '/ws/agent';
const BROADCASTING_SERVICES = [syncService, airpurifierService, openwrtService, ...PERIODIC_SERVICES];

let wss = null;
const clients = new Set();

const storage = require('./services/storage');

function init(server) {
  wss = new websocketLib.Server({ noServer: true });
  server.on('upgrade', routeUpgrade);

  BROADCASTING_SERVICES.forEach((service) => service.setBroadcast(broadcast));
  PERIODIC_SERVICES.forEach((service) => service.startPolling());

  storage.onConfigChange(handleConfigChange);
  storage.startWatching();
}

function routeUpgrade(request, socket, head) {
  const { pathname } = url.parse(request.url);
  const isAgent = pathname === AGENT_PATH;

  wss.handleUpgrade(request, socket, head, (connection) => {
    return isAgent ? openwrtService.handleAgentConnection(connection) : handleClientConnection(connection);
  });
}

function handleClientConnection(connection) {
  clients.add(connection);

  buildInitialMessages().forEach((message) => connection.send(JSON.stringify(message)));

  connection.on('message', (raw) => handleRawMessage(connection, raw));
  connection.on('close', () => clients.delete(connection));
  connection.on('error', () => clients.delete(connection));
}

const weatherService = require('./services/weather');
const transportService = require('./services/transport');

function buildInitialMessages() {
  return [
    ...toMessages('status', syncService.getStatus()),
    ...buildOpenwrtMessages(openwrtService.getState()),
    ...toMessages('weather', weatherService.getStatus()),
    ...toMessages('transport', transportService.getStatus())
  ];
}

function buildOpenwrtMessages(openwrtState) {
  if (openwrtState.routers.length === 0) {
    return [];
  }

  return [
    ...toMessages('openwrt:status', openwrtState.routers),
    ...toMessages('openwrt:devices', openwrtState.devices),
    ...toMessages('openwrt:connections', openwrtState.connections)
  ];
}

function toMessages(type, payload) {
  return payload ? [{ type, data: payload }] : [];
}

function handleRawMessage(connection, raw) {
  try {
    handleMessage(connection, JSON.parse(raw));
  } catch {
    // Ignore invalid messages
  }
}

const geoip = require('./lib/geoip');

const MESSAGE_HANDLERS = new Map([
  ['ping', (connection, message) => {
    connection.send(JSON.stringify({ type: 'pong', timestamp: message.timestamp }));
  }],
  ['subscribe', (connection) => {
    connection.send(JSON.stringify({ type: 'status', data: syncService.getStatus() }));
  }],
  ['resolver:status', (connection) => {
    connection.send(JSON.stringify({ type: 'resolver:status', data: geoip.getResolverStatus() }));
  }],
  ['resolver:start', startResolver]
]);

function handleMessage(connection, message) {
  const handler = MESSAGE_HANDLERS.get(message.type);

  if (handler) {
    handler(connection, message);
  }
}

function startResolver() {
  geoip.resolveAllHostnames((progress) => {
    broadcast({ type: 'resolver:progress', data: progress });
  }).then(() => {
    openwrtService.refreshConnectionEnrichment();
  });
}

function handleConfigChange() {
  console.log('[websocket] Config changed, reloading services...');

  PERIODIC_SERVICES.forEach((service) => service.stopPolling());
  airpurifierService.stopAllPolling();

  PERIODIC_SERVICES.forEach((service) => service.startPolling());
  airpurifierService.startAllPolling();

  broadcast({
    type: 'config_changed',
    data: { message: 'Configuration reloaded' }
  });

  broadcast({
    type: 'status',
    data: syncService.getStatus()
  });
}

function broadcast(message) {
  const payload = JSON.stringify(message);

  for (const client of clients) {
    if (client.readyState === websocketLib.OPEN) {
      client.send(payload);
    }
  }
}

function close() {
  PERIODIC_SERVICES.forEach((service) => service.stopPolling());
  airpurifierService.stopAllPolling();
  storage.stopWatching();

  for (const client of clients) {
    client.terminate();
  }

  clients.clear();

  if (wss) {
    wss.close();
  }
}

module.exports = { init, broadcast, close };
