const fs = require('node:fs');
const path = require('node:path');

const isTest = process.env.NODE_ENV === 'test';
const CONFIG_FILE = path.join(__dirname, isTest ? '../../data/test-config.json' : '../../network-config.json');
const DATA_DIR = path.join(__dirname, '../../data');
const SENSORS_DIR = path.join(DATA_DIR, 'sensors');
const LOGS_DIR = path.join(DATA_DIR, 'logs');

let configWatcher = null;
let lastConfigMtime = 0;
let debounceTimer = null;
const changeListeners = [];

function onConfigChange(listener) {
  changeListeners.push(listener);
}

function notifyConfigChange(config) {
  console.log('[storage] Config file changed, notifying listeners...');
  for (const listener of changeListeners) {
    try {
      listener(config);
    } catch (err) {
      console.error('[storage] Error in config change listener:', err.message);
    }
  }
}

function startWatching() {
  if (configWatcher || isTest) {
    return;
  }

  if (!fs.existsSync(CONFIG_FILE)) {
    return;
  }

  try {
    lastConfigMtime = fs.statSync(CONFIG_FILE).mtimeMs;
  } catch {
    lastConfigMtime = 0;
  }

  configWatcher = fs.watch(CONFIG_FILE, { persistent: false }, (eventType) => {
    if (eventType !== 'change') {
      return;
    }

    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    debounceTimer = setTimeout(() => {
      try {
        const stat = fs.statSync(CONFIG_FILE);
        if (stat.mtimeMs === lastConfigMtime) {
          return;
        }
        lastConfigMtime = stat.mtimeMs;

        const config = load();
        notifyConfigChange(config);
      } catch {
        // File might be temporarily unavailable
      }
    }, 200);
  });

  console.log('[storage] Watching config file for changes');
}

function stopWatching() {
  if (configWatcher) {
    configWatcher.close();
    configWatcher = null;
  }
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
}

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

function ensureLogsDir() {
  ensureDataDir();
  if (!fs.existsSync(LOGS_DIR)) {
    fs.mkdirSync(LOGS_DIR, { recursive: true });
  }
}

function getLogFilePath(date) {
  return path.join(LOGS_DIR, `${date}_lights.log`);
}

function logLightChange(lightName, rgb, mode, lightState) {
  ensureLogsDir();
  const now = new Date();
  const date = now.toISOString().split('T')[0];
  const time = now.toISOString().split('T')[1].replace('Z', '');
  const filePath = getLogFilePath(date);

  const stateStr = lightState.on ? `bri:${lightState.bri}` : 'OFF';
  const line = `${time} [${lightName}] RGB(${rgb.r},${rgb.g},${rgb.b}) ${mode} ${stateStr}\n`;

  fs.appendFileSync(filePath, line, 'utf-8');
}

function getSensorFilePath(date, sensorId) {
  const safeSensorId = sensorId.replace(/[^a-zA-Z0-9-_]/g, '_');
  return path.join(SENSORS_DIR, `${date}_${safeSensorId}.json`);
}

