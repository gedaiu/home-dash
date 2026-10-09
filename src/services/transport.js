const storage = require('./storage');
const { MS_PER_MINUTE } = require('./transport/constants');
const { getStationName, getStationWalkTime } = require('./transport/parsing');
const {
  buildStationEntry,
  buildStationErrorEntry,
  buildRouteEntry,
  buildRouteErrorEntry
} = require('./transport/snapshots');

const DEFAULT_POLL_INTERVAL = MS_PER_MINUTE;

let broadcastFn = null;
let pollTimer = null;
let cachedTransport = { departures: {}, routes: [] };

function startPolling() {
  if (pollTimer || !isConfigured()) {
    return;
  }

  const interval = getConfig()?.pollInterval || DEFAULT_POLL_INTERVAL;

  logToUI(`Starting polling (every ${Math.round(interval / MS_PER_MINUTE)}min)`);
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

function setBroadcast(handler) {
  broadcastFn = handler;
}

async function poll() {
  if (!isConfigured()) {
    return;
  }

  const config = getConfig();
  const stationEntries = await Promise.all((config.stations || []).map(pollStation));
  const routes = await Promise.all((config.routes || []).map(pollRoute));

  cachedTransport = {
    departures: Object.fromEntries(stationEntries),
    routes,
    lastUpdate: new Date().toISOString()
  };
  broadcast(cachedTransport);
}

async function pollStation(stationConfig) {
  const stationName = getStationName(stationConfig);
  const walkTime = getStationWalkTime(stationConfig);
  const entryKey = stationName.toLowerCase();

  try {
    const entry = await buildStationEntry(stationName, walkTime);
    const next = firstCatchable(entry.grouped);

    if (next) {
      logToUI(`${entry.name}: ${next.line} to ${next.direction} (${next.category})`);
    }

    return [entryKey, entry];
  } catch (err) {
    logToUI(`Failed to fetch ${stationName}: ${err.message}`, 'error');

    return [entryKey, buildStationErrorEntry(stationName, walkTime, err)];
  }
}

async function pollRoute(route) {
  const walkTime = route.walkTime || 0;

  try {
    const entry = await buildRouteEntry(route, walkTime);
    const next = firstCatchable(entry.grouped);

    if (next) {
      logToUI(`${route.name || route.from}: ${next.duration}min (${next.category})`);
    }

    return entry;
  } catch (err) {
    logToUI(`Failed to fetch route ${route.name}: ${err.message}`, 'error');

    return buildRouteErrorEntry(route, walkTime, err);
  }
}

function firstCatchable(grouped) {
  return [...grouped.hurry, ...grouped.now, ...grouped.upcoming][0];
}

function isConfigured() {
  const config = getConfig();

  return !!(config?.stations?.length > 0 || config?.routes?.length > 0);
}

function getConfig() {
  return storage.getTransport();
}

function broadcast(payload) {
  if (broadcastFn) {
    broadcastFn({ type: 'transport', data: payload });
  }
}

function logToUI(message, level = 'info') {
  console.log(`[Transport] ${message}`);

  if (broadcastFn) {
    broadcastFn({ type: 'log', data: { source: 'Transport', message, level } });
  }
}

const { clearStationCache } = require('./transport/cache');
const { resolveStationId, fetchDepartures, fetchJourney } = require('./transport/api');

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
