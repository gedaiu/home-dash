const { CoapClient: coap } = require('node-coap-client');
const crypto = require('crypto');
const storage = require('./storage');
const philipsCoap = require('../lib/philips-coap');

const COAP_PORT = 5683;
const DISPLAY_HISTORY_LENGTH = 100;

const devices = new Map();
const pm25History = new Map();
const pm25DailyStats = new Map();

const savedData = storage.loadSensorData();
for (const [sensorId, entries] of Object.entries(savedData.history || {})) {
  if (sensorId.startsWith('airpurifier_') && entries && entries.length > 0) {
    pm25History.set(sensorId, entries);
  }
}
for (const [key, stats] of Object.entries(savedData.dailyStats || {})) {
  if (key.startsWith('airpurifier_') && stats) {
    pm25DailyStats.set(key, stats);
  }
}
if (pm25History.size > 0) {
  console.log(`[airpurifier] Loaded ${pm25History.size} sensor history from disk`);
}

let broadcastFn = null;
let saveTimeout = null;

function scheduleSave() {
  if (saveTimeout) {
    return;
  }

  saveTimeout = setTimeout(() => {
    const historyObj = {};
    const statsObj = {};
    for (const [key, value] of pm25History) {
      historyObj[key] = value;
    }
    for (const [key, value] of pm25DailyStats) {
      statsObj[key] = value;
    }
    storage.saveSensorData(historyObj, statsObj);
    saveTimeout = null;
  }, 5000);
}

function getToday() {
  return new Date().toISOString().split('T')[0];
}

function updatePm25History(index, pm25Value) {
  if (pm25Value === null || pm25Value === undefined) {
    return;
  }

  const sensorId = `airpurifier_${index}_pm25`;

  if (!pm25History.has(sensorId)) {
    pm25History.set(sensorId, []);
  }

  const history = pm25History.get(sensorId);
  const lastEntry = history[history.length - 1];
  const now = Date.now();

  if (!lastEntry || lastEntry.v !== pm25Value) {
    history.push({ t: now, v: pm25Value });
    scheduleSave();
  }

  const today = getToday();
  const statsKey = `${sensorId}_${today}`;
  let stats = pm25DailyStats.get(statsKey);

  if (!stats) {
    stats = { min: pm25Value, max: pm25Value, date: today };
    pm25DailyStats.set(statsKey, stats);
  } else {
    if (pm25Value < stats.min) {
      stats.min = pm25Value;
    }
    if (pm25Value > stats.max) {
      stats.max = pm25Value;
    }
  }

  return {
    history: history.slice(-DISPLAY_HISTORY_LENGTH),
    dailyStats: stats
  };
}

function getPm25Sensor(index) {
  const config = getConfig(index);
  const state = getDeviceState(index);
  const sensorId = `airpurifier_${index}_pm25`;
  const today = getToday();
  const statsKey = `${sensorId}_${today}`;

  const history = pm25History.get(sensorId) || [];
  const stats = pm25DailyStats.get(statsKey);

  return {
    id: sensorId,
    name: (config?.name || `Purifier ${index + 1}`) + ' PM2.5',
    category: 'pm25',
    state: {
      pm25: state.status?.pm25 ?? null,
      lastupdated: state.lastUpdate
    },
    history: history.slice(-DISPLAY_HISTORY_LENGTH),
    dailyStats: stats || null
  };
}

function getAllPm25Sensors() {
  const configs = getAllConfigs();
  return configs.map((_, index) => getPm25Sensor(index)).filter(s => s.state.pm25 !== null);
}

function log(index, message) {
  const prefix = index !== null ? `[airpurifier:${index}]` : '[airpurifier]';
  console.log(`${prefix} ${message}`);
}

function logError(index, message, err) {
  const prefix = index !== null ? `[airpurifier:${index}]` : '[airpurifier]';
  console.error(`${prefix} ${message}`, err ? err.message : '');
}

function setBroadcast(fn) {
  broadcastFn = fn;
}

function broadcast(type, data) {
  if (broadcastFn) {
    broadcastFn({ type, data });
  }
}

function getDeviceState(index) {
  if (!devices.has(index)) {
    devices.set(index, {
      connected: false,
      counter: null,
      status: null,
      lastUpdate: null,
      observing: false
    });
  }
  return devices.get(index);
}

function getConfig(index) {
  return storage.getAirPurifier(index);
}

function getAllConfigs() {
  return storage.getAirPurifiers();
}

function isConfigured(index) {
  const config = getConfig(index);
  return !!(config?.ip);
}

