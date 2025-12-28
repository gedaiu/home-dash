const storage = require('./storage');
const fs = require('node:fs');
const path = require('node:path');

const TRANSPORT_API_BASE = 'https://v6.bvg.transport.rest';
const DEFAULT_POLL_INTERVAL = 60000; // 1 minute
const STATION_CACHE_FILE = path.join(__dirname, '../../data/station-cache.json');
const DEPARTURES_CACHE_FILE = path.join(__dirname, '../../data/departures-cache.json');
const DEPARTURES_CACHE_TTL = 60000; // 1 minute TTL for departures

let broadcastFn = null;
let pollTimer = null;
let cachedTransport = { departures: {}, routes: [] };
let stationIdCache = {};
let departuresCache = {};

function loadStationCache() {
  try {
    if (fs.existsSync(STATION_CACHE_FILE)) {
      const data = fs.readFileSync(STATION_CACHE_FILE, 'utf-8');
      stationIdCache = JSON.parse(data);
      console.log(`[transport] Loaded ${Object.keys(stationIdCache).length} cached stations`);
    }
  } catch (err) {
    console.error('[transport] Failed to load station cache:', err.message);
    stationIdCache = {};
  }
}

function saveStationCache() {
  try {
    const dir = path.dirname(STATION_CACHE_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(STATION_CACHE_FILE, JSON.stringify(stationIdCache, null, 2), 'utf-8');
  } catch (err) {
    console.error('[transport] Failed to save station cache:', err.message);
  }
}

function loadDeparturesCache() {
  try {
    if (fs.existsSync(DEPARTURES_CACHE_FILE)) {
      const data = fs.readFileSync(DEPARTURES_CACHE_FILE, 'utf-8');
      departuresCache = JSON.parse(data);
      console.log(`[transport] Loaded departures cache`);
    }
  } catch (err) {
    console.error('[transport] Failed to load departures cache:', err.message);
    departuresCache = {};
  }
}

function saveDeparturesCache() {
  try {
    const dir = path.dirname(DEPARTURES_CACHE_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(DEPARTURES_CACHE_FILE, JSON.stringify(departuresCache, null, 2), 'utf-8');
  } catch (err) {
    console.error('[transport] Failed to save departures cache:', err.message);
  }
}

function getCachedDepartures(stationId) {
  const cached = departuresCache[stationId];
  if (!cached) { return null; }

  const age = Date.now() - cached.timestamp;
  if (age > DEPARTURES_CACHE_TTL) { return null; }

  return cached.data;
}

function setCachedDepartures(stationId, data) {
  departuresCache[stationId] = {
    data,
    timestamp: Date.now()
  };
  saveDeparturesCache();
}

// Load caches on module init
loadStationCache();
loadDeparturesCache();

function getConfig() {
  return storage.getTransport();
}

function isConfigured() {
  const config = getConfig();
  return !!(config?.stations?.length > 0 || config?.routes?.length > 0);
}

function setBroadcast(fn) {
  broadcastFn = fn;
}

function broadcast(data) {
  if (broadcastFn) {
    broadcastFn({ type: 'transport', data });
  }
}

function logToUI(message, level = 'info') {
  console.log(`[Transport] ${message}`);
  if (broadcastFn) {
    broadcastFn({ type: 'log', data: { source: 'Transport', message, level } });
  }
}

async function resolveStationId(stationName) {
  const cacheKey = stationName.toLowerCase();
  if (stationIdCache[cacheKey]) {
    return stationIdCache[cacheKey];
  }

  const url = `${TRANSPORT_API_BASE}/locations?query=${encodeURIComponent(stationName)}&results=1&stops=true`;
  const response = await fetch(url);

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'No response body');
    console.error(`[transport] Station lookup failed for "${stationName}": ${response.status} - ${errorText}`);
    throw new Error(`Station lookup failed: ${response.status} - ${errorText}`);
  }

  const locations = await response.json();
  if (!locations || locations.length === 0) {
    throw new Error(`Station not found: ${stationName}`);
  }

  const station = locations[0];
  stationIdCache[cacheKey] = {
    id: station.id,
    name: station.name
  };

  saveStationCache();
  return stationIdCache[cacheKey];
}

