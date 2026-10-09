import {
  roombaState,
  airPurifierState,
  homeConnectState,
  roomsState,
  syncState,
  openwrtState,
  weatherState,
  transportState,
  resolverState,
  wsConnected,
  wsLatency,
  addLog
} from './state.js';

let socket = null;
let pingTimer = null;
let lastPingTime = 0;
const PING_INTERVAL = 3000;
const RECONNECT_DELAY = 3000;

// Store PM2.5 sensors separately so they persist across room updates
let cachedPm25Sensors = [];

export function initWebSocket() {
  connectWebSocket();
}

export function sendMessage(type, payload = {}) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ type, ...payload }));
  }
}

export function connectWebSocket() {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  socket = new WebSocket(`${protocol}//${location.host}`);

  socket.onopen = handleSocketOpen;
  socket.onclose = handleSocketClose;
  socket.onerror = handleSocketError;
  socket.onmessage = handleSocketMessage;
}

function handleSocketOpen() {
  addLog('WebSocket connected', 'success');
  wsConnected.value = true;
  startPingLoop();
}

function handleSocketClose() {
  addLog('WebSocket disconnected', 'error');
  stopPingLoop();
  setTimeout(connectWebSocket, RECONNECT_DELAY);
}

function handleSocketError(err) {
  console.error('WebSocket error:', err);
}

function handleSocketMessage(event) {
  try {
    const msg = JSON.parse(event.data);

    if (msg.type === 'pong') {
      handlePong(msg.timestamp);

      return;
    }

    handleMessage(msg);
  } catch (err) {
    console.error('Failed to parse WebSocket message:', err);
  }
}

function startPingLoop() {
  if (pingTimer) {
    clearInterval(pingTimer);
  }

  pingTimer = setInterval(sendPing, PING_INTERVAL);
  sendPing();
}

function stopPingLoop() {
  if (pingTimer) {
    clearInterval(pingTimer);
    pingTimer = null;
  }

  wsLatency.value = null;
  wsConnected.value = false;
}

function sendPing() {
  if (socket && socket.readyState === WebSocket.OPEN) {
    lastPingTime = Date.now();
    socket.send(JSON.stringify({ type: 'ping', timestamp: lastPingTime }));
  }
}

function handlePong(timestamp) {
  const latency = Date.now() - timestamp;
  wsLatency.value = latency;
  wsConnected.value = true;
}

function handleMessage(msg) {
  const handler = MESSAGE_HANDLERS.get(msg.type);

  if (handler) {
    handler(msg.data);
  }
}

function handleRooms(rooms) {
  roomsState.value = mergepm25IntoRooms(rooms);
}

function handleRoomba(roomba) {
  roombaState.value = { configured: true, connected: true, ...roomba };
}

function handleAirPurifier(purifier) {
  if (Array.isArray(purifier)) {
    airPurifierState.value = purifier;

    return;
  }

  if (!purifier) {
    return;
  }

  const index = purifier.index || 0;
  const current = [...airPurifierState.value];
  current[index] = { ...current[index], ...purifier };
  airPurifierState.value = current;
}

function handleHomeConnect(appliances) {
  console.log('HomeConnect WS message:', appliances);
  homeConnectState.value = appliances;
}

function handlePm25Sensors(sensors) {
  // Cache PM2.5 sensors and merge into rooms
  if (!sensors || !Array.isArray(sensors)) {
    return;
  }

  cachedPm25Sensors = sensors;
  roomsState.value = mergepm25IntoRooms(roomsState.value || []);
}

function handleLog(entry) {
  if (!entry) {
    return;
  }

  const prefix = entry.source ? `[${entry.source}] ` : '';
  addLog(`${prefix}${entry.message}`, entry.level || '');
}

function mergepm25IntoRooms(rooms) {
  if (cachedPm25Sensors.length === 0) {
    return rooms;
  }

  const sensorsRoomIndex = rooms.findIndex(room => room.id === 'sensors');

  if (sensorsRoomIndex < 0) {
    return [...rooms, { id: 'sensors', name: 'Sensors', lights: cachedPm25Sensors }];
  }

  const result = [...rooms];
  const sensorsRoom = { ...result[sensorsRoomIndex] };
  const existingLights = sensorsRoom.lights || [];
  const nonPm25 = existingLights.filter(sensor => sensor.category !== 'pm25');
  sensorsRoom.lights = [...nonPm25, ...cachedPm25Sensors];
  result[sensorsRoomIndex] = sensorsRoom;

  return result;
}

const MESSAGE_HANDLERS = new Map([
  ['rooms', handleRooms],
  ['roomba', handleRoomba],
  ['airpurifier', handleAirPurifier],
  ['homeconnect', handleHomeConnect],
  ['sync', syncData => { syncState.value = syncData; }],
  ['openwrt:status', routers => { openwrtState.value = { ...openwrtState.value, routers }; }],
  ['openwrt:devices', devices => { openwrtState.value = { ...openwrtState.value, devices }; }],
  ['openwrt:connections', connections => { openwrtState.value = { ...openwrtState.value, connections }; }],
  ['openwrt:state', state => { openwrtState.value = state; }],
  ['weather', weather => { weatherState.value = weather; }],
  ['transport', transport => { transportState.value = transport; }],
  ['pm25_sensors', handlePm25Sensors],
  ['log', handleLog],
  ['resolver:status', resolverStatus => { resolverState.value = resolverStatus; }],
  ['resolver:progress', resolverStatus => { resolverState.value = resolverStatus; }]
]);