function getBaseUrl(index) {
  const config = getConfig(index);
  if (!config?.ip) {
    return null;
  }
  return `coap://${config.ip}:${COAP_PORT}`;
}

async function getDeviceInfo(index) {
  const baseUrl = getBaseUrl(index);
  if (!baseUrl) {
    throw new Error('Air purifier not configured');
  }

  const response = await coap.request(`${baseUrl}/sys/dev/info`, 'get', null, {
    keepAlive: true,
    confirmable: true,
    retransmit: true
  });

  if (response.payload) {
    return JSON.parse(response.payload.toString());
  }

  return null;
}

async function syncOnce(index) {
  const baseUrl = getBaseUrl(index);
  const state = getDeviceState(index);

  coap.stopObserving(`${baseUrl}/sys/dev/status`);
  coap.reset(baseUrl);

  const token = crypto.randomBytes(4).toString('hex').toUpperCase();

  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Sync timeout')), 60000);
  });

  const requestPromise = coap.request(`${baseUrl}/sys/dev/sync`, 'post',
    Buffer.from(token, 'utf-8'),
    { keepAlive: true, confirmable: true, retransmit: true }
  );

  const response = await Promise.race([requestPromise, timeoutPromise]);

  if (response.payload) {
    state.counter = response.payload.toString('utf-8');
    state.connected = true;
    storage.setAirPurifierCounter(index, state.counter);
    log(index, `Sync successful, counter: ${state.counter}`);
    return state.counter;
  }

  throw new Error('Sync failed - no counter received');
}

async function tryRestoreSession(index) {
  const savedCounter = storage.getAirPurifierCounter(index);
  if (!savedCounter) {
    return false;
  }

  const baseUrl = getBaseUrl(index);
  const state = getDeviceState(index);
  const config = getConfig(index);

  log(index, `Trying to restore session with saved counter: ${savedCounter}`);

  try {
    state.counter = savedCounter;
    state.connected = true;

    await startObserving(index);

    await new Promise(resolve => setTimeout(resolve, 3000));

    if (state.status && state.lastUpdate) {
      log(index, `Session restored successfully for ${config.ip}`);
      return true;
    }

    log(index, 'Session restore failed - no status received, will do full sync');
    state.connected = false;
    state.counter = null;
    coap.stopObserving(`${baseUrl}/sys/dev/status`);
    return false;
  } catch (err) {
    logError(index, 'Session restore failed:', err);
    state.connected = false;
    state.counter = null;
    return false;
  }
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

      const delay = Math.min(1000 * Math.pow(2, Math.min(attempt - 1, 5)), 30000);
      log(index, `Retrying in ${delay / 1000}s...`);
      await new Promise(resolve => setTimeout(resolve, delay));

      coap.reset(baseUrl);
    }
  }
}

async function connect(index) {
  if (!isConfigured(index)) {
    throw new Error('Air purifier not configured');
  }

  await sync(index);
  return getDeviceState(index).connected;
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
    (response) => {
      if (response.payload && response.payload.length > 0) {
        try {
          const hexPayload = response.payload.toString('utf-8');
          log(index, `Received status update (${hexPayload.length} chars)`);
          const data = philipsCoap.decrypt(hexPayload);
          if (data) {
            state.status = philipsCoap.parseStatus(data);
            state.lastUpdate = new Date().toISOString();
            log(index, `Status: pwr=${state.status.pwr}, pm25=${state.status.pm25}, iaql=${state.status.iaql}, mode=${state.status.mode}, model=${state.status.model}`);
            updatePm25History(index, state.status.pm25);
            broadcast('airpurifier', { index, ...getStatus(index) });
            broadcast('pm25_sensors', getAllPm25Sensors());
          }
        } catch (err) {
          logError(index, 'Decrypt error:', err);
        }
      }
    },
    '',
    { keepAlive: true, confirmable: false, retransmit: true }
  );

  state.observing = true;
  log(index, 'Observation started');
}

function stopObserving(index) {
  const baseUrl = getBaseUrl(index);
  const state = getDeviceState(index);

  if (baseUrl) {
    try {
      coap.stopObserving(`${baseUrl}/sys/dev/status`);
    } catch {
      // Ignore
    }
  }
  state.observing = false;
}

