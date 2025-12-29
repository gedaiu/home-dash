const WebSocket = require('ws');
const url = require('url');
const syncService = require('./services/sync');
const hueService = require('./services/hue');
const homeconnectService = require('./services/homeconnect');
const roombaService = require('./services/roomba');
const airpurifierService = require('./services/airpurifier');
const openwrtService = require('./services/openwrt');
const weatherService = require('./services/weather');
const transportService = require('./services/transport');
const storage = require('./services/storage');
const geoip = require('./lib/geoip');

let wss = null;
const clients = new Set();

function init(server) {
  wss = new WebSocket.Server({ noServer: true });

  // Handle upgrade manually to support multiple WebSocket paths
  server.on('upgrade', (request, socket, head) => {
    const pathname = url.parse(request.url).pathname;

    if (pathname === '/ws/agent') {
      // OpenWrt agent connection
      wss.handleUpgrade(request, socket, head, (ws) => {
        openwrtService.handleAgentConnection(ws);
      });
    } else {
      // Default browser client connection
      wss.handleUpgrade(request, socket, head, (ws) => {
        handleClientConnection(ws);
      });
    }
  });

  syncService.setBroadcast(broadcast);
  hueService.setBroadcast(broadcast);
  homeconnectService.setBroadcast(broadcast);
  roombaService.setBroadcast(broadcast);
  airpurifierService.setBroadcast(broadcast);
  openwrtService.setBroadcast(broadcast);
  weatherService.setBroadcast(broadcast);
  transportService.setBroadcast(broadcast);
  hueService.startPolling();
  homeconnectService.startPolling();
  roombaService.startPolling();
  weatherService.startPolling();
  transportService.startPolling();

  storage.onConfigChange(handleConfigChange);
  storage.startWatching();
}

function handleClientConnection(ws) {
  clients.add(ws);

  ws.send(JSON.stringify({
    type: 'status',
    data: syncService.getStatus()
  }));

  // Send current openwrt state
  const openwrtState = openwrtService.getState();
  if (openwrtState.routers.length > 0) {
    ws.send(JSON.stringify({
      type: 'openwrt:status',
      data: openwrtState.routers
    }));
    ws.send(JSON.stringify({
      type: 'openwrt:devices',
      data: openwrtState.devices
    }));
    ws.send(JSON.stringify({
      type: 'openwrt:connections',
      data: openwrtState.connections
    }));
  }

  // Send current weather state
  const weatherState = weatherService.getStatus();
  if (weatherState) {
    ws.send(JSON.stringify({
      type: 'weather',
      data: weatherState
    }));
  }

  // Send current transport state
  const transportState = transportService.getStatus();
  if (transportState) {
    ws.send(JSON.stringify({
      type: 'transport',
      data: transportState
    }));
  }

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      handleMessage(ws, data);
    } catch {
      // Ignore invalid messages
    }
  });

  ws.on('close', () => {
    clients.delete(ws);
  });

  ws.on('error', () => {
    clients.delete(ws);
  });
}

function handleConfigChange(config) {
  console.log('[websocket] Config changed, reloading services...');

  hueService.stopPolling();
  homeconnectService.stopPolling();
  roombaService.stopPolling();
  airpurifierService.stopAllPolling();
  weatherService.stopPolling();
  transportService.stopPolling();

  hueService.startPolling();
  homeconnectService.startPolling();
  roombaService.startPolling();
  airpurifierService.startAllPolling();
  weatherService.startPolling();
  transportService.startPolling();

  broadcast({
    type: 'config_changed',
    data: { message: 'Configuration reloaded' }
  });

  broadcast({
    type: 'status',
    data: syncService.getStatus()
  });
}

function handleMessage(ws, data) {
  switch (data.type) {
    case 'ping':
      ws.send(JSON.stringify({ type: 'pong', timestamp: data.timestamp }));
      break;
    case 'subscribe':
      ws.send(JSON.stringify({
        type: 'status',
        data: syncService.getStatus()
      }));
      break;
    case 'resolver:status':
      ws.send(JSON.stringify({
        type: 'resolver:status',
        data: geoip.getResolverStatus()
      }));
      break;
    case 'resolver:start':
      geoip.resolveAllHostnames((progress) => {
        broadcast({
          type: 'resolver:progress',
          data: progress
        });
      }).then(() => {
        // Re-enrich connections with fresh GeoIP data including hostnames
        openwrtService.refreshConnectionEnrichment();
      });
      break;
  }
}

function broadcast(message) {
  const payload = JSON.stringify(message);

  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  }
}

function close() {
  hueService.stopPolling();
  homeconnectService.stopPolling();
  roombaService.stopPolling();
  airpurifierService.stopAllPolling();
  weatherService.stopPolling();
  transportService.stopPolling();
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
