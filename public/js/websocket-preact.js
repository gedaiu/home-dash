import {
  roombaState,
  airPurifierState,
  homeConnectState,
  roomsState,
  syncState,
  openwrtState,
  weatherState,
  transportState,
  wsConnected,
  wsLatency,
  addLog
} from './state.js';

let ws = null;
let pingTimer = null;
let lastPingTime = 0;
const PING_INTERVAL = 3000;

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
  if (ws && ws.readyState === WebSocket.OPEN) {
    lastPingTime = Date.now();
    ws.send(JSON.stringify({ type: 'ping', timestamp: lastPingTime }));
  }
}

function handlePong(timestamp) {
  const latency = Date.now() - timestamp;
  wsLatency.value = latency;
  wsConnected.value = true;
}

function handleMessage(msg) {
  switch (msg.type) {
    case 'rooms':
      roomsState.value = msg.data;
      break;
    case 'roomba':
      roombaState.value = { configured: true, connected: true, ...msg.data };
      break;
    case 'airpurifier':
      if (Array.isArray(msg.data)) {
        airPurifierState.value = msg.data;
      } else if (msg.data) {
        const index = msg.data.index || 0;
        const current = [...airPurifierState.value];
        current[index] = { ...current[index], ...msg.data };
        airPurifierState.value = current;
      }
      break;
    case 'homeconnect':
      console.log('HomeConnect WS message:', msg.data);
      homeConnectState.value = msg.data;
      break;
    case 'sync':
      syncState.value = msg.data;
      break;

    case 'openwrt:status':
      openwrtState.value = { ...openwrtState.value, routers: msg.data };
      break;

    case 'openwrt:devices':
      openwrtState.value = { ...openwrtState.value, devices: msg.data };
      break;

    case 'openwrt:connections':
      openwrtState.value = { ...openwrtState.value, connections: msg.data };
      break;

    case 'openwrt:state':
      openwrtState.value = msg.data;
      break;

    case 'weather':
      weatherState.value = msg.data;
      break;

    case 'transport':
      transportState.value = msg.data;
      break;

    case 'log':
      if (msg.data) {
        const prefix = msg.data.source ? `[${msg.data.source}] ` : '';
        addLog(`${prefix}${msg.data.message}`, msg.data.level || '');
      }
      break;
  }
}

export function connectWebSocket() {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(`${protocol}//${location.host}`);

  ws.onopen = () => {
    addLog('WebSocket connected', 'success');
    wsConnected.value = true;
    startPingLoop();
  };

  ws.onclose = () => {
    addLog('WebSocket disconnected', 'error');
    stopPingLoop();
    setTimeout(connectWebSocket, 3000);
  };

  ws.onerror = (err) => {
    console.error('WebSocket error:', err);
  };

  ws.onmessage = (event) => {
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
  };
}

export function initWebSocket() {
  connectWebSocket();
}
