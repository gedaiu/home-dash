const { discovery, api } = require('node-hue-api');
const storage = require('./storage');
const color = require('../lib/color');

const APP_NAME = 'hue-nanoleaf-sync';
const DEVICE_NAME = 'web-server';

let cachedApi = null;
let broadcastFn = null;
let pollTimer = null;
const previousLightStates = {};

const DISPLAY_HISTORY_LENGTH = 2880;
const POLL_INTERVAL_MS = 5000;

const savedData = storage.loadSensorData();
const sensorHistory = savedData.history || {};
const sensorDailyStats = savedData.dailyStats || {};
const displayHistory = {};

for (const [sensorId, entries] of Object.entries(sensorHistory)) {
  if (entries && entries.length > 0) {
    displayHistory[sensorId] = entries.slice(-DISPLAY_HISTORY_LENGTH).map(e => e.v);
  }
}

let saveTimeout = null;

function scheduleSave() {
  if (saveTimeout) {
    return;
  }

  saveTimeout = setTimeout(() => {
    storage.saveSensorData(sensorHistory, sensorDailyStats);
    saveTimeout = null;
  }, 5000);
}

function getToday() {
  return new Date().toISOString().split('T')[0];
}

function updateSensorHistory(sensorId, category, state) {
  let value = null;

  if (category === 'temperature' && state.temperature !== undefined) {
    value = state.temperature;
  } else if (category === 'motion') {
    value = state.presence ? 1 : 0;
  } else if (category === 'lightlevel' && state.lightlevel !== undefined) {
    value = state.lightlevel;
  }

  if (value === null) {
    return {
      history: displayHistory[sensorId] || [],
      dailyStats: null
    };
  }

  if (!displayHistory[sensorId]) {
    displayHistory[sensorId] = [];
  }

  displayHistory[sensorId].push(value);

  if (displayHistory[sensorId].length > DISPLAY_HISTORY_LENGTH) {
    displayHistory[sensorId].shift();
  }

  if (!sensorHistory[sensorId]) {
    sensorHistory[sensorId] = [];
  }

  const history = sensorHistory[sensorId];
  const lastEntry = history[history.length - 1];
  const now = Date.now();

  if (!lastEntry || lastEntry.v !== value) {
    history.push({ t: now, v: value });
    scheduleSave();
  }

  let dailyStats = null;

  if (category === 'temperature') {
    const today = getToday();

    if (!sensorDailyStats[sensorId] || sensorDailyStats[sensorId].date !== today) {
      sensorDailyStats[sensorId] = {
        date: today,
        min: value,
        max: value
      };
    } else {
      sensorDailyStats[sensorId].min = Math.min(sensorDailyStats[sensorId].min, value);
      sensorDailyStats[sensorId].max = Math.max(sensorDailyStats[sensorId].max, value);
    }

    dailyStats = {
      min: sensorDailyStats[sensorId].min,
      max: sensorDailyStats[sensorId].max
    };
  }

  if (category === 'motion' || category === 'temperature' || category === 'lightlevel') {
    return { history: sensorHistory[sensorId] || [], dailyStats };
  }

  return { history: displayHistory[sensorId], dailyStats };
}

async function discover() {
  let bridges = await discovery.nupnpSearch();

  if (bridges.length === 0) {
    bridges = await discovery.upnpSearch(5000);
  }

  return bridges.map(b => ({
    ip: b.ipaddress,
    id: b.config?.bridgeid || null
  }));
}

async function pair(ip) {
  const unauthenticatedApi = await api.createLocal(ip).connect();

  try {
    const createdUser = await unauthenticatedApi.users.createUser(APP_NAME, DEVICE_NAME);
    const config = {
      ip,
      username: createdUser.username
    };
    storage.setHue(config);
    return { success: true, config };
  } catch (err) {
    if (err.getHueErrorType && err.getHueErrorType() === 101) {
      return { success: false, error: 'Link button not pressed' };
    }
    throw err;
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
      ip: storage.getHue().ip
    };
  } catch {
    return null;
  }
}

