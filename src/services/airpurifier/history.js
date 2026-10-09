const { getConfig, getAllConfigs, getDeviceState, getDeviceName } = require('./device-state');

const SENSOR_PREFIX = 'airpurifier_';
const SAVE_DELAY_MS = 5000;
const DISPLAY_HISTORY_LENGTH = 100;
const TIMESTAMP_KEY = 't';
const VALUE_KEY = 'v';

const pm25History = new Map();
const pm25DailyStats = new Map();
let saveTimeout = null;

const storage = require('../storage');

restoreSavedData(storage.loadSensorData());

function restoreSavedData(savedData) {
  restoreHistory(savedData.history || {});
  restoreDailyStats(savedData.dailyStats || {});

  if (pm25History.size > 0) {
    console.log(`[airpurifier] Loaded ${pm25History.size} sensor history from disk`);
  }
}

function restoreHistory(savedHistory) {
  for (const [sensorId, entries] of Object.entries(savedHistory)) {
    if (sensorId.startsWith(SENSOR_PREFIX) && entries && entries.length > 0) {
      pm25History.set(sensorId, entries);
    }
  }
}

function restoreDailyStats(savedStats) {
  for (const [key, stats] of Object.entries(savedStats)) {
    if (key.startsWith(SENSOR_PREFIX) && stats) {
      pm25DailyStats.set(key, stats);
    }
  }
}

function updatePm25History(index, pm25Value) {
  if (pm25Value === null || pm25Value === undefined) {
    return undefined;
  }

  const sensorId = sensorIdFor(index);
  const history = getOrCreateHistory(sensorId);
  recordHistoryEntry(history, pm25Value);

  return {
    history: history.slice(-DISPLAY_HISTORY_LENGTH),
    dailyStats: recordDailyStats(sensorId, pm25Value)
  };
}

function getAllPm25Sensors() {
  return getAllConfigs()
    .map((deviceConfig, index) => getPm25Sensor(index))
    .filter(sensor => sensor.state.pm25 !== null);
}

function getPm25Sensor(index) {
  const sensorId = sensorIdFor(index);
  const state = getDeviceState(index);
  const history = pm25History.get(sensorId) || [];
  const stats = pm25DailyStats.get(dailyStatsKey(sensorId));

  return {
    id: sensorId,
    name: `${getDeviceName(index)} PM2.5`,
    category: 'pm25',
    state: {
      pm25: state.status?.pm25 ?? null,
      lastupdated: state.lastUpdate
    },
    history: history.slice(-DISPLAY_HISTORY_LENGTH),
    dailyStats: stats || null
  };
}

function recordDailyStats(sensorId, pm25Value) {
  const statsKey = dailyStatsKey(sensorId);
  const existing = pm25DailyStats.get(statsKey);

  if (!existing) {
    const created = { min: pm25Value, max: pm25Value, date: getToday() };
    pm25DailyStats.set(statsKey, created);

    return created;
  }

  if (pm25Value < existing.min) {
    existing.min = pm25Value;
  }

  if (pm25Value > existing.max) {
    existing.max = pm25Value;
  }

  return existing;
}

function recordHistoryEntry(history, pm25Value) {
  const lastEntry = history[history.length - 1];

  if (lastEntry && lastEntry[VALUE_KEY] === pm25Value) {
    return;
  }

  history.push({ [TIMESTAMP_KEY]: Date.now(), [VALUE_KEY]: pm25Value });
  scheduleSave();
}

function scheduleSave() {
  if (saveTimeout) {
    return;
  }

  saveTimeout = setTimeout(() => {
    storage.saveSensorData(Object.fromEntries(pm25History), Object.fromEntries(pm25DailyStats));
    saveTimeout = null;
  }, SAVE_DELAY_MS);
}

function getOrCreateHistory(sensorId) {
  if (!pm25History.has(sensorId)) {
    pm25History.set(sensorId, []);
  }

  return pm25History.get(sensorId);
}

function dailyStatsKey(sensorId) {
  return `${sensorId}_${getToday()}`;
}

function sensorIdFor(index) {
  return `${SENSOR_PREFIX}${index}_pm25`;
}

function getToday() {
  const isoTimestamp = new Date().toISOString();

  return isoTimestamp.split('T')[0];
}

module.exports = { updatePm25History, getAllPm25Sensors };
