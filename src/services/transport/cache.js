const fs = require('node:fs');
const path = require('node:path');
const { MS_PER_MINUTE } = require('./constants');

const DATA_DIR = process.env.HOME_DASHBOARD_DATA || path.join(__dirname, '../../../data');
const STATION_CACHE_FILE = path.join(DATA_DIR, 'station-cache.json');
const DEPARTURES_CACHE_FILE = path.join(DATA_DIR, 'departures-cache.json');
const DEPARTURES_CACHE_TTL = MS_PER_MINUTE;

let stationIdCache = {};
let departuresCache = {};

function getCachedStation(cacheKey) {
  return stationIdCache[cacheKey];
}

function setCachedStation(cacheKey, station) {
  stationIdCache[cacheKey] = station;
  writeJsonCache(STATION_CACHE_FILE, stationIdCache, 'station cache');
}

function clearStationCache() {
  stationIdCache = {};
}

function getCachedDepartures(stationId) {
  const cached = departuresCache[stationId];

  if (!cached || Date.now() - cached.timestamp > DEPARTURES_CACHE_TTL) {
    return null;
  }

  return cached.data;
}

function setCachedDepartures(stationId, departures) {
  departuresCache[stationId] = {
    data: departures,
    timestamp: Date.now()
  };
  writeJsonCache(DEPARTURES_CACHE_FILE, departuresCache, 'departures cache');
}

function loadStationCache() {
  const loaded = readJsonCache(STATION_CACHE_FILE, 'station cache');
  stationIdCache = loaded || {};

  if (loaded) {
    console.log(`[transport] Loaded ${Object.keys(stationIdCache).length} cached stations`);
  }
}

function loadDeparturesCache() {
  const loaded = readJsonCache(DEPARTURES_CACHE_FILE, 'departures cache');
  departuresCache = loaded || {};

  if (loaded) {
    console.log('[transport] Loaded departures cache');
  }
}

function readJsonCache(file, label) {
  try {
    return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf-8')) : null;
  } catch (err) {
    console.error(`[transport] Failed to load ${label}:`, err.message);

    return {};
  }
}

function writeJsonCache(file, cache, label) {
  try {
    const dir = path.dirname(file);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(file, JSON.stringify(cache, null, 2), 'utf-8');
  } catch (err) {
    console.error(`[transport] Failed to save ${label}:`, err.message);
  }
}

loadStationCache();
loadDeparturesCache();

module.exports = {
  getCachedStation,
  setCachedStation,
  clearStationCache,
  getCachedDepartures,
  setCachedDepartures
};
