import { updateEkgDisplay, updateEkgDisconnected } from './ekg.js';
import { log } from './log.js';

let ws = null;
let pingHistory = [];
const PING_HISTORY_LENGTH = 30;
const PING_INTERVAL = 3000;
let pingTimer = null;
let lastPingTime = 0;

let messageHandler = null;

export function setMessageHandler(handler) {
  messageHandler = handler;
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
  if (ws && ws.readyState === WebSocket.OPEN) {
    lastPingTime = Date.now();
    ws.send(JSON.stringify({ type: 'ping', timestamp: lastPingTime }));
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

export function connectWebSocket() {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(`${protocol}//${location.host}`);

  ws.onopen = () => {
    log('WebSocket connected', 'success');
    startPingLoop();
  };

  ws.onclose = () => {
    log('WebSocket disconnected', 'error');
    stopPingLoop();
    updateEkgDisconnected();
    setTimeout(connectWebSocket, 3000);
  };

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);

    if (msg.type === 'pong') {
      handlePong(msg.timestamp);
      return;
    }

    if (messageHandler) {
      messageHandler(msg);
    }
  };
}
