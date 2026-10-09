const crypto = require('crypto');
const storage = require('../storage');
const { coap, confirmableOptions } = require('./coap-client');
const { getBaseUrl, getConfig, getDeviceState, isConfigured } = require('./device-state');
const { log, logError } = require('./logging');
const { startObserving } = require('./observe');

const SYNC_TIMEOUT_MS = 60000;
const RESTORE_WAIT_MS = 3000;
const TOKEN_BYTES = 4;
const BASE_RETRY_DELAY_MS = 1000;
const MAX_RETRY_DELAY_MS = 30000;
const MAX_BACKOFF_EXPONENT = 5;
const MS_PER_SECOND = 1000;

async function connect(index) {
  if (!isConfigured(index)) {
    throw new Error('Air purifier not configured');
  }

  await sync(index);

  return getDeviceState(index).connected;
}

async function sync(index) {
  const baseUrl = getBaseUrl(index);

  if (!baseUrl) {
    throw new Error('Air purifier not configured');
  }

  const config = getConfig(index);
  let attempt = 0;

  while (true) {
    attempt++;
    log(index, `Syncing with device at ${config.ip}... (attempt ${attempt})`);

    try {
      return await syncOnce(index);
    } catch (err) {
      logError(index, `Sync attempt ${attempt} failed:`, err);
      await waitBeforeRetry(index, attempt);
      coap.reset(baseUrl);
    }
  }
}

async function syncOnce(index) {
  const baseUrl = getBaseUrl(index);
  const state = getDeviceState(index);

  coap.stopObserving(`${baseUrl}/sys/dev/status`);
  coap.reset(baseUrl);

  const requestPromise = coap.request(`${baseUrl}/sys/dev/sync`, 'post',
    Buffer.from(generateSyncToken(), 'utf-8'),
    confirmableOptions()
  );

  const response = await Promise.race([requestPromise, rejectAfter(SYNC_TIMEOUT_MS, 'Sync timeout')]);

  if (!response.payload) {
    throw new Error('Sync failed - no counter received');
  }

  state.counter = response.payload.toString('utf-8');
  state.connected = true;
  storage.setAirPurifierCounter(index, state.counter);
  log(index, `Sync successful, counter: ${state.counter}`);

  return state.counter;
}

async function disconnect(index) {
  const baseUrl = getBaseUrl(index);
  const state = getDeviceState(index);

  if (baseUrl) {
    try {
      coap.stopObserving(`${baseUrl}/sys/dev/status`);
      coap.reset(baseUrl);
    } catch {
      // Ignore errors during cleanup
    }
  }

  state.connected = false;
  state.observing = false;
  state.counter = null;
  state.status = null;
}

async function tryRestoreSession(index) {
  const savedCounter = storage.getAirPurifierCounter(index);

  if (!savedCounter) {
    return false;
  }

  const state = getDeviceState(index);
  log(index, `Trying to restore session with saved counter: ${savedCounter}`);

  try {
    state.counter = savedCounter;
    state.connected = true;

    await startObserving(index);
    await delay(RESTORE_WAIT_MS);

    return confirmRestoredSession(index, state);
  } catch (err) {
    logError(index, 'Session restore failed:', err);
    clearSession(index, state);

    return false;
  }
}

function confirmRestoredSession(index, state) {
  if (state.status && state.lastUpdate) {
    log(index, `Session restored successfully for ${getConfig(index).ip}`);

    return true;
  }

  log(index, 'Session restore failed - no status received, will do full sync');
  clearSession(index, state);
  coap.stopObserving(`${getBaseUrl(index)}/sys/dev/status`);

  return false;
}

function clearSession(index, state) {
  state.connected = false;
  state.counter = null;
  storage.setAirPurifierCounter(index, null);
}

async function waitBeforeRetry(index, attempt) {
  const retryDelayMs = backoffDelayMs(attempt);
  log(index, `Retrying in ${retryDelayMs / MS_PER_SECOND}s...`);
  await delay(retryDelayMs);
}

function backoffDelayMs(attempt) {
  const exponent = Math.min(attempt - 1, MAX_BACKOFF_EXPONENT);

  return Math.min(BASE_RETRY_DELAY_MS * Math.pow(2, exponent), MAX_RETRY_DELAY_MS);
}

function generateSyncToken() {
  const tokenBytes = crypto.randomBytes(TOKEN_BYTES);

  return tokenBytes.toString('hex').toUpperCase();
}

function rejectAfter(delayMs, message) {
  return new Promise((resolve, reject) => {
    setTimeout(() => reject(new Error(message)), delayMs);
  });
}

function delay(delayMs) {
  return new Promise(resolve => setTimeout(resolve, delayMs));
}

module.exports = { connect, disconnect, tryRestoreSession };
