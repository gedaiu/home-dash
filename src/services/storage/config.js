const { storagePaths } = require('./paths');
const { readJsonFile, writeJsonFile } = require('./json-file');

function getHue() {
  return load().hue;
}

function setHue(hueConfig) {
  setConfigSection('hue', hueConfig);
}

function getNanoleaf() {
  return load().nanoleaf;
}

function setNanoleaf(nanoleafConfig) {
  setConfigSection('nanoleaf', nanoleafConfig);
}

function getSync() {
  return load().sync;
}

function setSync(syncConfig) {
  setConfigSection('sync', syncConfig);
}

function getRoomba() {
  return load().roomba || null;
}

function setRoomba(roombaConfig) {
  setConfigSection('roomba', roombaConfig);
}

function setHomeConnect(homeConnectConfig) {
  setConfigSection('homeConnect', homeConnectConfig);
}

function getHomeConnectTokens() {
  const homeConnect = getHomeConnect();

  return homeConnect?.tokens || null;
}

function getHomeConnect() {
  return load().homeConnect || null;
}

function setHomeConnectTokens(tokens) {
  const config = load();
  config.homeConnect = { ...config.homeConnect, tokens };
  save(config);
}

function getWeather() {
  return load().weather || null;
}

function setWeather(weatherConfig) {
  setConfigSection('weather', weatherConfig);
}

function getTransport() {
  return load().transport || null;
}

function setTransport(transportConfig) {
  setConfigSection('transport', transportConfig);
}

function setConfigSection(section, value) {
  const config = load();
  config[section] = value;
  save(config);
}

function load() {
  return readJsonFile(storagePaths.configFile, { hue: null, nanoleaf: null, sync: null });
}

function save(config) {
  writeJsonFile(storagePaths.configFile, config);
}

module.exports = {
  load,
  save,
  getHue,
  setHue,
  getNanoleaf,
  setNanoleaf,
  getSync,
  setSync,
  getRoomba,
  setRoomba,
  getHomeConnect,
  setHomeConnect,
  getHomeConnectTokens,
  setHomeConnectTokens,
  getWeather,
  setWeather,
  getTransport,
  setTransport
};
