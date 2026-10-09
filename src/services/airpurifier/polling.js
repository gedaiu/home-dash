const { getAllConfigs, getConfig, isConfigured } = require('./device-state');
const { log, logToUI, logError, broadcast } = require('./logging');
const { startObserving, stopObserving } = require('./observe');
const { connect, disconnect, tryRestoreSession } = require('./session');

async function startAllPolling() {
  const configs = getAllConfigs();
  log(null, `Starting polling for ${configs.length} device(s)...`);

  for (let i = 0; i < configs.length; i++) {
    await startPolling(i);
  }

  log(null, 'All devices polling started');
}

function stopAllPolling() {
  const configs = getAllConfigs();
  log(null, `Stopping polling for ${configs.length} device(s)...`);

  for (let i = 0; i < configs.length; i++) {
    stopPolling(i);
  }

  log(null, 'All devices polling stopped');
}

async function startPolling(index) {
  if (!isConfigured(index)) {
    log(index, 'Not configured, skipping');

    return;
  }

  const config = getConfig(index);
  log(index, `Starting polling for ${config.name || config.ip}...`);
  logToUI(index, 'Connecting...');

  if (await tryRestoreSession(index)) {
    log(index, 'Polling started successfully (restored session)');
    logToUI(index, 'Connected (restored session)');

    return;
  }

  await connectAndObserve(index);
}

function stopPolling(index) {
  log(index, 'Stopping polling...');
  stopObserving(index);
  disconnect(index);
  log(index, 'Polling stopped');
}

async function connectAndObserve(index) {
  try {
    await connect(index);
    await startObserving(index);
    log(index, 'Polling started successfully');
    logToUI(index, 'Connected');
  } catch (err) {
    logError(index, 'Failed to start polling:', err);
    logToUI(index, `Connection failed: ${err.message}`, 'error');
    broadcast('error', { service: `Air Purifier ${index + 1}`, message: err.message });
  }
}

module.exports = { startAllPolling, stopAllPolling, startPolling, stopPolling };
