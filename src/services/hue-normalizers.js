const { getDeviceCategory, getSensorCategory } = require('./hue-categories');
const { sensorValue, recordLatestReading, updateSensorHistory } = require('./hue-sensor-history');

const LIGHT_STATE_FIELDS = ['on', 'bri', 'hue', 'sat', 'ct', 'xy', 'colormode', 'reachable'];
const CENTIDEGREES_PER_DEGREE = 100;

function normalizeLight(light) {
  const raw = rawOf(light);
  const payload = payloadOf(raw);
  const read = name => payload[name] || raw[name];

  return {
    id: read('id'),
    name: read('name'),
    type: read('type'),
    modelid: read('modelid'),
    archetype: payload.config?.archetype || null,
    category: getDeviceCategory(read('type')),
    state: pickLightState(payload.state || light.state || raw.state)
  };
}

function normalizeRoom(group, lightsById) {
  const raw = rawOf(group);
  const payload = payloadOf(raw);
  const read = name => payload[name] || raw[name];
  const lightIds = payload.lights || raw.lights || [];
  const roomClass = (payload.class || 'Other').toLowerCase().replace(/\s+/g, '_');

  return {
    id: read('id'),
    name: read('name'),
    class: roomClass,
    lights: lightIds.map(lightId => lightsById.get(String(lightId))).filter(Boolean)
  };
}

function isRoomGroup(group) {
  return rawOf(group).type === 'Room';
}

function isUserSensor(sensor) {
  const raw = rawOf(sensor);
  const type = raw.type || raw.data?.type || '';

  return !type.startsWith('CLIP') && type !== 'Daylight';
}

function normalizeSensor(sensor) {
  const raw = rawOf(sensor);
  const payload = raw.data || raw;
  const read = name => payload[name] || raw[name];
  const sensorType = read('type') || '';
  const category = getSensorCategory(sensorType);
  const storageId = sensorStorageId(read('uniqueid') || '', read('id'));
  const sensorState = toSensorState(sensor, raw, payload);
  const { history, dailyStats } = updateSensorHistory(storageId, category, sensorState);

  recordLatestReading(storageId, { name: read('name'), category, value: sensorValue(category, sensorState) });

  return {
    id: storageId,
    sensorId: read('id'),
    name: read('name'),
    type: sensorType,
    modelid: read('modelid'),
    category,
    isSensor: true,
    state: sensorState,
    history,
    dailyStats
  };
}

function toSensorState(sensor, raw, payload) {
  const nestedState = raw.populationData?.state || payload.state;
  const state = nestedState || sensor.state || {};

  return {
    'on': isSensorActive(state),
    presence: state.presence,
    temperature: degreesOf(state),
    lightlevel: state.lightlevel,
    buttonevent: state.buttonevent,
    lastupdated: state.lastupdated
  };
}

function isSensorActive(state) {
  return state.presence || state.buttonevent !== undefined || false;
}

function degreesOf(state) {
  return state.temperature === undefined ? undefined : state.temperature / CENTIDEGREES_PER_DEGREE;
}

function sensorStorageId(uniqueId, sensorId) {
  return uniqueId ? uniqueId.replace(/[^a-zA-Z0-9]/g, '') : `sensor-${sensorId}`;
}

function normalizeSingleLight(light) {
  const raw = rawOf(light);

  return {
    id: raw.id,
    name: raw.name,
    state: pickLightState(light.state || raw.state)
  };
}

function pickLightState(state) {
  return Object.fromEntries(LIGHT_STATE_FIELDS.map(field => [field, state[field]]));
}

function payloadOf(raw) {
  return raw.data || raw.populationData || raw;
}

function rawOf(device) {
  return device._data || device;
}

module.exports = {
  normalizeLight,
  normalizeRoom,
  isRoomGroup,
  isUserSensor,
  normalizeSensor,
  normalizeSingleLight
};
