const fs = require('node:fs');
const path = require('node:path');

const CONFIG_FILE = path.join(__dirname, '../../network-config.json');
const DATA_DIR = path.join(__dirname, '../../data');
const SENSORS_DIR = path.join(DATA_DIR, 'sensors');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function ensureSensorsDir() {
  ensureDataDir();
  if (!fs.existsSync(SENSORS_DIR)) {
    fs.mkdirSync(SENSORS_DIR, { recursive: true });
  }
}

function getSensorFilePath(date, sensorId) {
  const safeSensorId = sensorId.replace(/[^a-zA-Z0-9-_]/g, '_');
  return path.join(SENSORS_DIR, `${date}_${safeSensorId}.json`);
}

function load() {
  if (!fs.existsSync(CONFIG_FILE)) {
    return { hue: null, nanoleaf: null, sync: null };
  }

  try {
    const data = fs.readFileSync(CONFIG_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return { hue: null, nanoleaf: null, sync: null };
  }
}

function save(config) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
}

function getHue() {
  return load().hue;
}

function setHue(hueConfig) {
  const config = load();
  config.hue = hueConfig;
  save(config);
}

function getNanoleaf() {
  return load().nanoleaf;
}

function setNanoleaf(nanoleafConfig) {
  const config = load();
  config.nanoleaf = nanoleafConfig;
  save(config);
}

function getSync() {
  return load().sync;
}

function setSync(syncConfig) {
  const config = load();
  config.sync = syncConfig;
  save(config);
}

function loadSensorFile(date, sensorId) {
  ensureSensorsDir();
  const filePath = getSensorFilePath(date, sensorId);

  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    const data = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(data);
  } catch {
    return null;
  }
}

function saveSensorFile(date, sensorId, data) {
  ensureSensorsDir();
  const filePath = getSensorFilePath(date, sensorId);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

function loadSensorData() {
  ensureSensorsDir();
  const today = new Date().toISOString().split('T')[0];
  const result = { history: {}, dailyStats: {} };

  if (!fs.existsSync(SENSORS_DIR)) {
    return result;
  }

  try {
    const files = fs.readdirSync(SENSORS_DIR);
    const todayFiles = files.filter(f => f.startsWith(today) && f.endsWith('.json'));

    for (const file of todayFiles) {
      const match = file.match(/^(\d{4}-\d{2}-\d{2})_(.+)\.json$/);
      if (!match) {
        continue;
      }

      const sensorId = match[2];
      const filePath = path.join(SENSORS_DIR, file);
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

      if (data.history) {
        result.history[sensorId] = data.history;
      }

      if (data.dailyStats) {
        result.dailyStats[sensorId] = data.dailyStats;
      }
    }
  } catch {
    return result;
  }

  return result;
}

function saveSensorData(history, dailyStats) {
  ensureSensorsDir();
  const today = new Date().toISOString().split('T')[0];

  const sensorIds = new Set([...Object.keys(history), ...Object.keys(dailyStats)]);

  for (const sensorId of sensorIds) {
    const data = {
      history: history[sensorId] || [],
      dailyStats: dailyStats[sensorId] || null
    };
    saveSensorFile(today, sensorId, data);
  }
}

module.exports = {
  load,
  save,
  getHue,
  setHue,
  getNanoleaf,
  setNanoleaf,
  getSync,
  setSync,
  loadSensorData,
  saveSensorData
};