function getDeviceCategory(type) {
  const t = (type || '').toLowerCase();

  if (t.includes('motion') || t.includes('presence')) {
    return 'motion';
  }
  if (t.includes('temperature')) {
    return 'temperature';
  }
  if (t.includes('daylight')) {
    return 'daylight';
  }
  if (t.includes('switch') || t.includes('button') || t.includes('dimmer') || t.includes('tap')) {
    return 'switch';
  }
  if (t.includes('plug')) {
    return 'plug';
  }
  if (t.includes('strip')) {
    return 'strip';
  }
  if (t.includes('candle')) {
    return 'candle';
  }
  if (t.includes('spot') || t.includes('recessed')) {
    return 'spot';
  }
  if (t.includes('pendant') || t.includes('ceiling')) {
    return 'ceiling';
  }
  if (t.includes('floor') || t.includes('table') || t.includes('lamp')) {
    return 'lamp';
  }
  if (t.includes('light') || t.includes('bulb')) {
    return 'bulb';
  }
  return 'device';
}

async function getLights() {
  const hueApi = await getApi();
  if (!hueApi) {
    return [];
  }

  const lights = await hueApi.lights.getAll();
  return lights.map(light => {
    const data = light._data || light;
    const lightData = data.data || data.populationData || data;
    const state = lightData.state || light.state || data.state;
    const archetype = lightData.config?.archetype || null;

    return {
      id: lightData.id || data.id,
      name: lightData.name || data.name,
      type: lightData.type || data.type,
      modelid: lightData.modelid || data.modelid,
      archetype,
      category: getDeviceCategory(lightData.type || data.type),
      state: {
        on: state.on,
        bri: state.bri,
        hue: state.hue,
        sat: state.sat,
        ct: state.ct,
        xy: state.xy,
        colormode: state.colormode,
        reachable: state.reachable
      }
    };
  });
}

function getSensorCategory(type) {
  const t = (type || '').toLowerCase();

  if (t.includes('presence') || t.includes('motion')) {
    return 'motion';
  }
  if (t.includes('temperature')) {
    return 'temperature';
  }
  if (t.includes('lightlevel') || t.includes('ambient')) {
    return 'lightlevel';
  }
  if (t.includes('daylight')) {
    return 'daylight';
  }
  if (t.includes('switch') || t.includes('button') || t.includes('rotary') || t.includes('tap')) {
    return 'switch';
  }
  return 'sensor';
}

async function getSensors() {
  const hueApi = await getApi();
  if (!hueApi) {
    return [];
  }

  const sensors = await hueApi.sensors.getAll();
  return sensors
    .filter(sensor => {
      const data = sensor._data || sensor;
      const type = data.type || data.data?.type || '';
      return !type.startsWith('CLIP') && type !== 'Daylight';
    })
    .map(sensor => {
      const data = sensor._data || sensor;
      const sensorData = data.data || data;
      const state = data.populationData?.state || sensorData.state || sensor.state || {};
      const sensorType = sensorData.type || data.type || '';
      const sensorId = sensorData.id || data.id;
      const sensorName = sensorData.name || data.name;
      const sensorModelid = sensorData.modelid || data.modelid;
      const sensorUniqueid = sensorData.uniqueid || data.uniqueid || '';
      const category = getSensorCategory(sensorType);
      const storageId = sensorUniqueid ? sensorUniqueid.replace(/[^a-zA-Z0-9]/g, '') : `sensor-${sensorId}`;

      const sensorState = {
        on: state.presence || state.buttonevent !== undefined || false,
        presence: state.presence,
        temperature: state.temperature !== undefined ? state.temperature / 100 : undefined,
        lightlevel: state.lightlevel,
        buttonevent: state.buttonevent,
        lastupdated: state.lastupdated
      };

      const { history, dailyStats } = updateSensorHistory(storageId, category, sensorState);

      return {
        id: storageId,
        sensorId: sensorId,
        name: sensorName,
        type: sensorType,
        modelid: sensorModelid,
        category,
        isSensor: true,
        state: sensorState,
        history,
        dailyStats
      };
    });
}

