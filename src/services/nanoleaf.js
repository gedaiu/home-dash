const axios = require('axios');
const storage = require('./storage');
const { discoverDevices, DEFAULT_PORT } = require('../discovery/nanoleaf');

const DISCOVERY_TIMEOUT = 10000;
const HTTP_FORBIDDEN = 403;

async function discover() {
  return discoverDevices(DISCOVERY_TIMEOUT);
}

async function pair(address, port = DEFAULT_PORT) {
  try {
    const response = await axios.post(`http://${address}:${port}/api/v1/new`, {}, { timeout: 5000 });
    const authToken = response.data.auth_token;

    if (!authToken) {
      return { success: false, error: 'Invalid response from Nanoleaf API' };
    }

    const config = {
      'ip': address,
      port,
      authToken,
      minBrightness: 5,
      maxBrightness: 100
    };

    storage.setNanoleaf(config);

    return { success: true, config };
  } catch (err) {
    return pairFailure(err, address, port);
  }
}

function pairFailure(err, address, port) {
  if (err.response?.status === HTTP_FORBIDDEN) {
    return { success: false, error: 'Not in pairing mode. Hold power button for 5-7 seconds.' };
  }

  if (err.code === 'ECONNREFUSED') {
    return { success: false, error: `Cannot connect to ${address}:${port}` };
  }

  throw err;
}

async function getDevice() {
  const baseUrl = getBaseUrl();

  if (!baseUrl) {
    return null;
  }

  try {
    const response = await axios.get(baseUrl, { timeout: 5000 });

    return summarizeDevice(response.data);
  } catch {
    return null;
  }
}

function summarizeDevice(device) {
  const layout = device.panelLayout?.layout;

  return {
    name: device.name,
    model: device.model,
    firmwareVersion: device.firmwareVersion,
    serialNo: device.serialNo,
    panelCount: layout?.numPanels || 0,
    state: summarizeState(device.state),
    effects: summarizeEffects(device.effects)
  };
}

function summarizeEffects(effects) {
  return {
    current: effects?.select,
    list: effects?.effectsList || []
  };
}

function summarizeState(deviceState) {
  return {
    'on': readValue(deviceState, 'on'),
    brightness: readValue(deviceState, 'brightness'),
    hue: readValue(deviceState, 'hue'),
    sat: readValue(deviceState, 'sat'),
    'ct': readValue(deviceState, 'ct'),
    colorMode: deviceState?.colorMode
  };
}

function readValue(section, key) {
  return section?.[key]?.value;
}

function getBaseUrl() {
  const config = storage.getNanoleaf();

  if (!config?.ip || !config?.authToken) {
    return null;
  }

  return `http://${config.ip}:${config.port || DEFAULT_PORT}/api/v1/${config.authToken}`;
}

async function setState(state) {
  const baseUrl = getBaseUrl();

  if (!baseUrl) {
    throw new Error('Nanoleaf not configured');
  }

  await axios.put(`${baseUrl}/state`, state, { timeout: 5000 });
}

async function setOn(isOn) {
  await setState({ 'on': { value: isOn } });
}

async function setBrightness(brightness) {
  await setState({ brightness: { value: brightness } });
}

async function setColor(hue, sat, brightness) {
  await setState({
    hue: { value: hue },
    sat: { value: sat },
    brightness: { value: brightness }
  });
}

async function createOrUpdateEffect(hue, sat, bri) {
  const baseUrl = getBaseUrl();

  if (!baseUrl) {
    throw new Error('Nanoleaf not configured');
  }

  const effect = {
    command: 'add',
    animName: 'HueSync',
    animType: 'random',
    colorType: 'HSB',
    palette: [
      { hue, saturation: sat, brightness: 100 },
      { hue, saturation: sat, brightness: 40 }
    ],
    brightnessRange: { minValue: 40, maxValue: 100 },
    transTime: { minValue: 20, maxValue: 30 },
    delayTime: { minValue: 10, maxValue: 20 },
    loop: true
  };

  await axios.put(`${baseUrl}/effects`, { write: effect }, { timeout: 5000 });
  await axios.put(`${baseUrl}/state`, { brightness: { value: bri } }, { timeout: 5000 });
}

async function selectEffect(effectName) {
  const baseUrl = getBaseUrl();

  if (!baseUrl) {
    throw new Error('Nanoleaf not configured');
  }

  await axios.put(`${baseUrl}/effects`, { select: effectName }, { timeout: 5000 });
}

function remove() {
  storage.setNanoleaf(null);
}

function getConfig() {
  return storage.getNanoleaf();
}

function updateConfig(updates) {
  const current = storage.getNanoleaf();

  if (!current) {
    throw new Error('Nanoleaf not configured');
  }

  storage.setNanoleaf({ ...current, ...updates });
}

module.exports = {
  discover,
  pair,
  getDevice,
  setState,
  setOn,
  setBrightness,
  setColor,
  createOrUpdateEffect,
  selectEffect,
  remove,
  getConfig,
  updateConfig
};
