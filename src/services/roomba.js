const mqtt = require('mqtt');
const crypto = require('crypto');
const storage = require('./storage');

const POLL_INTERVAL_MS = 30000;
const STATE_TIMEOUT_MS = 5000;
const CONNECTION_TIMEOUT_MS = 10000;

let broadcastFn = null;
let pollTimer = null;
let mqttClient = null;
let robotState = {};

function getConfig() {
  return storage.getRoomba();
}

function isConfigured() {
  const config = getConfig();
  return !!(config?.ip && config?.blid && config?.password);
}

async function connect(timeout = CONNECTION_TIMEOUT_MS) {
  const config = getConfig();
  if (!config || !config.blid || !config.password) {
    return null;
  }

  if (mqttClient && mqttClient.connected) {
    return mqttClient;
  }

  disconnect();

  return new Promise((resolve) => {
    const timeoutId = setTimeout(() => {
      logToUI('Connection timeout', 'error');
      disconnect();
      resolve(null);
    }, timeout);

    try {
      const url = `tls://${config.ip}:8883`;
      const options = {
        username: config.blid,
        password: config.password,
        rejectUnauthorized: false,
        protocolId: 'MQTT',
        protocolVersion: 4,
        clean: false,
        clientId: config.blid,
        ciphers: 'HIGH:!DH:!aNULL',
        secureOptions: crypto.constants.SSL_OP_LEGACY_SERVER_CONNECT,
        reconnectPeriod: 0
      };

      mqttClient = mqtt.connect(url, options);

      mqttClient.on('connect', () => {
        clearTimeout(timeoutId);
        logToUI(`Connected to ${config.ip}`);
        mqttClient.subscribe('#');
        resolve(mqttClient);
      });

      mqttClient.on('message', (topic, message) => {
        try {
          const data = JSON.parse(message.toString());
          if (data.state?.reported) {
            robotState = { ...robotState, ...data.state.reported };
          }
        } catch {
          // Ignore parse errors
        }
      });

      mqttClient.on('error', (err) => {
        clearTimeout(timeoutId);
        logToUI(`Connection error: ${err.message}`, 'error');
        disconnect();
        resolve(null);
      });

      mqttClient.on('offline', () => {
        clearTimeout(timeoutId);
        logToUI('Robot went offline', 'warning');
        disconnect();
        resolve(null);
      });

      mqttClient.on('close', () => {
        clearTimeout(timeoutId);
      });
    } catch (err) {
      clearTimeout(timeoutId);
      logToUI(`Failed to create connection: ${err.message}`, 'error');
      resolve(null);
    }
  });
}

function disconnect() {
  robotState = {};
  if (mqttClient) {
    try {
      mqttClient.end(true);
    } catch {
      // Ignore disconnect errors
    }
    mqttClient = null;
  }
}

async function getRobotState(timeout = STATE_TIMEOUT_MS) {
  if (!mqttClient || !mqttClient.connected) {
    return null;
  }

  return new Promise((resolve) => {
    const startTime = Date.now();

    const checkState = () => {
      if (robotState.batPct !== undefined) {
        resolve(robotState);
        return;
      }

      if (Date.now() - startTime > timeout) {
        resolve(robotState);
        return;
      }

      setTimeout(checkState, 100);
    };

    checkState();
  });
}

function parseMission(mission) {
  if (!mission) {
    return { phase: 'unknown', cycle: 'none' };
  }

  const phaseMap = {
    'charge': 'charging',
    'run': 'cleaning',
    'stuck': 'stuck',
    'stop': 'stopped',
    'pause': 'paused',
    'hmMidMsn': 'returning',
    'hmPostMsn': 'returning',
    'hmUsrDock': 'docking',
    'evac': 'emptying',
    'chargingerror': 'error',
    'cancelled': 'cancelled'
  };

  return {
    phase: phaseMap[mission.phase] || mission.phase || 'unknown',
    cycle: mission.cycle || 'none',
    error: mission.error || null,
    notReady: mission.notReady || null,
    mssnM: mission.mssnM || null,
    sqft: mission.sqft || null,
    expireM: mission.expireM || null
  };
}

function parseBattery(batPct) {
  if (batPct === undefined || batPct === null) {
    return { percent: null, level: 'unknown' };
  }

  let level = 'low';
  if (batPct >= 80) {
    level = 'full';
  } else if (batPct >= 40) {
    level = 'medium';
  }

  return { percent: batPct, level };
}

function parseBin(bin) {
  if (!bin) {
    return { present: false, full: false };
  }

  return {
    present: bin.present !== false,
    full: bin.full === true
  };
}

function parseLifetimeStats(bbrun, bbmssn) {
  if (!bbrun && !bbmssn) {
    return null;
  }

  const totalMissions = bbmssn?.nMssn || 0;
  const successfulMissions = bbmssn?.nMssnOk || 0;
  const successRate = totalMissions > 0 ? Math.round((successfulMissions / totalMissions) * 100) : 0;

  return {
    totalHours: bbrun?.hr || 0,
    totalMinutes: bbrun?.min || 0,
    totalMissions,
    successfulMissions,
    failedMissions: bbmssn?.nMssnF || 0,
    successRate,
    avgMissionMinutes: bbmssn?.aMssnM || 0
  };
}

