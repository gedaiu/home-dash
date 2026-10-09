const {
  getCachedStation,
  setCachedStation,
  getCachedDepartures,
  setCachedDepartures
} = require('./cache');

const TRANSPORT_API_BASE = 'https://v6.bvg.transport.rest';
const FETCH_TIMEOUT_MS = 30000;
const DEFAULT_DEPARTURE_LIMIT = 10;
const DEPARTURE_WINDOW_MINUTES = 120;
const JOURNEY_RESULT_COUNT = 3;

async function resolveStationId(stationName) {
  const cacheKey = stationName.toLowerCase();
  const cachedStation = getCachedStation(cacheKey);

  if (cachedStation) {
    return cachedStation;
  }

  const url = `${TRANSPORT_API_BASE}/locations?query=${encodeURIComponent(stationName)}&results=1&stops=true`;
  const locations = await fetchJson(url, {
    logLabel: `Station lookup failed for "${stationName}"`,
    errorLabel: 'Station lookup failed'
  });

  if (!locations || locations.length === 0) {
    throw new Error(`Station not found: ${stationName}`);
  }

  const [{ id, name }] = locations;
  setCachedStation(cacheKey, { id, name });

  return getCachedStation(cacheKey);
}

async function fetchDepartures(stationId, limit = DEFAULT_DEPARTURE_LIMIT) {
  const cached = getCachedDepartures(stationId);

  if (cached) {
    return cached;
  }

  const url = `${TRANSPORT_API_BASE}/stops/${stationId}/departures?duration=${DEPARTURE_WINDOW_MINUTES}&results=${limit}`;
  const departures = await fetchJson(url, {
    logLabel: `Departures fetch failed for ${stationId}`,
    errorLabel: 'Departures API error'
  });
  setCachedDepartures(stationId, departures);

  return departures;
}

async function fetchJourney(fromName, toName) {
  const fromStation = await resolveStationId(fromName);
  const toStation = await resolveStationId(toName);

  const url = `${TRANSPORT_API_BASE}/journeys?from=${encodeURIComponent(fromStation.id)}&to=${encodeURIComponent(toStation.id)}&results=${JOURNEY_RESULT_COUNT}`;

  return fetchJson(url, {
    logLabel: `Journey fetch failed for ${fromName} -> ${toName}`,
    errorLabel: 'Journey API error'
  });
}

async function fetchJson(url, { logLabel, errorLabel }) {
  const response = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'No response body');
    console.error(`[transport] ${logLabel}: ${response.status} - ${errorText}`);
    throw new Error(`${errorLabel}: ${response.status} - ${errorText}`);
  }

  return response.json();
}

module.exports = { resolveStationId, fetchDepartures, fetchJourney };
