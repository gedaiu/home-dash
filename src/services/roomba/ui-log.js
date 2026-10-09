let broadcastHandler = null;

function setBroadcast(handler) {
  broadcastHandler = handler;
}

function logToUI(message, level = 'info') {
  console.log(`[Roomba] ${message}`);
  broadcast('log', { source: 'Roomba', message, level });
}

function broadcast(type, payload) {
  if (broadcastHandler) {
    broadcastHandler({ type, data: payload });
  }
}

module.exports = { setBroadcast, logToUI, broadcast };
