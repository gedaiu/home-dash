import { updateEkgDisplay, updateEkgDisconnected } from './ekg.js';
import { log } from './log.js';
import { updateRooms } from './rooms.js';
import { updateRoomba } from './devices/roomba.js';
import { updateAirPurifier } from './devices/airpurifier.js';
import { updateHomeConnect } from './devices/homeconnect.js';
import { updateSyncStatus } from './sync.js';

let ws = null;
let pingHistory = [];
const PING_HISTORY_LENGTH = 30;
const PING_INTERVAL = 3000;
let pingTimer = null;
let lastPingTime = 0;

let messageHandler = null;

// Previous state for change detection
let prevRoombaPhase = null;
let prevLightStates = new Map();
let prevSensorValues = new Map();
let prevHomeConnectStates = new Map();
let prevAirPurifierStates = new Map();

const ROOMBA_PHASES = {
  charge: 'Charging',
  run: 'Cleaning',
  stuck: 'Stuck',
  stop: 'Stopped',
  pause: 'Paused',
  hmUsrDock: 'Returning to dock',
  hmMidMsn: 'Recharging',
  hmPostMsn: 'Docked',
  evac: 'Emptying bin'
};

const HC_STATES = {
  inactive: 'Idle',
  ready: 'Ready',
  delayed: 'Delayed start',
  running: 'Running',
  paused: 'Paused',
  action_required: 'Action required',
  finished: 'Finished',
  error: 'Error',
  aborting: 'Stopping'
};

function decodeButtonEvent(code) {
  if (code === undefined || code === null) {
    return null;
  }
  const button = Math.floor(code / 1000);
  const buttonNames = { 1: 'ON', 2: 'UP', 3: 'DOWN', 4: 'OFF' };
  return buttonNames[button] || `BTN${button}`;
}

function logRoombaChanges(data) {
  if (!data) {
    return;
  }
  const phase = data.phase;
  if (phase && phase !== prevRoombaPhase && prevRoombaPhase !== null) {
    log(`Roomba: ${ROOMBA_PHASES[phase] || phase}`);
  }
  prevRoombaPhase = phase;
}

function logLightChanges(lights) {
  if (!lights || !Array.isArray(lights)) {
    return;
  }
  for (const light of lights) {
    if (!light.id || !light.state) {
      continue;
    }
    const key = light.id;
    const prev = prevLightStates.get(key);
    const name = light.name || `Light ${light.id}`;
    if (prev) {
      if (prev.on !== light.state.on) {
        log(`${name}: ${light.state.on ? 'ON' : 'OFF'}`);
      } else if (prev.reachable !== light.state.reachable) {
        log(`${name}: ${light.state.reachable ? 'Online' : 'Offline'}`, light.state.reachable ? 'info' : 'warning');
      }
    }
    prevLightStates.set(key, { on: light.state.on, reachable: light.state.reachable });
  }
}

function logSensorChanges(sensors) {
  if (!sensors || !Array.isArray(sensors)) {
    return;
  }
  for (const sensor of sensors) {
    const key = sensor.storageId || sensor.id;
    if (!key) {
      continue;
    }
    const prev = prevSensorValues.get(key);
    const name = sensor.name || key;

    if (sensor.category === 'motion' && sensor.state?.presence !== undefined) {
      if (prev?.presence === false && sensor.state.presence === true) {
        log(`${name}: Motion detected`);
      }
      prevSensorValues.set(key, { presence: sensor.state.presence });
    } else if (sensor.category === 'switch' && sensor.state?.buttonevent !== undefined) {
      if (prev?.buttonevent !== sensor.state.buttonevent) {
        const btn = decodeButtonEvent(sensor.state.buttonevent);
        if (btn && prev !== undefined) {
          log(`${name}: ${btn} pressed`);
        }
      }
      prevSensorValues.set(key, { buttonevent: sensor.state.buttonevent });
    } else if (sensor.category === 'temperature' && sensor.state?.temperature !== undefined) {
      const temp = sensor.state.temperature;
      if (prev?.temperature !== undefined && Math.abs(temp - prev.temperature) >= 1.0) {
        log(`${name}: ${temp.toFixed(1)}C`);
      }
      prevSensorValues.set(key, { temperature: temp });
    }
  }
}

function logHomeConnectChanges(appliances) {
  if (!appliances || !Array.isArray(appliances)) {
    return;
  }
  for (const device of appliances) {
    if (!device.id) {
      continue;
    }
    const key = device.id;
    const prev = prevHomeConnectStates.get(key);
    const name = device.name || 'Appliance';
    const state = device.status?.operationState;
    if (state && prev?.operationState !== state && prev !== undefined) {
      const type = state === 'error' ? 'error' : state === 'finished' ? 'success' : 'info';
      log(`${name}: ${HC_STATES[state] || state}`, type);
    }
    prevHomeConnectStates.set(key, { operationState: state });
  }
}

function logAirPurifierChanges(device, index) {
  if (!device) {
    return;
  }
  const key = `purifier_${index}`;
  const prev = prevAirPurifierStates.get(key);
  const name = device.device?.name || `Purifier ${index + 1}`;
  if (prev) {
    if (prev.pwr !== device.pwr) {
      log(`${name}: ${device.pwr === '1' ? 'ON' : 'OFF'}`);
    }
    if (device.iaql !== undefined && prev.iaql !== undefined) {
      const getLabel = (v) => v <= 3 ? 'GOOD' : v <= 6 ? 'MODERATE' : v <= 9 ? 'POOR' : 'VERY POOR';
      if (getLabel(prev.iaql) !== getLabel(device.iaql)) {
        const type = device.iaql <= 3 ? 'success' : device.iaql <= 6 ? 'info' : 'warning';
        log(`${name}: Air quality ${getLabel(device.iaql)}`, type);
      }
    }
  }
  prevAirPurifierStates.set(key, { pwr: device.pwr, iaql: device.iaql });
}

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

function handleMessage(msg) {
  switch (msg.type) {
    case 'rooms':
      if (msg.data) {
        const allLights = msg.data.flatMap(r => r.lights || []);
        const sensors = allLights.filter(l => l.isSensor);
        const lights = allLights.filter(l => !l.isSensor);
        logLightChanges(lights);
        logSensorChanges(sensors);
      }
      updateRooms(msg.data);
      break;
    case 'roomba':
      logRoombaChanges(msg.data);
      updateRoomba(msg.data);
      break;
    case 'airpurifier':
      logAirPurifierChanges(msg.data, msg.data?.index || 0);
      updateAirPurifier(msg.data);
      break;
    case 'homeconnect':
      logHomeConnectChanges(msg.data);
      updateHomeConnect(msg.data);
      break;
    case 'sync':
      updateSyncStatus(msg.data);
      break;
  }

  if (messageHandler) {
    messageHandler(msg);
  }
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

    handleMessage(msg);
  };
}

export function initWebSocket() {
  connectWebSocket();
}
