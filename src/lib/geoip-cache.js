const fs = require('fs');
const path = require('path');

const MS_PER_DAY = 86_400_000;
const CACHE_TTL_DAYS = 7;
const CACHE_TTL = CACHE_TTL_DAYS * MS_PER_DAY;
const CACHE_JSON_INDENT = 2;

const cache = new Map();

const DATA_DIR = process.env.HOME_DASHBOARD_DATA || path.join(__dirname, '../../data');
const CACHE_FILE = path.join(DATA_DIR, 'ip-cache.json');

function getFreshEntry(address) {
  const entry = cache.get(address);

  return entry && isFresh(entry, CACHE_TTL) ? entry : undefined;
}

function remember(address, location) {
  cache.set(address, { data: location, timestamp: Date.now() });
}

function loadCache() {
  try {
    if (!fs.existsSync(CACHE_FILE)) {
      return;
    }

    const stored = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
    const freshEntries = Object.entries(stored).filter(([, entry]) => isFresh(entry, CACHE_TTL));

    for (const [address, entry] of freshEntries) {
      cache.set(address, entry);
    }

    console.log(`[geoip] Loaded ${cache.size} cached entries`);
  } catch (err) {
    console.error('[geoip] Error loading cache:', err.message);
  }
}

function saveCache() {
  try {
    fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true });
    fs.writeFileSync(CACHE_FILE, JSON.stringify(Object.fromEntries(cache), null, CACHE_JSON_INDENT));
  } catch (err) {
    console.error('[geoip] Error saving cache:', err.message);
  }
}

function isFresh(entry, ttl) {
  return Date.now() - entry.timestamp < ttl;
}

module.exports = { cache, getFreshEntry, remember, loadCache, saveCache };
