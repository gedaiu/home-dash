const storage = require('./storage');
const { logToUI } = require('./homeconnect-notifier');

const API_BASE = 'https://api.home-connect.com';
const AUTH_URL = 'https://api.home-connect.com/security/oauth/authorize';
const TOKEN_URL = 'https://api.home-connect.com/security/oauth/token';
const FETCH_TIMEOUT_MS = 30000;
const RATE_LIMIT_PAUSE_MS = 3_600_000;
const TOKEN_EXPIRY_MARGIN_MS = 60000;
const MS_PER_SECOND = 1000;
const HTTP_TOO_MANY_REQUESTS = 429;

let cachedAppliances = [];
let rateLimitedUntil = 0;

function isConfigured() {
  const config = getConfig();

  return Boolean(config.clientId && config.clientSecret);
}

function isAuthenticated() {
  const tokens = getTokens();

  return Boolean(tokens?.access_token);
}

function getAuthUrl(redirectUri) {
  const config = getConfig();

  if (!config.clientId) {
    throw new Error('Home Connect not configured');
  }

  const params = new URLSearchParams({
    client_id: config.clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    scope: 'IdentifyAppliance Monitor Settings'
  });

  return `${AUTH_URL}?${params.toString()}`;
}

async function exchangeCode(code, redirectUri) {
  const config = getConfig();
  const response = await postTokenForm({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token exchange failed: ${error}`);
  }

  const tokens = await response.json();
  saveTokens(tokens);

  return tokens;
}

async function getAppliances() {
  const result = await apiRequest('/api/homeappliances');
  cachedAppliances = result.data?.homeappliances || [];

  return cachedAppliances;
}

async function getApplianceStatus(haId) {
  const result = await apiRequest(`/api/homeappliances/${haId}/status`);

  return result.data?.status || [];
}

async function getApplianceProgram(haId) {
  try {
    const result = await apiRequest(`/api/homeappliances/${haId}/programs/active`);

    return result.data || null;
  } catch {
    return null;
  }
}

async function getApplianceEvents(haId) {
  try {
    const result = await apiRequest(`/api/homeappliances/${haId}/events`);
    console.log('[HomeConnect] Events for', haId, ':', JSON.stringify(result, null, 2));

    return result.data?.events || [];
  } catch (err) {
    console.log('[HomeConnect] Events fetch failed for', haId, ':', err.message);

    return [];
  }
}

function openEventStream(haId, accessToken, signal) {
  return fetch(`${API_BASE}/api/homeappliances/${haId}/events`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'text/event-stream'
    },
    signal
  });
}

function getCachedAppliances() {
  return cachedAppliances;
}

function clearCachedAppliances() {
  cachedAppliances = [];
}

function getRateLimitedUntil() {
  return rateLimitedUntil;
}

async function apiRequest(path, options = {}) {
  const accessToken = await getAccessToken();

  logToUI(`API request: ${path}`);

  const response = await fetch(`${API_BASE}${path}`, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    ...options,
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/vnd.bsh.sdk.v1+json',
      ...options.headers
    }
  });

  if (!response.ok) {
    await throwApiError(response);
  }

  const payload = await response.json();
  console.log('[HomeConnect] API response:', path, JSON.stringify(payload, null, 2));

  return payload;
}

async function throwApiError(response) {
  if (response.status === HTTP_TOO_MANY_REQUESTS) {
    rateLimitedUntil = Date.now() + RATE_LIMIT_PAUSE_MS;
    logToUI('Rate limited, pausing for 1 hour', 'error');
  }

  const error = await response.text();
  logToUI(`API error: ${response.status} ${error}`, 'error');
  throw new Error(`API request failed: ${response.status} ${error}`);
}

async function getAccessToken() {
  const tokens = getTokens();

  if (!tokens) {
    throw new Error('Not authenticated');
  }

  const expiresAt = tokens.timestamp + (tokens.expires_in * MS_PER_SECOND);

  if (Date.now() <= expiresAt - TOKEN_EXPIRY_MARGIN_MS) {
    return tokens.access_token;
  }

  const newTokens = await refreshTokens();

  return newTokens.access_token;
}

async function refreshTokens() {
  const config = getConfig();
  const tokens = getTokens();

  if (!tokens?.refresh_token) {
    throw new Error('No refresh token available');
  }

  logToUI('Refreshing access token...');

  const response = await postTokenForm({
    client_secret: config.clientSecret,
    grant_type: 'refresh_token',
    refresh_token: tokens.refresh_token
  });

  if (!response.ok) {
    storage.setHomeConnectTokens(null);
    logToUI('Token refresh failed - re-authentication required', 'error');
    throw new Error('Token refresh failed - re-authentication required');
  }

  const newTokens = await response.json();
  saveTokens(newTokens);
  logToUI('Token refreshed successfully');

  return newTokens;
}

function postTokenForm(fields) {
  return fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(fields).toString(),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
  });
}

function saveTokens(tokens) {
  storage.setHomeConnectTokens({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_in: tokens.expires_in,
    timestamp: Date.now()
  });
}

function getConfig() {
  return storage.getHomeConnect() || {};
}

function getTokens() {
  return storage.getHomeConnectTokens();
}

module.exports = {
  isConfigured,
  isAuthenticated,
  getAuthUrl,
  exchangeCode,
  getAppliances,
  getApplianceStatus,
  getApplianceProgram,
  getApplianceEvents,
  openEventStream,
  getCachedAppliances,
  clearCachedAppliances,
  getRateLimitedUntil,
  getTokens
};
