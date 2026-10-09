const { discovery, api } = require('node-hue-api');
const storage = require('./storage');
const color = require('../lib/color');
const normalizers = require('./hue-normalizers');

const APP_NAME = 'hue-nanoleaf-sync';
const DEVICE_NAME = 'web-server';
const LINK_BUTTON_ERROR_TYPE = 101;
const POLL_INTERVAL_MS = 5000;
const UPNP_TIMEOUT_MS = 5000;
const LIGHT_CHANGE_FIELDS = ['on', 'bri', 'hue', 'sat', 'ct', 'colormode'];

let cachedApi = null;
let broadcastCallback = null;
let pollTimer = null;
const previousLightStates = {};

async function discover() {
  const nupnpBridges = await discovery.nupnpSearch();
  const bridges = nupnpBridges.length === 0 ? await discovery.upnpSearch(UPNP_TIMEOUT_MS) : nupnpBridges;

  return bridges.map(bridge => ({
    'ip': bridge.ipaddress,
    id: bridge.config?.bridgeid || null
  }));
}

async function pair(ipAddress) {
  const unauthenticatedApi = await api.createLocal(ipAddress).connect();

  try {
    const createdUser = await unauthenticatedApi.users.createUser(APP_NAME, DEVICE_NAME);
    const config = {
      'ip': ipAddress,
      username: createdUser.username
    };
    storage.setHue(config);

    return { success: true, config };
  } catch (err) {
    if (isLinkButtonError(err)) {
      return { success: false, error: 'Link button not pressed' };
    }

    throw err;
  }
}

function isLinkButtonError(err) {
  return Boolean(err.getHueErrorType) && err.getHueErrorType() === LINK_BUTTON_ERROR_TYPE;
}

async function getBridge() {
  const hueApi = await getApi();

  if (!hueApi) {
    return null;
  }

  try {
    const bridgeConfig = await hueApi.configuration.getConfiguration();

    return {
      name: bridgeConfig.name,
      id: bridgeConfig.bridgeid,
      apiVersion: bridgeConfig.apiversion,
      'ip': storage.getHue().ip
    };
  } catch {
    return null;
  }
}

function startPolling() {
  if (pollTimer) {
    return;
  }

  logToUI('Starting polling (every 5s)');
  pollTimer = setInterval(pollRooms, POLL_INTERVAL_MS);
  pollRooms();
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

async function pollRooms() {
  try {
    const rooms = await getRooms();
    trackLightChanges(rooms);
    broadcast('rooms', rooms);
  } catch (err) {
    logToUI(`Poll error: ${err.message}`, 'error');
  }
}

function trackLightChanges(rooms) {
  const lightRooms = rooms.filter(room => room.id !== 'sensors');
  const lights = lightRooms.flatMap(room => room.lights);

  lights.filter(light => !light.isSensor).forEach(trackLight);
}

function trackLight(light) {
  const key = `${light.id}`;
  const previous = previousLightStates[key];
  const current = light.state;

  if (!lightStateChanged(previous, current)) {
    return;
  }

  const { rgb, mode } = describeLightOutput(current);

  storage.logLightChange(light.name, rgb, mode, current);
  previousLightStates[key] = { ...current };
}

function lightStateChanged(previous, current) {
  if (!previous) {
    return true;
  }

  return LIGHT_CHANGE_FIELDS.some(field => previous[field] !== current[field]);
}

function describeLightOutput(state) {
  if (state.on && state.reachable) {
    return { rgb: color.getLightRgb(state), mode: state.colormode || 'unknown' };
  }

  return { rgb: offRgb(), mode: state.reachable ? 'off' : 'unreachable' };
}

function offRgb() {
  return { 'r': 0, 'g': 0, 'b': 0 };
}

async function getRooms() {
  const hueApi = await getApi();

  if (!hueApi) {
    return [];
  }

  try {
    return await buildRooms(hueApi);
  } catch {
    return [{
      id: 'all',
      name: 'All Lights',
      lights: await getLights()
    }];
  }
}

async function buildRooms(hueApi) {
  const groups = await hueApi.groups.getAll();
  const [lights, sensors] = await Promise.all([getLights(), getSensors()]);
  const lightsById = new Map(lights.map(light => [String(light.id), light]));
  const rooms = groups
    .filter(normalizers.isRoomGroup)
    .map(group => normalizers.normalizeRoom(group, lightsById));
  const assignedLightIds = new Set(rooms.flatMap(room => room.lights.map(light => light.id)));
  const unassignedLights = lights.filter(light => !assignedLightIds.has(light.id));

  return [
    ...rooms,
    ...syntheticRoom('unassigned', 'Other', unassignedLights),
    ...syntheticRoom('sensors', 'Sensors', sensors)
  ];
}

function syntheticRoom(id, name, lights) {
  return lights.length > 0 ? [{ id, name, lights }] : [];
}

async function getLights() {
  const hueApi = await getApi();

  if (!hueApi) {
    return [];
  }

  const lights = await hueApi.lights.getAll();

  return lights.map(normalizers.normalizeLight);
}

async function getSensors() {
  const hueApi = await getApi();

  if (!hueApi) {
    return [];
  }

  const sensors = await hueApi.sensors.getAll();

  return sensors
    .filter(normalizers.isUserSensor)
    .map(normalizers.normalizeSensor);
}

async function getLight(lightId) {
  const hueApi = await getApi();

  if (!hueApi) {
    return null;
  }

  try {
    return normalizers.normalizeSingleLight(await hueApi.lights.getLight(lightId));
  } catch {
    return null;
  }
}

function remove() {
  storage.setHue(null);
  resetApi();
}

function setBroadcast(callback) {
  broadcastCallback = callback;
}

function broadcast(type, payload) {
  if (broadcastCallback) {
    broadcastCallback({ type, data: payload });
  }
}

function logToUI(message, level = 'info') {
  console.log(`[Hue] ${message}`);

  if (broadcastCallback) {
    broadcastCallback({ type: 'log', data: { source: 'Hue', message, level } });
  }
}

async function getApi() {
  const config = storage.getHue();

  if (!config?.ip || !config?.username) {
    return null;
  }

  if (!cachedApi) {
    cachedApi = await api.createLocal(config.ip).connect(config.username);
  }

  return cachedApi;
}

function resetApi() {
  cachedApi = null;
}

const { getDeviceCategory, getSensorCategory } = require('./hue-categories');
const { sensorValue, getSensorReadings } = require('./hue-sensor-history');

module.exports = {
  discover,
  pair,
  getBridge,
  getLights,
  getRooms,
  getLight,
  remove,
  getApi,
  resetApi,
  getDeviceCategory,
  getSensorCategory,
  getSensorReadings,
  sensorValue,
  setBroadcast,
  startPolling,
  stopPolling
};
