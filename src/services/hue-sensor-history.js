const storage = require('./storage');

const DISPLAY_HISTORY_LENGTH = 2880;
const SAVE_DELAY_MS = 5000;

const savedSensorData = storage.loadSensorData();
const sensorHistory = savedSensorData.history || {};
const sensorDailyStats = savedSensorData.dailyStats || {};
const displayHistory = {};
const latestSensorReadings = new Map();
let saveTimeout = null;

for (const [sensorId, entries] of Object.entries(sensorHistory)) {
  if (entries && entries.length > 0) {
    displayHistory[sensorId] = entries.slice(-DISPLAY_HISTORY_LENGTH).map(entry => entry.v);
  }
}

const SENSOR_VALUE_READERS = new Map([
  ['temperature', state => definedOrNull(state.temperature)],
  ['motion', state => (state.presence ? 1 : 0)],
  ['lightlevel', state => definedOrNull(state.lightlevel)]
]);

function sensorValue(category, state) {
  const readValue = SENSOR_VALUE_READERS.get(category);

  return readValue ? readValue(state) : null;
}

function getSensorReadings() {
  return [...latestSensorReadings.entries()].map(([id, reading]) => ({ id, ...reading }));
}

function recordLatestReading(sensorId, reading) {
  if (reading.value !== null) {
    latestSensorReadings.set(sensorId, reading);
  }
}

function updateSensorHistory(sensorId, category, state) {
  const value = sensorValue(category, state);

  if (value === null) {
    return { history: displayHistory[sensorId] || [], dailyStats: null };
  }

  appendDisplayValue(sensorId, value);
  appendPersistedValue(sensorId, value);

  const dailyStats = category === 'temperature' ? updateDailyStats(sensorId, value) : null;

  return { history: sensorHistory[sensorId], dailyStats };
}

function appendDisplayValue(sensorId, value) {
  displayHistory[sensorId] ??= [];

  const values = displayHistory[sensorId];

  values.push(value);

  if (values.length > DISPLAY_HISTORY_LENGTH) {
    values.shift();
  }
}

function appendPersistedValue(sensorId, value) {
  sensorHistory[sensorId] ??= [];

  const entries = sensorHistory[sensorId];
  const lastEntry = entries.at(-1);

  if (lastEntry && lastEntry.v === value) {
    return;
  }

  entries.push({ 't': Date.now(), 'v': value });
  scheduleSave();
}

function updateDailyStats(sensorId, value) {
  const today = getToday();
  const stored = sensorDailyStats[sensorId];
  const isCurrentDay = Boolean(stored) && stored.date === today;
  const baseline = isCurrentDay ? stored : { date: today, min: value, max: value };
  const stats = { date: today, min: Math.min(baseline.min, value), max: Math.max(baseline.max, value) };

  sensorDailyStats[sensorId] = stats;

  return { min: stats.min, max: stats.max };
}

function scheduleSave() {
  if (saveTimeout) {
    return;
  }

  saveTimeout = setTimeout(() => {
    storage.saveSensorData(sensorHistory, sensorDailyStats);
    saveTimeout = null;
  }, SAVE_DELAY_MS);
}

function getToday() {
  const isoTimestamp = new Date().toISOString();

  return isoTimestamp.split('T')[0];
}

function definedOrNull(value) {
  return value === undefined ? null : value;
}

module.exports = { sensorValue, getSensorReadings, recordLatestReading, updateSensorHistory };
