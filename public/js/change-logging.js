import { log } from './log.js';

const BUTTON_CODE_DIVISOR = 1000;
const MIN_TEMPERATURE_DELTA = 1;
const IAQL_GOOD_MAX = 3;
const IAQL_MODERATE_MAX = 6;
const IAQL_POOR_MAX = 9;

let prevRoombaPhase = null;
const prevLightStates = new Map();
const prevSensorValues = new Map();
const prevHomeConnectStates = new Map();
const prevAirPurifierStates = new Map();

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

const HC_LOG_LEVELS = { error: 'error', finished: 'success' };

const BUTTON_NAMES = { '1': 'ON', '2': 'UP', '3': 'DOWN', '4': 'OFF' };

const SENSOR_TRACKERS = new Map([
  ['motion', { field: 'presence', describe: describeMotion }],
  ['switch', { field: 'buttonevent', describe: describeButtonPress }],
  ['temperature', { field: 'temperature', describe: describeTemperature }]
]);

export function logRoombaChanges(roomba) {
  if (!roomba) {
    return;
  }

  const phase = roomba.phase;

  if (phase && phase !== prevRoombaPhase && prevRoombaPhase !== null) {
    log(`Roomba: ${ROOMBA_PHASES[phase] || phase}`);
  }

  prevRoombaPhase = phase;
}

export function logLightChanges(lights) {
  if (!lights || !Array.isArray(lights)) {
    return;
  }

  lights.filter(hasIdAndState).forEach(logLightChange);
}

export function logSensorChanges(sensors) {
  if (!sensors || !Array.isArray(sensors)) {
    return;
  }

  sensors.forEach(logSensorChange);
}

export function logHomeConnectChanges(appliances) {
  if (!appliances || !Array.isArray(appliances)) {
    return;
  }

  appliances.filter(appliance => appliance.id).forEach(logApplianceChange);
}

export function logAirPurifierChanges(device, index) {
  if (!device) {
    return;
  }

  const key = `purifier_${index}`;
  const prev = prevAirPurifierStates.get(key);
  const name = device.device?.name || `Purifier ${index + 1}`;

  if (prev) {
    [powerLogEntry(prev, device, name), airQualityLogEntry(prev, device, name)]
      .filter(Boolean)
      .forEach(entry => log(entry.message, entry.level));
  }

  prevAirPurifierStates.set(key, { pwr: device.pwr, iaql: device.iaql });
}

function hasIdAndState(light) {
  return light.id && light.state;
}

function logLightChange(light) {
  const prev = prevLightStates.get(light.id);
  const name = light.name || `Light ${light.id}`;
  const entry = lightLogEntry(prev, light.state, name);

  if (entry) {
    log(entry.message, entry.level);
  }

  prevLightStates.set(light.id, { isOn: light.state.on, reachable: light.state.reachable });
}

function lightLogEntry(prev, state, name) {
  if (!prev) {
    return null;
  }

  if (prev.isOn !== state.on) {
    return { message: `${name}: ${state.on ? 'ON' : 'OFF'}` };
  }

  return reachabilityLogEntry(prev, state, name);
}

function reachabilityLogEntry(prev, state, name) {
  if (prev.reachable === state.reachable) {
    return null;
  }

  return {
    message: `${name}: ${state.reachable ? 'Online' : 'Offline'}`,
    level: state.reachable ? 'info' : 'warning'
  };
}

function logSensorChange(sensor) {
  const key = sensor.storageId || sensor.id;
  const tracker = SENSOR_TRACKERS.get(sensor.category);
  const value = readTrackedValue(sensor, tracker);

  if (!key || value === undefined) {
    return;
  }

  const message = tracker.describe(prevSensorValues.get(key), value, sensor.name || key);

  if (message) {
    log(message);
  }

  prevSensorValues.set(key, { [tracker.field]: value });
}

function readTrackedValue(sensor, tracker) {
  return tracker ? sensor.state?.[tracker.field] : undefined;
}

function describeMotion(prev, presence, name) {
  return prev?.presence === false && presence === true ? `${name}: Motion detected` : null;
}

function describeButtonPress(prev, buttonEvent, name) {
  if (prev?.buttonevent === buttonEvent) {
    return null;
  }

  const button = decodeButtonEvent(buttonEvent);

  return button && prev !== undefined ? `${name}: ${button} pressed` : null;
}

function describeTemperature(prev, temperature, name) {
  const hasPrevious = prev?.temperature !== undefined;

  return hasPrevious && Math.abs(temperature - prev.temperature) >= MIN_TEMPERATURE_DELTA
    ? `${name}: ${temperature.toFixed(1)}C`
    : null;
}

function decodeButtonEvent(code) {
  if (code === undefined || code === null) {
    return null;
  }

  const button = Math.floor(code / BUTTON_CODE_DIVISOR);

  return BUTTON_NAMES[button] || `BTN${button}`;
}

function logApplianceChange(appliance) {
  const prev = prevHomeConnectStates.get(appliance.id);
  const name = appliance.name || 'Appliance';
  const state = appliance.status?.operationState;

  if (hasStateChanged(prev, state)) {
    log(`${name}: ${HC_STATES[state] || state}`, HC_LOG_LEVELS[state] || 'info');
  }

  prevHomeConnectStates.set(appliance.id, { operationState: state });
}

function hasStateChanged(prev, state) {
  return state && prev !== undefined && prev.operationState !== state;
}

function powerLogEntry(prev, device, name) {
  if (prev.pwr === device.pwr) {
    return null;
  }

  return { message: `${name}: ${device.pwr === '1' ? 'ON' : 'OFF'}` };
}

function airQualityLogEntry(prev, device, name) {
  const hasBoth = device.iaql !== undefined && prev.iaql !== undefined;

  if (!hasBoth || airQualityLabel(prev.iaql) === airQualityLabel(device.iaql)) {
    return null;
  }

  return {
    message: `${name}: Air quality ${airQualityLabel(device.iaql)}`,
    level: airQualityLevel(device.iaql)
  };
}

function airQualityLabel(iaql) {
  if (iaql <= IAQL_GOOD_MAX) {
    return 'GOOD';
  }

  if (iaql <= IAQL_MODERATE_MAX) {
    return 'MODERATE';
  }

  return iaql <= IAQL_POOR_MAX ? 'POOR' : 'VERY POOR';
}

function airQualityLevel(iaql) {
  if (iaql <= IAQL_GOOD_MAX) {
    return 'success';
  }

  return iaql <= IAQL_MODERATE_MAX ? 'info' : 'warning';
}
