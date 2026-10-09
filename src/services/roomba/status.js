const { getConfig, hasConnectionDetails } = require('./config');
const { connect, disconnect, getRobotState, getReportedState } = require('./connection');
const {
  parseMission,
  parseBattery,
  parseBin,
  parseLifetimeStats,
  parseSettings,
  parseLastCommand,
  parseDeviceInfo
} = require('./parsers');

const ADDRESS_FIELD = 'ip';

async function getStatus() {
  const config = getConfig();

  if (!hasConnectionDetails(config)) {
    return null;
  }

  try {
    return await readStatus(config);
  } catch (err) {
    disconnect();

    return disconnectedStatus(config, err.message);
  }
}

async function readStatus(config) {
  const client = await connect();

  if (!client) {
    return disconnectedStatus(config, 'Failed to connect');
  }

  const state = await getRobotState();

  if (!state || state.batPct === undefined) {
    return waitingStatus(config);
  }

  return buildStatus(config, state);
}

function buildStatus(config, state) {
  return {
    ...identity(config),
    name: state.name || config.name || 'Roomba',
    connected: true,
    battery: parseBattery(state.batPct),
    mission: parseMission(state.cleanMissionStatus),
    bin: parseBin(state.bin),
    dock: state.dock || {},
    signal: state.signal?.rssi || null,
    lifetime: parseLifetimeStats(state.bbrun, state.bbmssn),
    settings: parseSettings(state),
    lastCommand: parseLastCommand(state.lastCommand),
    deviceInfo: parseDeviceInfo(state)
  };
}

function waitingStatus(config) {
  return { ...identity(config), connected: true, error: 'Waiting for robot data' };
}

function disconnectedStatus(config, error) {
  return { ...identity(config), connected: false, error };
}

function identity(config) {
  return { name: config.name || 'Roomba', [ADDRESS_FIELD]: config[ADDRESS_FIELD] };
}

// Reads only what the robot already reported, so callers like /metrics never open an MQTT connection.
function getCachedStatus() {
  const reported = getReportedState();

  if (reported.batPct === undefined) {
    return null;
  }

  return {
    name: reported.name || getConfig()?.name || 'Roomba',
    batteryPercent: parseBattery(reported.batPct).percent,
    phase: parseMission(reported.cleanMissionStatus).phase,
    binFull: parseBin(reported.bin).full
  };
}

module.exports = { getStatus, getCachedStatus };
