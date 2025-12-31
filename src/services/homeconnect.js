const storage = require('./storage');

const API_BASE = 'https://api.home-connect.com';
const AUTH_URL = 'https://api.home-connect.com/security/oauth/authorize';
const TOKEN_URL = 'https://api.home-connect.com/security/oauth/token';

const POLL_INTERVAL_MS = 20 * 60 * 1000; // 20 minutes
const RATE_LIMIT_PAUSE_MS = 60 * 60 * 1000; // 1 hour
const SSE_RECONNECT_DELAY_MS = 5000; // 5 seconds

let broadcastFn = null;
let pollTimer = null;
let progressTimer = null;
let cachedAppliances = [];
let rateLimitedUntil = 0;
let sseConnections = new Map(); // haId -> AbortController
let applianceWarnings = new Map(); // haId -> Set of warnings

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

  logToUI('Refreshing access token...');
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
    logToUI('Token refresh failed - re-authentication required', 'error');
    throw new Error('Token refresh failed - re-authentication required');
  }

  const newTokens = await response.json();
  storage.setHomeConnectTokens({
    access_token: newTokens.access_token,
    refresh_token: newTokens.refresh_token,
    expires_in: newTokens.expires_in,
    timestamp: Date.now()
  });

  logToUI('Token refreshed successfully');
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

  logToUI(`API request: ${path}`);
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
      logToUI('Rate limited, pausing for 1 hour', 'error');
    }
    const error = await response.text();
    logToUI(`API error: ${response.status} ${error}`, 'error');
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
    console.log('[HomeConnect] Events for', haId, ':', JSON.stringify(result, null, 2));
    return result.data?.events || [];
  } catch (err) {
    console.log('[HomeConnect] Events fetch failed for', haId, ':', err.message);
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

  console.log('[HomeConnect] Raw status items:', JSON.stringify(statusList, null, 2));
  console.log('[HomeConnect] Raw events:', JSON.stringify(events, null, 2));

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
    const isPresent = event.value === 'BSH.Common.EnumType.EventPresentState.Present';
    if (event.key === 'Dishcare.Dishwasher.Event.SaltNearlyEmpty' && isPresent) {
      warnings.push('salt_low');
    }
    if (event.key === 'Dishcare.Dishwasher.Event.SaltLack' && isPresent) {
      warnings.push('salt_empty');
    }
    if (event.key === 'Dishcare.Dishwasher.Event.RinseAidNearlyEmpty' && isPresent) {
      warnings.push('rinse_aid_low');
    }
    if (event.key === 'Dishcare.Dishwasher.Event.RinseAidLack' && isPresent) {
      warnings.push('rinse_aid_empty');
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

function logToUI(message, level = 'info') {
  console.log(`[HomeConnect] ${message}`);
  if (broadcastFn) {
    broadcastFn({ type: 'log', data: { source: 'HomeConnect', message, level } });
  }
}

async function pollAppliances() {
  if (Date.now() < rateLimitedUntil) {
    const remainingMs = rateLimitedUntil - Date.now();
    const remainingMin = Math.ceil(remainingMs / 60000);
    logToUI(`Rate limited, ${remainingMin}m remaining`, 'warning');
    return;
  }

  try {
    logToUI('Polling appliances...');
    const statuses = await getAllStatuses(true);
    if (statuses.length > 0) {
      const runningCount = statuses.filter(s => s.status?.operationState === 'running').length;
      logToUI(`Fetched ${statuses.length} appliances, ${runningCount} running`);

      for (const appliance of statuses) {
        if (appliance.status?.warnings) {
          applianceWarnings.set(appliance.id, new Set(appliance.status.warnings));
        }

        if (appliance.connected && !sseConnections.has(appliance.id)) {
          connectSSE(appliance.id);
        }
      }

      broadcast('homeconnect', statuses);
    }
  } catch (err) {
    logToUI(`Poll error: ${err.message}`, 'error');
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
    const runningAppliances = updatedStatuses.filter(a => a.status?.operationState === 'running');
    for (const appliance of runningAppliances) {
      const prog = appliance.status?.program;
      if (prog) {
        const remaining = prog.remainingTime ? formatTime(prog.remainingTime) : '?';
        const progress = prog.progress !== null ? `${prog.progress}%` : '?';
        logToUI(`${appliance.name}: ${progress}, ${remaining} remaining`);
      }
    }
    broadcast('homeconnect', updatedStatuses);
  }
}

function formatTime(seconds) {
  if (seconds === null || seconds === undefined) {
    return '?';
  }
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) {
    return `${h}h ${m}m`;
  }
  return `${m}m`;
}

function parseSSEEvent(eventData) {
  const warnings = [];
  const isPresent = eventData.value === 'BSH.Common.EnumType.EventPresentState.Present';

  if (eventData.key === 'Dishcare.Dishwasher.Event.SaltNearlyEmpty') {
    if (isPresent) {
      warnings.push('salt_low');
    }
  }
  if (eventData.key === 'Dishcare.Dishwasher.Event.SaltLack') {
    if (isPresent) {
      warnings.push('salt_empty');
    }
  }
  if (eventData.key === 'Dishcare.Dishwasher.Event.RinseAidNearlyEmpty') {
    if (isPresent) {
      warnings.push('rinse_aid_low');
    }
  }
  if (eventData.key === 'Dishcare.Dishwasher.Event.RinseAidLack') {
    if (isPresent) {
      warnings.push('rinse_aid_empty');
    }
  }

  return { warnings, isPresent, key: eventData.key };
}

async function connectSSE(haId) {
  if (sseConnections.has(haId)) {
    return;
  }

  const tokens = getTokens();
  if (!tokens?.access_token) {
    return;
  }

  const controller = new AbortController();
  sseConnections.set(haId, controller);

  const url = `${API_BASE}/api/homeappliances/${haId}/events`;
  logToUI(`SSE connecting to ${haId}...`);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${tokens.access_token}`,
        'Accept': 'text/event-stream'
      },
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`SSE connection failed: ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    logToUI(`SSE connected to ${haId}`);

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      let eventType = '';
      let eventData = '';

      for (const line of lines) {
        if (line.startsWith('event:')) {
          eventType = line.slice(6).trim();
        } else if (line.startsWith('data:')) {
          eventData = line.slice(5).trim();
        } else if (line === '' && eventData) {
          try {
            const parsed = JSON.parse(eventData);
            handleSSEEvent(haId, eventType, parsed);
          } catch (e) {
            console.log('[HomeConnect] SSE parse error:', e.message);
          }
          eventType = '';
          eventData = '';
        }
      }
    }
  } catch (err) {
    if (err.name !== 'AbortError') {
      logToUI(`SSE error for ${haId}: ${err.message}`, 'error');
    }
  } finally {
    sseConnections.delete(haId);
    logToUI(`SSE disconnected from ${haId}`);

    if (isAuthenticated() && pollTimer) {
      setTimeout(() => connectSSE(haId), SSE_RECONNECT_DELAY_MS);
    }
  }
}

