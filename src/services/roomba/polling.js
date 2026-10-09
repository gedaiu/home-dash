const { isConfigured } = require('./config');
const { disconnect } = require('./connection');
const { getStatus } = require('./status');
const { logToUI, broadcast } = require('./ui-log');

const POLL_INTERVAL_MS = 30000;

let pollTimer = null;

function startPolling() {
  if (pollTimer || !isConfigured()) {
    return;
  }

  logToUI('Starting polling (every 30s)');
  pollTimer = setInterval(pollRoomba, POLL_INTERVAL_MS);
  pollRoomba();
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }

  disconnect();
}

async function pollRoomba() {
  if (!isConfigured()) {
    return;
  }

  try {
    const status = await getStatus();

    if (!status) {
      return;
    }

    logStatus(status);
    broadcast('roomba', status);
  } catch (err) {
    logToUI(`Poll error: ${err.message}`, 'error');
  }
}

function logStatus(status) {
  if (status.connected) {
    logToUI(`${status.name}: ${describeReadings(status)}`);

    return;
  }

  if (status.error) {
    logToUI(`${status.name}: ${status.error}`, 'warning');
  }
}

function describeReadings(status) {
  const phase = status.mission?.phase || 'unknown';
  const percent = status.battery?.percent || '?';

  return `${phase}, battery ${percent}%`;
}

module.exports = { startPolling, stopPolling };
