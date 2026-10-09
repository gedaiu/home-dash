import { updateEkgDisplay, updateEkgDisconnected } from './ekg.js';
import { log } from './log.js';
import { updateRooms } from './rooms.js';
import { updateRoomba } from './devices/roomba.js';
import { updateAirPurifier } from './devices/airpurifier.js';
import { updateHomeConnect } from './devices/homeconnect.js';
import { updateSyncStatus } from './sync.js';
import {
  logRoombaChanges,
  logLightChanges,
  logSensorChanges,
  logHomeConnectChanges,
  logAirPurifierChanges
} from './change-logging.js';

let socket = null;
let pingHistory = [];
const PING_HISTORY_LENGTH = 30;
const PING_INTERVAL = 3000;
const RECONNECT_DELAY = 3000;
let pingTimer = null;
let lastPingTime = 0;

let messageHandler = null;

export function setMessageHandler(handler) {
  messageHandler = handler;
}

export function initWebSocket() {
  connectWebSocket();
}

export function connectWebSocket() {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  socket = new WebSocket(`${protocol}//${location.host}`);

  socket.onopen = handleSocketOpen;
  socket.onclose = handleSocketClose;
  socket.onmessage = handleSocketMessage;
}

function handleSocketOpen() {
  log('WebSocket connected', 'success');
  startPingLoop();
}

function handleSocketClose() {
  log('WebSocket disconnected', 'error');
  stopPingLoop();
  updateEkgDisconnected();
  setTimeout(connectWebSocket, RECONNECT_DELAY);
}

function handleSocketMessage(event) {
  const msg = JSON.parse(event.data);

  if (msg.type === 'pong') {
    handlePong(msg.timestamp);

    return;
  }

  handleMessage(msg);
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

  pingHistory = [];
  updateEkgDisconnected();
}

function sendPing() {
  if (socket && socket.readyState === WebSocket.OPEN) {
    lastPingTime = Date.now();
    socket.send(JSON.stringify({ type: 'ping', timestamp: lastPingTime }));
  }
}

function handlePong(timestamp) {
  const latency = Date.now() - timestamp;
  pingHistory.push(latency);

  if (pingHistory.length > PING_HISTORY_LENGTH) {
    pingHistory.shift();
  }

  updateEkgDisplay(latency);
}

function handleMessage(msg) {
  const handler = MESSAGE_HANDLERS.get(msg.type);

  if (handler) {
    handler(msg.data);
  }

  if (messageHandler) {
    messageHandler(msg);
  }
}

function handleRooms(rooms) {
  if (rooms) {
    const allLights = rooms.flatMap(room => room.lights || []);
    logLightChanges(allLights.filter(light => !light.isSensor));
    logSensorChanges(allLights.filter(light => light.isSensor));
  }

  updateRooms(rooms);
}

function handleRoomba(roomba) {
  logRoombaChanges(roomba);
  updateRoomba(roomba);
}

function handleAirPurifier(purifier) {
  logAirPurifierChanges(purifier, purifier?.index || 0);
  updateAirPurifier(purifier);
}

function handleHomeConnect(appliances) {
  logHomeConnectChanges(appliances);
  updateHomeConnect(appliances);
}

const MESSAGE_HANDLERS = new Map([
  ['rooms', handleRooms],
  ['roomba', handleRoomba],
  ['airpurifier', handleAirPurifier],
  ['homeconnect', handleHomeConnect],
  ['sync', updateSyncStatus]
]);