function handleSSEEvent(haId, eventType, data) {
  console.log(`[HomeConnect] SSE ${eventType} for ${haId}:`, JSON.stringify(data, null, 2));

  if (eventType === 'EVENT' && data.items) {
    let warningsChanged = false;
    const currentWarnings = applianceWarnings.get(haId) || new Set();

    for (const item of data.items) {
      const { warnings, isPresent } = parseSSEEvent(item);

      for (const warning of warnings) {
        if (isPresent) {
          if (!currentWarnings.has(warning)) {
            currentWarnings.add(warning);
            warningsChanged = true;
            logToUI(`${haId}: ${warning} detected via SSE`);
          }
        } else {
          if (currentWarnings.has(warning)) {
            currentWarnings.delete(warning);
            warningsChanged = true;
            logToUI(`${haId}: ${warning} cleared via SSE`);
          }
        }
      }
    }

    if (warningsChanged) {
      applianceWarnings.set(haId, currentWarnings);
      updateCachedWarnings(haId, Array.from(currentWarnings));
    }
  } else if (eventType === 'STATUS' || eventType === 'NOTIFY') {
    pollAppliances();
  }
}

function updateCachedWarnings(haId, warnings) {
  const cache = storage.getHomeConnectCache();
  if (!cache.statuses) {
    return;
  }

  const updatedStatuses = cache.statuses.map(appliance => {
    if (appliance.id !== haId) {
      return appliance;
    }

    return {
      ...appliance,
      status: {
        ...appliance.status,
        warnings
      }
    };
  });

  storage.setHomeConnectCache(updatedStatuses, cache.timestamp);
  broadcast('homeconnect', updatedStatuses);
}

function startSSEConnections() {
  if (cachedAppliances.length === 0) {
    return;
  }

  for (const appliance of cachedAppliances) {
    if (appliance.connected) {
      connectSSE(appliance.haId);
    }
  }
}

function stopSSEConnections() {
  for (const [haId, controller] of sseConnections) {
    logToUI(`Stopping SSE for ${haId}`);
    controller.abort();
  }
  sseConnections.clear();
  applianceWarnings.clear();
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

async function startPolling() {
  if (pollTimer || !isAuthenticated()) {
    return;
  }

  logToUI('Starting polling (every 20 min)');
  pollTimer = setInterval(pollAppliances, POLL_INTERVAL_MS);
  await pollAppliances();
  startProgressTimer();
  startSSEConnections();
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  stopProgressTimer();
  stopSSEConnections();
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
