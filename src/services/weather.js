const storage = require('./storage');
const { parseForecastData, mapWeatherIcon, getClothingSuggestions } = require('./weather/forecast');

const MS_PER_MINUTE = 60000;
const DEFAULT_POLL_INTERVAL = 900000; // 15 minutes (max ~96 calls/day, well under 1000 limit)
const FETCH_TIMEOUT_MS = 30000;
let broadcastHandler = null;
let pollTimer = null;
let cachedWeather = null;

function startPolling() {
  const config = getConfig();
  console.log('[weather] startPolling called, config:', JSON.stringify(config));
  console.log('[weather] isConfigured:', isConfigured());

  if (pollTimer) {
    console.log('[weather] Poll timer already running');

    return;
  }

  if (!isConfigured()) {
    console.log('[weather] Not configured, skipping');

    return;
  }

  const interval = config?.pollInterval || DEFAULT_POLL_INTERVAL;

  console.log('[weather] Starting polling every', Math.round(interval / MS_PER_MINUTE), 'min');
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
  return cachedWeather;
}

function setBroadcast(handler) {
  broadcastHandler = handler;
}

async function poll() {
  if (!isConfigured()) {
    return;
  }

  try {
    cachedWeather = await fetchForecast();
    logToUI(`${cachedWeather.location}: ${cachedWeather.current.temp}C, ${cachedWeather.current.condition}`);
    broadcast(cachedWeather);
  } catch (err) {
    logToUI(`Poll error: ${err.message}`, 'error');
  }
}

async function fetchForecast() {
  const config = getConfig();

  if (!config?.apiKey) {
    throw new Error('Weather API key not configured');
  }

  const response = await fetch(buildForecastUrl(config), { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });

  if (!response.ok) {
    throw new Error(`Weather API error: ${response.status}`);
  }

  return parseForecastData(await response.json());
}

function buildForecastUrl(config) {
  const params = hasCoordinates(config)
    ? `lat=${config.lat}&lon=${config.lon}`
    : `q=${encodeURIComponent(config.location)}`;

  return `https://api.openweathermap.org/data/2.5/forecast?${params}&appid=${config.apiKey}&units=metric`;
}

function isConfigured() {
  const config = getConfig();

  return Boolean(config?.apiKey && (config?.location || hasCoordinates(config)));
}

function hasCoordinates(config) {
  return Boolean(config?.lat && config?.lon);
}

function getConfig() {
  return storage.getWeather();
}

function broadcast(payload) {
  if (broadcastHandler) {
    broadcastHandler({ type: 'weather', data: payload });
  }
}

function logToUI(message, level = 'info') {
  console.log(`[Weather] ${message}`);

  if (broadcastHandler) {
    broadcastHandler({ type: 'log', data: { source: 'Weather', message, level } });
  }
}

module.exports = {
  isConfigured,
  getConfig,
  getStatus,
  fetchForecast,
  setBroadcast,
  startPolling,
  stopPolling,
  getClothingSuggestions,
  mapWeatherIcon
};