async function getRooms() {
  const hueApi = await getApi();
  if (!hueApi) {
    return [];
  }

  try {
    const groups = await hueApi.groups.getAll();
    const [lights, sensors] = await Promise.all([getLights(), getSensors()]);
    const lightMap = new Map(lights.map(l => [String(l.id), l]));

    const rooms = groups
      .filter(g => {
        const data = g._data || g;
        return data.type === 'Room';
      })
      .map(group => {
        const data = group._data || group;
        const groupData = data.data || data.populationData || data;
        const roomLights = (groupData.lights || data.lights || [])
          .map(id => lightMap.get(String(id)))
          .filter(Boolean);

        const roomClass = (groupData.class || 'Other')
          .toLowerCase()
          .replace(/\s+/g, '_');

        return {
          id: groupData.id || data.id,
          name: groupData.name || data.name,
          class: roomClass,
          lights: roomLights
        };
      });

    const assignedLightIds = new Set(rooms.flatMap(r => r.lights.map(l => l.id)));
    const unassignedLights = lights.filter(l => !assignedLightIds.has(l.id));

    if (unassignedLights.length > 0) {
      rooms.push({
        id: 'unassigned',
        name: 'Other',
        lights: unassignedLights
      });
    }

    if (sensors.length > 0) {
      rooms.push({
        id: 'sensors',
        name: 'Sensors',
        lights: sensors
      });
    }

    return rooms;
  } catch {
    const lights = await getLights();
    return [{
      id: 'all',
      name: 'All Lights',
      lights
    }];
  }
}

async function getLight(lightId) {
  const hueApi = await getApi();
  if (!hueApi) {
    return null;
  }

  try {
    const light = await hueApi.lights.getLight(lightId);
    const data = light._data || light;
    const state = light.state || data.state;
    return {
      id: data.id,
      name: data.name,
      state: {
        on: state.on,
        bri: state.bri,
        hue: state.hue,
        sat: state.sat,
        ct: state.ct,
        xy: state.xy,
        colormode: state.colormode,
        reachable: state.reachable
      }
    };
  } catch {
    return null;
  }
}

function remove() {
  storage.setHue(null);
  resetApi();
}

function setBroadcast(fn) {
  broadcastFn = fn;
}

function broadcast(type, data) {
  if (broadcastFn) {
    broadcastFn({ type, data });
  }
}

function lightStateChanged(prev, curr) {
  if (!prev) {
    return true;
  }
  return prev.on !== curr.on ||
         prev.bri !== curr.bri ||
         prev.hue !== curr.hue ||
         prev.sat !== curr.sat ||
         prev.ct !== curr.ct ||
         prev.colormode !== curr.colormode;
}

function trackLightChanges(rooms) {
  for (const room of rooms) {
    if (room.id === 'sensors') {
      continue;
    }

    for (const light of room.lights) {
      if (light.isSensor) {
        continue;
      }

      const key = `${light.id}`;
      const prev = previousLightStates[key];
      const curr = light.state;

      if (lightStateChanged(prev, curr)) {
        let rgb = { r: 0, g: 0, b: 0 };
        let mode = 'off';

        if (curr.on && curr.reachable) {
          rgb = color.getLightRgb(curr);
          mode = curr.colormode || 'unknown';
        } else if (!curr.reachable) {
          mode = 'unreachable';
        }

        storage.logLightChange(light.name, rgb, mode, curr);
        previousLightStates[key] = { ...curr };
      }
    }
  }
}

async function pollRooms() {
  try {
    const rooms = await getRooms();
    trackLightChanges(rooms);
    broadcast('rooms', rooms);
  } catch {
    // Ignore polling errors
  }
}

function startPolling() {
  if (pollTimer) {
    return;
  }

  pollTimer = setInterval(pollRooms, POLL_INTERVAL_MS);
  pollRooms();
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

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
  setBroadcast,
  startPolling,
  stopPolling
};
