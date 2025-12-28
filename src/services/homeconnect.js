const storage = require('./storage');

const API_BASE = 'https://api.home-connect.com';
const AUTH_URL = 'https://api.home-connect.com/security/oauth/authorize';
const TOKEN_URL = 'https://api.home-connect.com/security/oauth/token';

const POLL_INTERVAL_MS = 20 * 60 * 1000; // 20 minutes
const RATE_LIMIT_PAUSE_MS = 60 * 60 * 1000; // 1 hour

let broadcastFn = null;
let pollTimer = null;
let progressTimer = null;
let cachedAppliances = [];
let rateLimitedUntil = 0;

const PROGRESS_UPDATE_INTERVAL_MS = 60 * 1000; // 1 minute

function getConfig() {
  return storage.getHomeConnect() || {};
}

function getTokens() {
  return storage.getHomeConnectTokens();
}

function isConfigured() {
  const config = getConfig();
  return !!(config.clientId && config.clientSecret);
}

function isAuthenticated() {
  const tokens = getTokens();
  return !!(tokens?.access_token);
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

  const params = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri
  });

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString()
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token exchange failed: ${error}`);
  }

  const tokens = await response.json();
  storage.setHomeConnectTokens({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_in: tokens.expires_in,
    timestamp: Date.now()
  });

  return tokens;
}

async function refreshTokens() {
  const config = getConfig();
  const tokens = getTokens();

  if (!tokens?.refresh_token) {
    throw new Error('No refresh token available');
  }

  const params = new URLSearchParams({
    client_secret: config.clientSecret,
    grant_type: 'refresh_token',
    refresh_token: tokens.refresh_token
  });

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString()
  });

  if (!response.ok) {
    storage.setHomeConnectTokens(null);
    throw new Error('Token refresh failed - re-authentication required');
  }

  const newTokens = await response.json();
  storage.setHomeConnectTokens({
    access_token: newTokens.access_token,
    refresh_token: newTokens.refresh_token,
    expires_in: newTokens.expires_in,
    timestamp: Date.now()
  });

  return newTokens;
}

async function getAccessToken() {
  const tokens = getTokens();
  if (!tokens) {
    throw new Error('Not authenticated');
  }

  const expiresAt = tokens.timestamp + (tokens.expires_in * 1000);
  if (Date.now() > expiresAt - 60000) {
    const newTokens = await refreshTokens();
    return newTokens.access_token;
  }

  return tokens.access_token;
}

async function apiRequest(path, options = {}) {
  const accessToken = await getAccessToken();

  console.log('[HomeConnect] API request:', path);
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/vnd.bsh.sdk.v1+json',
      ...options.headers
    }
  });

  if (!response.ok) {
    if (response.status === 429) {
      rateLimitedUntil = Date.now() + RATE_LIMIT_PAUSE_MS;
      console.error('[HomeConnect] Rate limited, pausing for 1 hour');
    }
    const error = await response.text();
    console.error('[HomeConnect] API error:', response.status, error);
    throw new Error(`API request failed: ${response.status} ${error}`);
  }

  const data = await response.json();
  console.log('[HomeConnect] API response:', path, JSON.stringify(data, null, 2));
  return data;
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
    return result.data?.items || [];
  } catch {
    return [];
  }
}

function parseOperationState(state) {
  const states = {
    'BSH.Common.EnumType.OperationState.Inactive': 'inactive',
    'BSH.Common.EnumType.OperationState.Ready': 'ready',
    'BSH.Common.EnumType.OperationState.DelayedStart': 'delayed',
    'BSH.Common.EnumType.OperationState.Run': 'running',
    'BSH.Common.EnumType.OperationState.Pause': 'paused',
    'BSH.Common.EnumType.OperationState.ActionRequired': 'action_required',
    'BSH.Common.EnumType.OperationState.Finished': 'finished',
    'BSH.Common.EnumType.OperationState.Error': 'error',
    'BSH.Common.EnumType.OperationState.Aborting': 'aborting'
  };
  return states[state] || state;
}

function parseDoorState(state) {
  const states = {
    'BSH.Common.EnumType.DoorState.Open': 'open',
    'BSH.Common.EnumType.DoorState.Closed': 'closed',
    'BSH.Common.EnumType.DoorState.Locked': 'locked'
  };
  return states[state] || state;
}

function parseProgramName(key) {
  if (!key) {
    return null;
  }

  const match = key.match(/\.(\w+)$/);
  if (match) {
    return match[1].replace(/([A-Z])/g, ' $1').trim();
  }
  return key;
}

async function getDishwasherStatus(haId) {
  const [statusList, program, events] = await Promise.all([
    getApplianceStatus(haId),
    getApplianceProgram(haId),
    getApplianceEvents(haId)
  ]);

  const status = {};
  for (const item of statusList) {
    const key = item.key.split('.').pop();
    status[key] = item.value;
  }

  let remainingTime = null;
  let elapsedTime = null;
  let progress = null;
  let startInRelative = null;
  let estimatedTotalTime = null;

  if (program?.options) {
    for (const opt of program.options) {
      if (opt.key === 'BSH.Common.Option.RemainingProgramTime') {
        remainingTime = opt.value;
      }
      if (opt.key === 'BSH.Common.Option.ProgramProgress') {
        progress = opt.value;
      }
      if (opt.key === 'BSH.Common.Option.ElapsedProgramTime') {
        elapsedTime = opt.value;
      }
      if (opt.key === 'BSH.Common.Option.StartInRelative') {
        startInRelative = opt.value;
      }
      if (opt.key === 'BSH.Common.Option.EstimatedTotalProgramTime') {
        estimatedTotalTime = opt.value;
      }
    }
  }

  const warnings = [];
  for (const event of events) {
    if (event.key === 'Dishcare.Dishwasher.Event.SaltNearlyEmpty') {
      warnings.push('salt_low');
    }
    if (event.key === 'Dishcare.Dishwasher.Event.RinseAidNearlyEmpty') {
      warnings.push('rinse_aid_low');
    }
  }

  const result = {
    operationState: parseOperationState(status.OperationState),
    doorState: parseDoorState(status.DoorState),
    remoteControlActive: status.RemoteControlActive || false,
    remoteStartAllowed: status.RemoteControlStartAllowed || false,
    localControlActive: status.LocalControlActive || false,
    warnings,
    program: program ? {
      name: parseProgramName(program.key),
      remainingTime,
      elapsedTime,
      progress,
      startInRelative,
      estimatedTotalTime
    } : null
  };

  console.log('[HomeConnect] Dishwasher status:', JSON.stringify(result, null, 2));
  return result;
}

async function fetchStatusesFromApi() {
  const appliances = cachedAppliances.length > 0 ? cachedAppliances : await getAppliances();
  const statuses = [];

  for (const appliance of appliances) {
    try {
      let status = null;

      if (appliance.type === 'Dishwasher') {
        status = await getDishwasherStatus(appliance.haId);
      } else {
        const statusList = await getApplianceStatus(appliance.haId);
        status = {};
        for (const item of statusList) {
          const key = item.key.split('.').pop();
          status[key] = item.value;
        }
      }

      statuses.push({
        id: appliance.haId,
        name: appliance.name,
        type: appliance.type,
        brand: appliance.brand,
        connected: appliance.connected,
        status
      });
    } catch (err) {
      statuses.push({
        id: appliance.haId,
        name: appliance.name,
        type: appliance.type,
        brand: appliance.brand,
        connected: false,
        error: err.message
      });
    }
  }

  storage.setHomeConnectCache(statuses, Date.now());
  return statuses;
}

async function getAllStatuses(forceRefresh = false) {
  if (!isAuthenticated()) {
    return [];
  }

  try {
    const cache = storage.getHomeConnectCache();

    if (!forceRefresh && cache.statuses.length > 0) {
      return cache.statuses;
    }

    return await fetchStatusesFromApi();
  } catch (err) {
    console.error('Home Connect polling error:', err.message);
    broadcast('error', { service: 'Home Connect', message: err.message });
    const cache = storage.getHomeConnectCache();
    return cache.statuses || [];
  }
}

function setBroadcast(fn) {
  broadcastFn = fn;
}

function broadcast(type, data) {
  console.log('[HomeConnect] Broadcasting:', type, JSON.stringify(data, null, 2));
  if (broadcastFn) {
    broadcastFn({ type, data });
  }
}

async function pollAppliances() {
  if (Date.now() < rateLimitedUntil) {
    return;
  }

  try {
    const statuses = await getAllStatuses(true);
    if (statuses.length > 0) {
      broadcast('homeconnect', statuses);
    }
  } catch {
    // Ignore polling errors
  }
}

function updateProgressLocally() {
  const cache = storage.getHomeConnectCache();
  if (!cache.statuses || cache.statuses.length === 0) {
    return;
  }

  const elapsedSinceCache = Math.floor((Date.now() - cache.timestamp) / 1000);
  let updated = false;

  const updatedStatuses = cache.statuses.map(appliance => {
    if (!appliance.status?.program || appliance.status.operationState !== 'running') {
      return appliance;
    }

    const program = appliance.status.program;
    const newProgram = { ...program };

    if (program.remainingTime !== null && program.remainingTime > 0) {
      newProgram.remainingTime = Math.max(0, program.remainingTime - elapsedSinceCache);
      updated = true;
    }

    if (program.elapsedTime !== null) {
      newProgram.elapsedTime = program.elapsedTime + elapsedSinceCache;
      updated = true;
    }

    if (program.estimatedTotalTime && program.estimatedTotalTime > 0) {
      const newElapsed = newProgram.elapsedTime || elapsedSinceCache;
      newProgram.progress = Math.min(100, Math.floor((newElapsed / program.estimatedTotalTime) * 100));
      updated = true;
    }

    return {
      ...appliance,
      status: {
        ...appliance.status,
        program: newProgram
      }
    };
  });

  if (updated) {
    console.log('[HomeConnect] Local progress update (no API call)');
    broadcast('homeconnect', updatedStatuses);
  }
}

function startProgressTimer() {
  if (progressTimer) {
    return;
  }

  progressTimer = setInterval(updateProgressLocally, PROGRESS_UPDATE_INTERVAL_MS);
}

function stopProgressTimer() {
  if (progressTimer) {
    clearInterval(progressTimer);
    progressTimer = null;
  }
}

async function refreshNow() {
  return await fetchStatusesFromApi();
}

function startPolling() {
  if (pollTimer || !isAuthenticated()) {
    return;
  }

  pollTimer = setInterval(pollAppliances, POLL_INTERVAL_MS);
  pollAppliances();
  startProgressTimer();
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  stopProgressTimer();
}

function configure(clientId, clientSecret) {
  storage.setHomeConnect({
    clientId,
    clientSecret,
    tokens: null
  });
}

function disconnect() {
  stopPolling();
  storage.setHomeConnect(null);
  cachedAppliances = [];
}

module.exports = {
  isConfigured,
  isAuthenticated,
  configure,
  getAuthUrl,
  exchangeCode,
  getAppliances,
  getAllStatuses,
  getDishwasherStatus,
  setBroadcast,
  startPolling,
  stopPolling,
  disconnect,
  refreshNow,
  parseOperationState,
  parseDoorState,
  parseProgramName
};
