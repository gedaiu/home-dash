const { getDeviceName } = require('./device-state');

let broadcastFn = null;

function logToUI(index, message, level = 'info') {
  const name = getDeviceName(index);
  console.log(`[AirPurifier] ${name}: ${message}`);

  if (broadcastFn) {
    broadcastFn({ type: 'log', data: { source: 'AirPurifier', message: `${name}: ${message}`, level } });
  }
}

function broadcast(type, payload) {
  if (broadcastFn) {
    broadcastFn({ type, data: payload });
  }
}

function setBroadcast(broadcastCallback) {
  broadcastFn = broadcastCallback;
}

function logError(index, message, err) {
  console.error(`${logPrefix(index)} ${message}`, err ? err.message : '');
}

function log(index, message) {
  console.log(`${logPrefix(index)} ${message}`);
}

function logPrefix(index) {
  return index === null ? '[airpurifier]' : `[airpurifier:${index}]`;
}

module.exports = { log, logError, logToUI, broadcast, setBroadcast };
