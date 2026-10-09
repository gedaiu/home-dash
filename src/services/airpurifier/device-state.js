const storage = require('../storage');
const { buildCoapUrl } = require('./coap-client');

const devices = new Map();

function getDeviceState(index) {
  if (!devices.has(index)) {
    devices.set(index, {
      connected: false,
      counter: null,
      status: null,
      lastUpdate: null,
      observing: false
    });
  }

  return devices.get(index);
}

function forgetDeviceState(index) {
  devices.delete(index);
}

function getConfig(index) {
  return storage.getAirPurifier(index);
}

function getAllConfigs() {
  return storage.getAirPurifiers();
}

function isConfigured(index) {
  return Boolean(getConfig(index)?.ip);
}

function getBaseUrl(index) {
  const config = getConfig(index);

  if (!config?.ip) {
    return null;
  }

  return buildCoapUrl(config.ip);
}

function getDeviceName(index) {
  return getConfig(index)?.name || `Purifier ${index + 1}`;
}

module.exports = {
  getDeviceState,
  forgetDeviceState,
  getConfig,
  getAllConfigs,
  isConfigured,
  getBaseUrl,
  getDeviceName
};