async function fetchDepartures(stationId, limit = 10) {
  const cached = getCachedDepartures(stationId);
  if (cached) {
    return cached;
  }

  const url = `${TRANSPORT_API_BASE}/stops/${stationId}/departures?duration=120&results=${limit}`;
  const response = await fetch(url);

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'No response body');
    console.error(`[transport] Departures fetch failed for ${stationId}: ${response.status} - ${errorText}`);
    throw new Error(`Departures API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  setCachedDepartures(stationId, data);
  return data;
}

async function fetchJourney(fromName, toName) {
  const fromStation = await resolveStationId(fromName);
  const toStation = await resolveStationId(toName);

  const url = `${TRANSPORT_API_BASE}/journeys?from=${encodeURIComponent(fromStation.id)}&to=${encodeURIComponent(toStation.id)}&results=3`;
  const response = await fetch(url);

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'No response body');
    console.error(`[transport] Journey fetch failed for ${fromName} -> ${toName}: ${response.status} - ${errorText}`);
    throw new Error(`Journey API error: ${response.status} - ${errorText}`);
  }

  return response.json();
}

function parseTransportType(line) {
  if (!line) { return 'unknown'; }

  const product = line.product;
  if (product === 'suburban') { return 's-bahn'; }
  if (product === 'subway') { return 'u-bahn'; }
  if (product === 'tram') { return 'tram'; }
  if (product === 'bus') { return 'bus'; }
  if (product === 'regional' || product === 'express') { return 'train'; }
  if (product === 'ferry') { return 'ferry'; }

  return 'unknown';
}

function parseDeparture(dep) {
  const plannedTime = new Date(dep.plannedWhen || dep.when);
  const actualTime = dep.when ? new Date(dep.when) : plannedTime;
  const delay = dep.delay || 0;

  return {
    line: dep.line?.name || 'Unknown',
    direction: dep.direction,
    plannedTime: plannedTime.toISOString(),
    actualTime: actualTime.toISOString(),
    delay: Math.round(delay / 60),
    transportType: parseTransportType(dep.line),
    platform: dep.platform || null,
    cancelled: dep.cancelled || false
  };
}

function categorizeDeparture(departure, walkTimeMinutes) {
  const now = Date.now();
  const departureTime = new Date(departure.actualTime).getTime();
  const timeUntilDeparture = (departureTime - now) / 60000;

  if (departure.cancelled) {
    return 'cancelled';
  }

  if (timeUntilDeparture < 0) {
    return 'missed';
  }

  if (timeUntilDeparture < walkTimeMinutes) {
    return 'missed';
  }

  if (timeUntilDeparture < walkTimeMinutes + 2) {
    return 'hurry';
  }

  if (timeUntilDeparture < walkTimeMinutes + 5) {
    return 'now';
  }

  return 'upcoming';
}

function groupDepartures(departures, walkTimeMinutes) {
  const groups = {
    hurry: [],
    now: [],
    upcoming: []
  };

  for (const dep of departures) {
    const category = categorizeDeparture(dep, walkTimeMinutes);
    if (category === 'missed' || category === 'cancelled') {
      continue;
    }
    dep.category = category;
    groups[category].push(dep);
  }

  return groups;
}

function getStationName(stationConfig) {
  if (typeof stationConfig === 'string') {
    return stationConfig;
  }
  return stationConfig.name;
}

function getStationWalkTime(stationConfig) {
  if (typeof stationConfig === 'string') {
    return 0;
  }
  return stationConfig.walkTime || 0;
}

function categorizeJourney(journey, walkTimeMinutes) {
  const now = Date.now();
  const departureTime = new Date(journey.departure).getTime();
  const timeUntilDeparture = (departureTime - now) / 60000;

  if (timeUntilDeparture < 0) {
    return 'missed';
  }

  if (timeUntilDeparture < walkTimeMinutes) {
    return 'missed';
  }

  if (timeUntilDeparture < walkTimeMinutes + 2) {
    return 'hurry';
  }

  if (timeUntilDeparture < walkTimeMinutes + 5) {
    return 'now';
  }

  return 'upcoming';
}

function groupJourneys(journeys) {
  const groups = {
    hurry: [],
    now: [],
    upcoming: []
  };

  for (const journey of journeys) {
    if (journey.category === 'missed') {
      continue;
    }
    groups[journey.category].push(journey);
  }

  return groups;
}

function parseJourney(journey) {
  const legs = journey.legs.map(leg => ({
    origin: leg.origin?.name,
    destination: leg.destination?.name,
    departure: leg.departure,
    arrival: leg.arrival,
    line: leg.line?.name || 'Walk',
    transportType: leg.line ? parseTransportType(leg.line) : 'walk',
    delay: leg.departureDelay ? Math.round(leg.departureDelay / 60) : 0
  }));

  const firstLeg = journey.legs[0];
  const lastLeg = journey.legs[journey.legs.length - 1];
  const totalDelay = legs.reduce((sum, leg) => sum + (leg.delay || 0), 0);

  return {
    departure: firstLeg?.departure,
    arrival: lastLeg?.arrival,
    duration: Math.round((new Date(lastLeg?.arrival) - new Date(firstLeg?.departure)) / 60000),
    transfers: journey.legs.filter(l => l.line).length - 1,
    totalDelay,
    legs
  };
}

async function poll() {
  if (!isConfigured()) {
    return;
  }

  const config = getConfig();
  const departures = {};
  const routes = [];

  // Fetch departures for each station
  if (config.stations) {
    await Promise.all(config.stations.map(async (stationConfig) => {
      const stationName = getStationName(stationConfig);
      const walkTime = getStationWalkTime(stationConfig);

      try {
        const station = await resolveStationId(stationName);
        const deps = await fetchDepartures(station.id, 30);
        const parsedDeps = deps.departures ? deps.departures.map(parseDeparture) : deps.map(parseDeparture);
        const grouped = groupDepartures(parsedDeps, walkTime);

        departures[stationName.toLowerCase()] = {
          name: station.name,
          walkTime,
          grouped,
          departures: parsedDeps
        };

        const catchable = [...grouped.hurry, ...grouped.now, ...grouped.upcoming];
        if (catchable.length > 0) {
          const next = catchable[0];
          logToUI(`${station.name}: ${next.line} to ${next.direction} (${next.category})`);
        }
      } catch (err) {
        logToUI(`Failed to fetch ${stationName}: ${err.message}`, 'error');
        departures[stationName.toLowerCase()] = {
          name: stationName,
          walkTime,
          grouped: { hurry: [], now: [], upcoming: [] },
          departures: [],
          error: err.message
        };
      }
    }));
  }

  // Fetch journey info for each route
  if (config.routes) {
    await Promise.all(config.routes.map(async (route) => {
      const walkTime = route.walkTime || 0;

      try {
        const journeyData = await fetchJourney(route.from, route.to);
        const parsedJourneys = journeyData.journeys.map(j => {
          const parsed = parseJourney(j);
          parsed.category = categorizeJourney(parsed, walkTime);
          return parsed;
        });

        const grouped = groupJourneys(parsedJourneys);

        routes.push({
          name: route.name || `${route.from} to ${route.to}`,
          from: route.from,
          to: route.to,
          walkTime,
          grouped,
          journeys: parsedJourneys
        });

        const catchable = [...grouped.hurry, ...grouped.now, ...grouped.upcoming];
        if (catchable.length > 0) {
          const next = catchable[0];
          logToUI(`${route.name || route.from}: ${next.duration}min (${next.category})`);
        }
      } catch (err) {
        logToUI(`Failed to fetch route ${route.name}: ${err.message}`, 'error');
        routes.push({
          name: route.name || `${route.from} to ${route.to}`,
          walkTime,
          grouped: { hurry: [], now: [], upcoming: [] },
          journeys: [],
          error: err.message
        });
      }
    }));
  }

  cachedTransport = {
    departures,
    routes,
    lastUpdate: new Date().toISOString()
  };
  broadcast(cachedTransport);
}

function startPolling() {
  if (pollTimer || !isConfigured()) {
    return;
  }

  const config = getConfig();
  const interval = config?.pollInterval || DEFAULT_POLL_INTERVAL;

  logToUI(`Starting polling (every ${Math.round(interval / 60000)}min)`);
  pollTimer = setInterval(poll, interval);
  poll();
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
    logToUI('Stopped polling');
  }
}

function getStatus() {
  return cachedTransport;
}

function clearStationCache() {
  stationIdCache = {};
}

module.exports = {
  isConfigured,
  getConfig,
  getStatus,
  fetchDepartures,
  fetchJourney,
  resolveStationId,
  setBroadcast,
  startPolling,
  stopPolling,
  clearStationCache
};
