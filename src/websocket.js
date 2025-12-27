const WebSocket = require('ws');
const syncService = require('./services/sync');
const hueService = require('./services/hue');
const homeconnectService = require('./services/homeconnect');
const roombaService = require('./services/roomba');
const airpurifierService = require('./services/airpurifier');
const storage = require('./services/storage');

let wss = null;
const clients = new Set();

function init(server) {
  wss = new WebSocket.Server({ server });

  wss.on('connection', (ws) => {
    clients.add(ws);

    ws.send(JSON.stringify({
      type: 'status',
      data: syncService.getStatus()
    }));

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
  });

  syncService.setBroadcast(broadcast);
  hueService.setBroadcast(broadcast);
  homeconnectService.setBroadcast(broadcast);
  roombaService.setBroadcast(broadcast);
  airpurifierService.setBroadcast(broadcast);
  hueService.startPolling();
  homeconnectService.startPolling();
  roombaService.startPolling();

  storage.onConfigChange(handleConfigChange);
  storage.startWatching();
}

function handleConfigChange(config) {
  console.log('[websocket] Config changed, reloading services...');

  hueService.stopPolling();
  homeconnectService.stopPolling();
  roombaService.stopPolling();
  airpurifierService.stopAllPolling();

  hueService.startPolling();
  homeconnectService.startPolling();
  roombaService.startPolling();
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