async function sendCommand(index, key, value) {
  const baseUrl = getBaseUrl(index);
  const state = getDeviceState(index);

  if (!baseUrl) {
    throw new Error('Air purifier not configured');
  }

  if (!state.connected || !state.counter) {
    await connect(index);
  }

  state.counter = philipsCoap.incrementCounter(state.counter);

  const command = philipsCoap.buildCommand(key, value);
  const encrypted = philipsCoap.encrypt(command, state.counter);

  log(index, `Sending command: ${key}=${value}`);
  log(index, `Command payload: ${JSON.stringify(command)}`);
  log(index, `Using counter: ${state.counter}`);

  const response = await coap.request(`${baseUrl}/sys/dev/control`, 'post',
    Buffer.from(encrypted, 'utf-8'),
    { keepAlive: true, confirmable: true, retransmit: true }
  );

  const success = response.code?.major === 2;
  log(index, `Response: code=${response.code?.major}.${response.code?.minor}, success=${success}`);

  return success;
}

async function setPower(index, on) {
  return sendCommand(index, 'pwr', on ? '1' : '0');
}

async function setFanSpeed(index, speed) {
  const validSpeeds = ['1', '2', '3', 's', 't'];
  const speedStr = String(speed).toLowerCase();
  if (!validSpeeds.includes(speedStr)) {
    throw new Error(`Invalid fan speed: ${speed}. Valid: 1, 2, 3, s (sleep), t (turbo)`);
  }
  return sendCommand(index, 'om', speedStr);
}

async function setMode(index, mode) {
  const validModes = ['M', 'P', 'A', 'AG', 'GT', 'T', 'S', 'B'];
  const modeUpper = String(mode).toUpperCase();
  if (!validModes.includes(modeUpper)) {
    throw new Error(`Invalid mode: ${mode}. Valid: M (manual), P (auto), AG (allergen), GT (gentle), T (turbo), S (sleep)`);
  }
  return sendCommand(index, 'mode', modeUpper);
}

async function setChildLock(index, on) {
  return sendCommand(index, 'cl', on);
}

async function setLight(index, brightness) {
  const bri = Math.max(0, Math.min(100, Math.round(brightness)));
  return sendCommand(index, 'aqil', bri);
}

async function setButtonLight(index, on) {
  return sendCommand(index, 'uil', on ? '1' : '0');
}

function getStatus(index) {
  const config = getConfig(index);
  const state = getDeviceState(index);

  if (!config) {
    return {
      index,
      configured: false
    };
  }

  return {
    index,
    configured: true,
    connected: state.connected,
    observing: state.observing,
    lastUpdate: state.lastUpdate,
    device: {
      ip: config.ip,
      name: config.name || state.status?.name,
      model: config.model || state.status?.model
    },
    ...state.status
  };
}

function getAllStatuses() {
  const configs = getAllConfigs();
  return configs.map((_, index) => getStatus(index));
}

async function configure(ip, customName) {
  const testUrl = `coap://${ip}:${COAP_PORT}`;

  try {
    const response = await coap.request(`${testUrl}/sys/dev/info`, 'get', null, {
      keepAlive: true,
      confirmable: true,
      retransmit: true
    });

    if (!response.payload) {
      throw new Error('No response from device');
    }

    const info = JSON.parse(response.payload.toString());

    const index = storage.addAirPurifier({
      ip,
      name: customName || info.name,
      model: info.modelid
    });

    coap.reset(testUrl);

    return {
      success: true,
      index,
      device: {
        ip,
        name: info.name,
        model: info.modelid,
        type: info.type
      }
    };
  } catch (err) {
    coap.reset(testUrl);
    throw new Error(`Failed to connect to air purifier at ${ip}: ${err.message}`);
  }
}

function remove(index) {
  disconnect(index);
  storage.removeAirPurifier(index);
  devices.delete(index);
}

async function startPolling(index) {
  if (!isConfigured(index)) {
    log(index, 'Not configured, skipping');
    return;
  }

  const config = getConfig(index);
  log(index, `Starting polling for ${config.name || config.ip}...`);

  const restored = await tryRestoreSession(index);
  if (restored) {
    log(index, 'Polling started successfully (restored session)');
    return;
  }

  try {
    await connect(index);
    await startObserving(index);
    log(index, 'Polling started successfully');
  } catch (err) {
    logError(index, 'Failed to start polling:', err);
    broadcast('error', { service: `Air Purifier ${index + 1}`, message: err.message });
  }
}

function stopPolling(index) {
  log(index, 'Stopping polling...');
  stopObserving(index);
  disconnect(index);
  log(index, 'Polling stopped');
}

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

module.exports = {
  isConfigured,
  getConfig,
  getAllConfigs,
  configure,
  remove,
  connect,
  disconnect,
  getDeviceInfo,
  getStatus,
  getAllStatuses,
  startPolling,
  stopPolling,
  startAllPolling,
  stopAllPolling,
  setPower,
  setFanSpeed,
  setMode,
  setChildLock,
  setLight,
  setButtonLight,
  setBroadcast,
  getAllPm25Sensors
};
