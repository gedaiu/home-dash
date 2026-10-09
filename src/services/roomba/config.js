const storage = require('../storage');

function isConfigured() {
  return hasConnectionDetails(getConfig());
}

function hasConnectionDetails(config) {
  return Boolean(config?.ip && config?.blid && config?.password);
}

function getConfig() {
  return storage.getRoomba();
}

module.exports = { isConfigured, hasConnectionDetails, getConfig };