function parseSettings(state) {
  return {
    carpetBoost: state.carpetBoost || false,
    vacHigh: state.vacHigh || false,
    twoPass: state.twoPass || false,
    binPause: state.binPause || false,
    ecoCharge: state.ecoCharge || false,
    schedHold: state.schedHold || false
  };
}

function parseLastCommand(lastCommand) {
  if (!lastCommand) {
    return null;
  }

  return {
    command: lastCommand.command || null,
    initiator: lastCommand.initiator || null,
    time: lastCommand.time ? new Date(lastCommand.time * 1000).toISOString() : null
  };
}

function parseDeviceInfo(state) {
  return {
    sku: state.sku || null,
    softwareVer: state.softwareVer || null,
    batteryType: state.batteryType || null,
    country: state.country || null,
    timezone: state.timezone || null
  };
}

async function getStatus() {
  const config = getConfig();
  if (!config || !config.ip || !config.blid || !config.password) {
    return null;
  }

  try {
    const client = await connect();
    if (!client) {
      return {
        name: config.name || 'Roomba',
        ip: config.ip,
        connected: false,
        error: 'Failed to connect'
      };
    }

    const state = await getRobotState();

    if (!state || state.batPct === undefined) {
      return {
        name: config.name || 'Roomba',
        ip: config.ip,
        connected: true,
        error: 'Waiting for robot data'
      };
    }

    const mission = parseMission(state.cleanMissionStatus);
    const battery = parseBattery(state.batPct);
    const bin = parseBin(state.bin);
    const lifetime = parseLifetimeStats(state.bbrun, state.bbmssn);
    const settings = parseSettings(state);
    const lastCommand = parseLastCommand(state.lastCommand);
    const deviceInfo = parseDeviceInfo(state);

    return {
      name: state.name || config.name || 'Roomba',
      ip: config.ip,
      connected: true,
      battery,
      mission,
      bin,
      dock: state.dock || {},
      signal: state.signal?.rssi || null,
      lifetime,
      settings,
      lastCommand,
      deviceInfo
    };
  } catch (err) {
    disconnect();
    return {
      name: config.name || 'Roomba',
      ip: config.ip,
      connected: false,
      error: err.message
    };
  }
}

function sendCommand(command, params = {}) {
  if (!mqttClient || !mqttClient.connected) {
    throw new Error('Not connected to Roomba');
  }

  logToUI(`Sending command: ${command}`);
  const topic = `cmd`;
  const message = JSON.stringify({
    command,
    time: Math.floor(Date.now() / 1000),
    initiator: 'localApp',
    ...params
  });

  mqttClient.publish(topic, message);
}

async function start() {
  const client = await connect();
  if (!client) {
    throw new Error('Roomba not connected');
  }

  sendCommand('start');
}

async function stop() {
  const client = await connect();
  if (!client) {
    throw new Error('Roomba not connected');
  }

  sendCommand('stop');
}

async function pause() {
  const client = await connect();
  if (!client) {
    throw new Error('Roomba not connected');
  }

  sendCommand('pause');
}

async function resume() {
  const client = await connect();
  if (!client) {
    throw new Error('Roomba not connected');
  }

  sendCommand('resume');
}

async function dock() {
  const client = await connect();
  if (!client) {
    throw new Error('Roomba not connected');
  }

  sendCommand('dock');
}

function setBroadcast(fn) {
  broadcastFn = fn;
}

function broadcast(type, data) {
  if (broadcastFn) {
    broadcastFn({ type, data });
  }
}

function logToUI(message, level = 'info') {
  console.log(`[Roomba] ${message}`);
  if (broadcastFn) {
    broadcastFn({ type: 'log', data: { source: 'Roomba', message, level } });
  }
}

async function pollRoomba() {
  if (!isConfigured()) {
    return;
  }

  try {
    const status = await getStatus();
    if (status) {
      if (status.connected) {
        logToUI(`${status.name}: ${status.mission?.phase || 'unknown'}, battery ${status.battery?.percent || '?'}%`);
      } else if (status.error) {
        logToUI(`${status.name}: ${status.error}`, 'warning');
      }
      broadcast('roomba', status);
    }
  } catch (err) {
    logToUI(`Poll error: ${err.message}`, 'error');
  }
}

function startPolling() {
  if (pollTimer || !isConfigured()) {
    return;
  }

  logToUI('Starting polling (every 30s)');
  pollTimer = setInterval(pollRoomba, POLL_INTERVAL_MS);
  pollRoomba();
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  disconnect();
}

// Reads only what the robot already reported, so callers like /metrics never open an MQTT connection.
function getCachedStatus() {
  if (robotState.batPct === undefined) {
    return null;
  }

  return {
    name: robotState.name || getConfig()?.name || 'Roomba',
    batteryPercent: parseBattery(robotState.batPct).percent,
    phase: parseMission(robotState.cleanMissionStatus).phase,
    binFull: parseBin(robotState.bin).full
  };
}

module.exports = {
  isConfigured,
  getStatus,
  getCachedStatus,
  start,
  stop,
  pause,
  resume,
  dock,
  setBroadcast,
  startPolling,
  stopPolling,
  // Export parsing functions for testing
  parseMission,
  parseBattery,
  parseBin,
  parseLifetimeStats,
  parseSettings,
  parseLastCommand,
  parseDeviceInfo
};