function load() {
  if (!fs.existsSync(CONFIG_FILE)) {
    return { hue: null, nanoleaf: null, sync: null, airPurifiers: [] };
  }

  try {
    const data = fs.readFileSync(CONFIG_FILE, 'utf-8');
    const config = JSON.parse(data);
    if (!config.airPurifiers) {
      config.airPurifiers = [];
    }
    return config;
  } catch {
    return { hue: null, nanoleaf: null, sync: null, airPurifiers: [] };
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

function getAirPurifiers() {
  return load().airPurifiers || [];
}

function getDiscoveredAirPurifierIps() {
  return load().discoveredAirPurifierIps || [];
}

function setDiscoveredAirPurifierIps(ips) {
  const config = load();
  config.discoveredAirPurifierIps = ips;
  save(config);
}

function addDiscoveredAirPurifierIp(ip) {
  const config = load();
  const ips = config.discoveredAirPurifierIps || [];

  if (!ips.includes(ip)) {
    ips.push(ip);
    config.discoveredAirPurifierIps = ips;
    save(config);
  }
}

function getRoomba() {
  return load().roomba || null;
}

function setRoomba(roombaConfig) {
  const config = load();
  config.roomba = roombaConfig;
  save(config);
}

function getHomeConnect() {
  return load().homeConnect || null;
}

function setHomeConnect(homeConnectConfig) {
  const config = load();
  config.homeConnect = homeConnectConfig;
  save(config);
}

function getHomeConnectTokens() {
  const hc = getHomeConnect();
  return hc?.tokens || null;
}

function setHomeConnectTokens(tokens) {
  const config = load();
  if (!config.homeConnect) {
    config.homeConnect = {};
  }
  config.homeConnect.tokens = tokens;
  save(config);
}

function getHomeConnectCacheFile() {
  return path.join(DATA_DIR, 'homeconnect-cache.json');
}

function getHomeConnectCache() {
  ensureDataDir();
  const cacheFile = getHomeConnectCacheFile();

  if (!fs.existsSync(cacheFile)) {
    return { statuses: [], lastPollTime: 0 };
  }

  try {
    const data = fs.readFileSync(cacheFile, 'utf-8');
    return JSON.parse(data);
  } catch {
    return { statuses: [], lastPollTime: 0 };
  }
}

function setHomeConnectCache(statuses, lastPollTime) {
  ensureDataDir();
  const cacheFile = getHomeConnectCacheFile();
  fs.writeFileSync(cacheFile, JSON.stringify({ statuses, lastPollTime }, null, 2), 'utf-8');
}

function getAirPurifier(id) {
  const purifiers = getAirPurifiers();
  return purifiers.find(p => p.id === id) || null;
}

function addAirPurifier(purifierConfig) {
  const config = load();
  const existing = config.airPurifiers.findIndex(p => p.id === purifierConfig.id);

  if (existing >= 0) {
    config.airPurifiers[existing] = purifierConfig;
  } else {
    config.airPurifiers.push(purifierConfig);
  }

  save(config);
}

function updateAirPurifier(id, updates) {
  const config = load();
  const index = config.airPurifiers.findIndex(p => p.id === id);

  if (index >= 0) {
    config.airPurifiers[index] = { ...config.airPurifiers[index], ...updates };
    save(config);
  }
}

function removeAirPurifier(id) {
  const config = load();
  config.airPurifiers = config.airPurifiers.filter(p => p.id !== id);
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

function zigzagEncode(n) {
  return (n << 1) ^ (n >> 31);
}

function zigzagDecode(n) {
  return (n >>> 1) ^ -(n & 1);
}

function getMidnightMs(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function encodeHistory(entries, dateStr) {
  if (!entries || entries.length === 0) {
    return [];
  }

  const midnightMs = getMidnightMs(dateStr);
  const encoded = [];
  let prevTime = 0;
  let prevValue = null;

  for (const entry of entries) {
    if (prevValue === null || entry.v !== prevValue) {
      const secSinceMidnight = Math.floor((entry.t - midnightMs) / 1000);
      const timeDelta = prevTime === 0 ? secSinceMidnight : secSinceMidnight - prevTime;
      const valueDelta = prevValue === null ? entry.v : entry.v - prevValue;

      encoded.push(zigzagEncode(timeDelta));
      encoded.push(zigzagEncode(Math.round(valueDelta * 100)));

      prevTime = secSinceMidnight;
      prevValue = entry.v;
    }
  }

  return encoded;
}

function decodeHistory(encoded, dateStr) {
  if (!encoded || encoded.length === 0) {
    return [];
  }

  const midnightMs = getMidnightMs(dateStr);
  const entries = [];
  let currentTime = 0;
  let currentValue = 0;

  for (let i = 0; i < encoded.length; i += 2) {
    const timeDelta = zigzagDecode(encoded[i]);
    const valueDelta = zigzagDecode(encoded[i + 1]) / 100;

    currentTime += timeDelta;
    currentValue = entries.length === 0 ? valueDelta : currentValue + valueDelta;

    entries.push({
      t: midnightMs + currentTime * 1000,
      v: currentValue
    });
  }

  return entries;
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

      if (data.h) {
        result.history[sensorId] = decodeHistory(data.h, today);
      } else if (data.history) {
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
      h: encodeHistory(history[sensorId] || [], today),
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
  getAirPurifiers,
  getAirPurifier,
  addAirPurifier,
  updateAirPurifier,
  removeAirPurifier,
  getDiscoveredAirPurifierIps,
  setDiscoveredAirPurifierIps,
  addDiscoveredAirPurifierIp,
  getRoomba,
  setRoomba,
  getHomeConnect,
  setHomeConnect,
  getHomeConnectTokens,
  setHomeConnectTokens,
  getHomeConnectCache,
  setHomeConnectCache,
  loadSensorData,
  saveSensorData,
  logLightChange,
  zigzagEncode,
  zigzagDecode,
  encodeHistory,
  decodeHistory,
  getMidnightMs,
  onConfigChange,
  startWatching,
  stopWatching
};
