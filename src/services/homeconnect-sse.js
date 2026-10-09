const storage = require('./storage');
const { broadcast, logToUI } = require('./homeconnect-notifier');
const { getTokens, openEventStream } = require('./homeconnect-client');
const { warningFromEvent } = require('./homeconnect-parsers');

const SSE_RECONNECT_DELAY_MS = 5000;
const EVENT_PREFIX = 'event:';
const DATA_PREFIX = 'data:';
const NO_PENDING_EVENT = { eventType: '', eventData: '' };

const sseConnections = new Map();
const applianceWarnings = new Map();

async function connectSSE(haId, hooks) {
  if (sseConnections.has(haId)) {
    return;
  }

  const tokens = getTokens();

  if (!tokens?.access_token) {
    return;
  }

  const controller = new AbortController();
  sseConnections.set(haId, controller);
  logToUI(`SSE connecting to ${haId}...`);

  try {
    await streamEvents({ haId, hooks }, tokens.access_token, controller.signal);
  } catch (err) {
    reportStreamError(haId, err);
  } finally {
    handleDisconnect({ haId, hooks });
  }
}

async function streamEvents(context, accessToken, signal) {
  const response = await openEventStream(context.haId, accessToken, signal);

  if (!response.ok) {
    throw new Error(`SSE connection failed: ${response.status}`);
  }

  await consumeStream(context, response);
}

async function consumeStream(context, response) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  logToUI(`SSE connected to ${context.haId}`);

  let chunk = await reader.read();

  while (!chunk.done) {
    buffer += decoder.decode(chunk.value, { stream: true });

    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    dispatchSseEvents(context, extractSseEvents(lines));
    chunk = await reader.read();
  }
}

function extractSseEvents(lines) {
  const completedEvents = [];
  let pending = NO_PENDING_EVENT;

  for (const line of lines) {
    const step = readSseLine(pending, line);

    pending = step.pending;

    if (step.completed) {
      completedEvents.push(step.completed);
    }
  }

  return completedEvents;
}

function readSseLine(pending, line) {
  if (line.startsWith(EVENT_PREFIX)) {
    return { pending: { ...pending, eventType: line.slice(EVENT_PREFIX.length).trim() }, completed: null };
  }

  if (line.startsWith(DATA_PREFIX)) {
    return { pending: { ...pending, eventData: line.slice(DATA_PREFIX.length).trim() }, completed: null };
  }

  if (line === '' && pending.eventData) {
    return { pending: NO_PENDING_EVENT, completed: pending };
  }

  return { pending, completed: null };
}

function dispatchSseEvents(context, events) {
  for (const { eventType, eventData } of events) {
    try {
      handleSSEEvent(context, eventType, JSON.parse(eventData));
    } catch (err) {
      console.log('[HomeConnect] SSE parse error:', err.message);
    }
  }
}

function handleSSEEvent(context, eventType, payload) {
  console.log(`[HomeConnect] SSE ${eventType} for ${context.haId}:`, JSON.stringify(payload, null, 2));

  if (eventType === 'EVENT' && payload.items) {
    applyWarningItems(context.haId, payload.items);

    return;
  }

  if (eventType === 'STATUS' || eventType === 'NOTIFY') {
    context.hooks.refreshAppliances();
  }
}

function applyWarningItems(haId, warningEvents) {
  const currentWarnings = applianceWarnings.get(haId) || new Set();
  const detectedWarnings = new Set(warningEvents.map(warningFromEvent).filter(Boolean));
  const newWarnings = [...detectedWarnings].filter(warning => !currentWarnings.has(warning));

  if (newWarnings.length === 0) {
    return;
  }

  for (const warning of newWarnings) {
    currentWarnings.add(warning);
    logToUI(`${haId}: ${warning} detected via SSE`);
  }

  applianceWarnings.set(haId, currentWarnings);
  updateCachedWarnings(haId, Array.from(currentWarnings));
}

function updateCachedWarnings(haId, warnings) {
  const cache = storage.getHomeConnectCache();

  if (!cache.statuses) {
    return;
  }

  const updatedStatuses = cache.statuses.map(appliance => withWarnings(appliance, haId, warnings));

  storage.setHomeConnectCache(updatedStatuses, cache.timestamp);
  broadcast('homeconnect', updatedStatuses);
}

function withWarnings(appliance, haId, warnings) {
  if (appliance.id !== haId) {
    return appliance;
  }

  return { ...appliance, status: { ...appliance.status, warnings } };
}

function reportStreamError(haId, err) {
  if (err.name === 'AbortError') {
    return;
  }

  logToUI(`SSE error for ${haId}: ${err.message}`, 'error');
}

function handleDisconnect({ haId, hooks }) {
  sseConnections.delete(haId);
  logToUI(`SSE disconnected from ${haId}`);

  if (hooks.shouldReconnect()) {
    setTimeout(() => connectSSE(haId, hooks), SSE_RECONNECT_DELAY_MS);
  }
}

function startSSEConnections(appliances, hooks) {
  const connectedAppliances = appliances.filter(appliance => appliance.connected);

  connectedAppliances.forEach(appliance => connectSSE(appliance.haId, hooks));
}

function stopSSEConnections() {
  for (const [haId, controller] of sseConnections) {
    logToUI(`Stopping SSE for ${haId}`);
    controller.abort();
  }

  sseConnections.clear();
  applianceWarnings.clear();
}

function hasSseConnection(haId) {
  return sseConnections.has(haId);
}

function setApplianceWarnings(haId, warnings) {
  applianceWarnings.set(haId, new Set(warnings));
}

module.exports = {
  connectSSE,
  startSSEConnections,
  stopSSEConnections,
  hasSseConnection,
  setApplianceWarnings
};
