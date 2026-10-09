const { storagePaths, ensureDataDir } = require('./paths');
const { readJsonFile, writeJsonFile } = require('./json-file');

function getHomeConnectCache() {
  ensureDataDir();

  return readJsonFile(storagePaths.homeConnectCacheFile, { statuses: [], lastPollTime: 0 });
}

function setHomeConnectCache(statuses, lastPollTime) {
  ensureDataDir();
  writeJsonFile(storagePaths.homeConnectCacheFile, { statuses, lastPollTime });
}

function setPanelName(key, name) {
  const names = getPanelNames();
  names[key] = name;
  writeJsonFile(storagePaths.panelNamesFile, names);
}

function deletePanelName(key) {
  const names = getPanelNames();
  delete names[key];
  writeJsonFile(storagePaths.panelNamesFile, names);
}

function getPanelNames() {
  ensureDataDir();

  return readJsonFile(storagePaths.panelNamesFile, {});
}

function getCoapState() {
  ensureDataDir();

  return readJsonFile(storagePaths.coapStateFile, {});
}

function setCoapState(state) {
  ensureDataDir();
  writeJsonFile(storagePaths.coapStateFile, state);
}

function getDevice(mac) {
  return getDevices()[mac] || null;
}

function setDevice(mac, deviceConfig) {
  const devices = getDevices();
  devices[mac] = { ...devices[mac], ...deviceConfig, mac, updatedAt: Date.now() };
  saveDevices(devices);

  return devices[mac];
}

function deleteDevice(mac) {
  const devices = getDevices();
  delete devices[mac];
  saveDevices(devices);
}

function getDevices() {
  ensureDataDir();

  return readJsonFile(storagePaths.devicesFile, {});
}

function saveDevices(devices) {
  ensureDataDir();
  writeJsonFile(storagePaths.devicesFile, devices);
}

module.exports = {
  getHomeConnectCache,
  setHomeConnectCache,
  getPanelNames,
  setPanelName,
  deletePanelName,
  getCoapState,
  setCoapState,
  getDevices,
  getDevice,
  setDevice,
  deleteDevice
};
