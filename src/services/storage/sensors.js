const fs = require('node:fs');
const path = require('node:path');
const { storagePaths, ensureSensorsDir } = require('./paths');
const { writeJsonFile } = require('./json-file');
const { encodeHistory, decodeHistory } = require('./history-codec');

const HISTORY_KEY = 'h';
const SENSOR_FILE_PATTERN = /^(\d{4}-\d{2}-\d{2})_(.+)\.json$/;

function loadSensorData() {
  ensureSensorsDir();
  const today = getToday();
  const result = { history: {}, dailyStats: {} };

  try {
    const todayFiles = fs.readdirSync(storagePaths.sensorsDir)
      .filter(fileName => fileName.startsWith(today) && fileName.endsWith('.json'));

    for (const fileName of todayFiles) {
      addSensorFile(result, fileName, today);
    }
  } catch {
    return result;
  }

  return result;
}

function addSensorFile(result, fileName, today) {
  const match = fileName.match(SENSOR_FILE_PATTERN);

  if (!match) {
    return;
  }

  const sensorId = match[2];
  const sensorFile = JSON.parse(fs.readFileSync(path.join(storagePaths.sensorsDir, fileName), 'utf-8'));
  const history = readSensorHistory(sensorFile, today);

  if (history) {
    result.history[sensorId] = history;
  }

  if (sensorFile.dailyStats) {
    result.dailyStats[sensorId] = sensorFile.dailyStats;
  }
}

function readSensorHistory(sensorFile, today) {
  if (sensorFile[HISTORY_KEY]) {
    return decodeHistory(sensorFile[HISTORY_KEY], today);
  }

  return sensorFile.history;
}

function saveSensorData(history, dailyStats) {
  ensureSensorsDir();
  const today = getToday();
  const sensorIds = new Set([...Object.keys(history), ...Object.keys(dailyStats)]);

  for (const sensorId of sensorIds) {
    saveSensorFile(today, sensorId, {
      [HISTORY_KEY]: encodeHistory(history[sensorId] || [], today),
      dailyStats: dailyStats[sensorId] || null
    });
  }
}

function getToday() {
  const [today] = new Date().toISOString().split('T');

  return today;
}

function saveSensorFile(date, sensorId, sensorFile) {
  ensureSensorsDir();
  writeJsonFile(getSensorFilePath(date, sensorId), sensorFile);
}

function getSensorFilePath(date, sensorId) {
  const safeSensorId = sensorId.replace(/[^a-zA-Z0-9-_]/g, '_');

  return path.join(storagePaths.sensorsDir, `${date}_${safeSensorId}.json`);
}

module.exports = { loadSensorData, saveSensorData };
