const Bonjour = require('bonjour-service').default;
const axios = require('axios');
const storage = require('./storage');

const DEFAULT_PORT = 16021;
const DISCOVERY_TIMEOUT = 10000;

async function discover() {
  return new Promise((resolve) => {
    const bonjour = new Bonjour();
    const foundDevices = [];

    const browser = bonjour.find({ type: 'nanoleafapi' });

    browser.on('up', (service) => {
      const ip = service.addresses?.find((addr) => !addr.includes(':')) || service.host;
      const port = service.port || DEFAULT_PORT;

      foundDevices.push({
        name: service.name,
        ip,
        port
      });
    });

    setTimeout(() => {
      browser.stop();
      bonjour.destroy();
      resolve(foundDevices);
    }, DISCOVERY_TIMEOUT);
  });
}

async function pair(ip, port = DEFAULT_PORT) {
  try {
    const response = await axios.post(`http://${ip}:${port}/api/v1/new`, {}, { timeout: 5000 });
    const authToken = response.data.auth_token;

    if (!authToken) {
      return { success: false, error: 'Invalid response from Nanoleaf API' };
    }

    const config = {
      ip,
      port,
      authToken,
      minBrightness: 5,
      maxBrightness: 100
    };

    storage.setNanoleaf(config);
    return { success: true, config };
  } catch (err) {
    if (err.response?.status === 403) {
      return { success: false, error: 'Not in pairing mode. Hold power button for 5-7 seconds.' };
    }
    if (err.code === 'ECONNREFUSED') {
      return { success: false, error: `Cannot connect to ${ip}:${port}` };
    }
    throw err;
  }
}

function getBaseUrl() {
  const config = storage.getNanoleaf();
  if (!config?.ip || !config?.authToken) {
    return null;
  }
  return `http://${config.ip}:${config.port || DEFAULT_PORT}/api/v1/${config.authToken}`;
}

async function getDevice() {
  const baseUrl = getBaseUrl();
  if (!baseUrl) {
    return null;
  }

  try {
    const response = await axios.get(baseUrl, { timeout: 5000 });
    const data = response.data;
    return {
      name: data.name,
      model: data.model,
      firmwareVersion: data.firmwareVersion,
      serialNo: data.serialNo,
      panelCount: data.panelLayout?.numPanels || 0,
      state: {
        on: data.state?.on?.value,
        brightness: data.state?.brightness?.value,
        hue: data.state?.hue?.value,
        sat: data.state?.sat?.value,
        ct: data.state?.ct?.value,
        colorMode: data.state?.colorMode
      },
      effects: {
        current: data.effects?.select,
        list: data.effects?.effectsList || []
      }
    };
  } catch {
    return null;
  }
}

async function setState(state) {
  const baseUrl = getBaseUrl();
  if (!baseUrl) {
    throw new Error('Nanoleaf not configured');
  }

  await axios.put(`${baseUrl}/state`, state, { timeout: 5000 });
}

async function setOn(on) {
  await setState({ on: { value: on } });
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
