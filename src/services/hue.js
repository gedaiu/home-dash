const { discovery, api } = require('node-hue-api');
const storage = require('./storage');

const APP_NAME = 'hue-nanoleaf-sync';
const DEVICE_NAME = 'web-server';

let cachedApi = null;

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
    const state = light.state || data.state;
    return {
      id: data.id,
      name: data.name,
      type: data.type,
      modelid: data.modelid,
      category: getDeviceCategory(data.type),
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

      return {
        id: `sensor-${sensorId}`,
        sensorId: sensorId,
        name: sensorName,
        type: sensorType,
        modelid: sensorModelid,
        category: getSensorCategory(sensorType),
        isSensor: true,
        state: {
          on: state.presence || state.buttonevent !== undefined || false,
          presence: state.presence,
          temperature: state.temperature !== undefined ? state.temperature / 100 : undefined,
          lightlevel: state.lightlevel,
          buttonevent: state.buttonevent,
          lastupdated: state.lastupdated
        }
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
        const roomLights = (data.lights || [])
          .map(id => lightMap.get(String(id)))
          .filter(Boolean);

        return {
          id: data.id,
          name: data.name,
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

module.exports = {
  discover,
  pair,
  getBridge,
  getLights,
  getRooms,
  getLight,
  remove,
  getApi,
  resetApi
};
