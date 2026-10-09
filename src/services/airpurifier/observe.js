const philipsCoap = require('../../lib/philips-coap');
const { coap } = require('./coap-client');
const { getBaseUrl, getDeviceState } = require('./device-state');
const { log, logError, logToUI, broadcast } = require('./logging');
const { updatePm25History, getAllPm25Sensors } = require('./history');
const { getStatus } = require('./status');

async function startObserving(index) {
  const baseUrl = getBaseUrl(index);
  const state = getDeviceState(index);

  if (!baseUrl || !state.connected) {
    throw new Error('Not connected to air purifier');
  }

  if (state.observing) {
    log(index, 'Already observing, skipping');

    return;
  }

  log(index, 'Starting observation...');

  await coap.observe(`${baseUrl}/sys/dev/status`, 'get',
    response => handleStatusUpdate(index, response),
    '',
    { keepAlive: true, confirmable: false, retransmit: true }
  );

  state.observing = true;
  log(index, 'Observation started');
}

function stopObserving(index) {
  const baseUrl = getBaseUrl(index);

  if (baseUrl) {
    try {
      coap.stopObserving(`${baseUrl}/sys/dev/status`);
    } catch {
      // Ignore
    }
  }

  getDeviceState(index).observing = false;
}

function handleStatusUpdate(index, response) {
  if (!response.payload || response.payload.length === 0) {
    return;
  }

  try {
    applyStatusPayload(index, response.payload.toString('utf-8'));
  } catch (err) {
    logError(index, 'Decrypt error:', err);
    logToUI(index, `Decrypt error: ${err.message}`, 'error');
  }
}

function applyStatusPayload(index, hexPayload) {
  log(index, `Received status update (${hexPayload.length} chars)`);
  const decrypted = philipsCoap.decrypt(hexPayload);

  if (!decrypted) {
    return;
  }

  const state = getDeviceState(index);
  state.status = philipsCoap.parseStatus(decrypted);
  state.lastUpdate = new Date().toISOString();
  const { status } = state;
  log(index, `Status: pwr=${status.pwr}, pm25=${status.pm25}, iaql=${status.iaql}, mode=${status.mode}, model=${status.model}`);
  const pwrLabel = status.pwr === '1' ? 'ON' : 'OFF';
  logToUI(index, `${pwrLabel}, PM2.5: ${status.pm25}, AQI: ${status.iaql}`);
  updatePm25History(index, status.pm25);
  broadcast('airpurifier', { index, ...getStatus(index) });
  broadcast('pm25_sensors', getAllPm25Sensors());
}

module.exports = { startObserving, stopObserving };
