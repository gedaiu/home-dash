const WebSocket = require('ws');
const syncService = require('./services/sync');

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
}

function handleMessage(ws, data) {
  switch (data.type) {
    case 'ping':
      ws.send(JSON.stringify({ type: 'pong' }));
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

module.exports = { init, broadcast };
