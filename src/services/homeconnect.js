const storage = require('./storage');
const client = require('./homeconnect-client');
const sse = require('./homeconnect-sse');
const { broadcast, logToUI, setBroadcast } = require('./homeconnect-notifier');
const parsers = require('./homeconnect-parsers');

const POLL_INTERVAL_MS = 1_200_000;
const PROGRESS_UPDATE_INTERVAL_MS = 60000;
const MS_PER_SECOND = 1000;
const MS_PER_MINUTE = 60000;

let pollTimer = null;
let progressTimer = null;

const sseHooks = {
  refreshAppliances: pollAppliances,
  shouldReconnect: () => client.isAuthenticated() && Boolean(pollTimer)
};

async function getAllStatuses() {
  return loadStatuses({ useCache: true });
}

async function loadStatuses({ useCache }) {
  if (!client.isAuthenticated()) {
    return [];
  }

  try {
    const cache = storage.getHomeConnectCache();

    if (useCache && cache.statuses.length > 0) {
      return cache.statuses;
    }

    return await fetchStatusesFromApi();
  } catch (err) {
    return statusesAfterError(err);
  }
}

function statusesAfterError(err) {
  console.error('Home Connect polling error:', err.message);
  broadcast('error', { service: 'Home Connect', message: err.message });

  return storage.getHomeConnectCache().statuses || [];
}

async function fetchStatusesFromApi() {
  const cachedAppliances = client.getCachedAppliances();
  const appliances = cachedAppliances.length > 0 ? cachedAppliances : await client.getAppliances();
  const statuses = [];

  for (const appliance of appliances) {
    statuses.push(await statusEntryFor(appliance));
  }

  storage.setHomeConnectCache(statuses, Date.now());

  return statuses;
}

async function statusEntryFor(appliance) {
  const summary = {
    id: appliance.haId,
    name: appliance.name,
    type: appliance.type,
    brand: appliance.brand
  };

  try {
    const status = await fetchApplianceStatus(appliance);

    return { ...summary, connected: appliance.connected, status };
  } catch (err) {
    return { ...summary, connected: false, error: err.message };
  }
}

async function fetchApplianceStatus(appliance) {
  if (appliance.type === 'Dishwasher') {
    return getDishwasherStatus(appliance.haId);
  }

  const statusList = await client.getApplianceStatus(appliance.haId);

  return parsers.statusListToObject(statusList);
}

async function getDishwasherStatus(haId) {
  const [statusList, program, events] = await Promise.all([
    client.getApplianceStatus(haId),
    client.getApplianceProgram(haId),
    client.getApplianceEvents(haId)
  ]);

  console.log('[HomeConnect] Raw status items:', JSON.stringify(statusList, null, 2));
  console.log('[HomeConnect] Raw events:', JSON.stringify(events, null, 2));

  const dishwasherStatus = parsers.buildDishwasherStatus({ statusList, program, events });

  console.log('[HomeConnect] Dishwasher status:', JSON.stringify(dishwasherStatus, null, 2));

  return dishwasherStatus;
}

async function startPolling() {
  if (pollTimer || !client.isAuthenticated()) {
    return;
  }

  logToUI('Starting polling (every 20 min)');
  pollTimer = setInterval(pollAppliances, POLL_INTERVAL_MS);
  await pollAppliances();
  startProgressTimer();
  sse.startSSEConnections(client.getCachedAppliances(), sseHooks);
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }

  stopProgressTimer();
  sse.stopSSEConnections();
}

async function pollAppliances() {
  const rateLimitedUntil = client.getRateLimitedUntil();

  if (Date.now() < rateLimitedUntil) {
    const remainingMinutes = Math.ceil((rateLimitedUntil - Date.now()) / MS_PER_MINUTE);
    logToUI(`Rate limited, ${remainingMinutes}m remaining`, 'warning');

    return;
  }

  try {
    logToUI('Polling appliances...');
    publishStatuses(await loadStatuses({ useCache: false }));
  } catch (err) {
    logToUI(`Poll error: ${err.message}`, 'error');
  }
}

function publishStatuses(statuses) {
  if (statuses.length === 0) {
    return;
  }

  const runningCount = statuses.filter(isRunning).length;
  logToUI(`Fetched ${statuses.length} appliances, ${runningCount} running`);

  statuses.forEach(trackAppliance);
  broadcast('homeconnect', statuses);
}

function trackAppliance(appliance) {
  if (appliance.status?.warnings) {
    sse.setApplianceWarnings(appliance.id, appliance.status.warnings);
  }

  if (appliance.connected && !sse.hasSseConnection(appliance.id)) {
    sse.connectSSE(appliance.id, sseHooks);
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

function updateProgressLocally() {
  const cache = storage.getHomeConnectCache();

  if (!cache.statuses || cache.statuses.length === 0) {
    return;
  }

  const elapsedSinceCache = Math.floor((Date.now() - cache.timestamp) / MS_PER_SECOND);
  const advanced = cache.statuses.map(appliance => advanceAppliance(appliance, elapsedSinceCache));

  if (!advanced.some(entry => entry.changed)) {
    return;
  }

  const updatedStatuses = advanced.map(entry => entry.appliance);

  updatedStatuses.filter(isRunning).filter(hasProgram).forEach(logApplianceProgress);
  broadcast('homeconnect', updatedStatuses);
}

function advanceAppliance(appliance, elapsedSeconds) {
  if (!appliance.status?.program || appliance.status.operationState !== 'running') {
    return { appliance, changed: false };
  }

  const { program, changed } = parsers.advanceProgram(appliance.status.program, elapsedSeconds);

  return { appliance: { ...appliance, status: { ...appliance.status, program } }, changed };
}

function logApplianceProgress(appliance) {
  const { program } = appliance.status;
  const remaining = program.remainingTime ? parsers.formatTime(program.remainingTime) : '?';
  const progress = program.progress === null ? '?' : `${program.progress}%`;

  logToUI(`${appliance.name}: ${progress}, ${remaining} remaining`);
}

function isRunning(appliance) {
  return appliance.status?.operationState === 'running';
}

function hasProgram(appliance) {
  return Boolean(appliance.status?.program);
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
  client.clearCachedAppliances();
}

function refreshNow() {
  return fetchStatusesFromApi();
}

module.exports = {
  isConfigured: client.isConfigured,
  isAuthenticated: client.isAuthenticated,
  configure,
  getAuthUrl: client.getAuthUrl,
  exchangeCode: client.exchangeCode,
  getAppliances: client.getAppliances,
  getAllStatuses,
  getDishwasherStatus,
  setBroadcast,
  startPolling,
  stopPolling,
  disconnect,
  refreshNow,
  parseOperationState: parsers.parseOperationState,
  parseDoorState: parsers.parseDoorState,
  parseProgramName: parsers.parseProgramName
};
