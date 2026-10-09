let broadcastCallback = null;

function setBroadcast(callback) {
  broadcastCallback = callback;
}

function broadcast(type, payload) {
  console.log('[HomeConnect] Broadcasting:', type, JSON.stringify(payload, null, 2));

  if (broadcastCallback) {
    broadcastCallback({ type, data: payload });
  }
}

function logToUI(message, level = 'info') {
  console.log(`[HomeConnect] ${message}`);

  if (broadcastCallback) {
    broadcastCallback({ type: 'log', data: { source: 'HomeConnect', message, level } });
  }
}

module.exports = { setBroadcast, broadcast, logToUI };
