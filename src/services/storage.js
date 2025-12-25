const fs = require('node:fs');
const path = require('node:path');

const CONFIG_FILE = path.join(__dirname, '../../network-config.json');

function load() {
  if (!fs.existsSync(CONFIG_FILE)) {
    return { hue: null, nanoleaf: null, sync: null };
  }

  try {
    const data = fs.readFileSync(CONFIG_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return { hue: null, nanoleaf: null, sync: null };
  }
}

function save(config) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
}

function getHue() {
  return load().hue;
}

function setHue(hueConfig) {
  const config = load();
  config.hue = hueConfig;
  save(config);
}

function getNanoleaf() {
  return load().nanoleaf;
}

function setNanoleaf(nanoleafConfig) {
  const config = load();
  config.nanoleaf = nanoleafConfig;
  save(config);
}

function getSync() {
  return load().sync;
}

function setSync(syncConfig) {
  const config = load();
  config.sync = syncConfig;
  save(config);
}

module.exports = {
  load,
  save,
  getHue,
  setHue,
  getNanoleaf,
  setNanoleaf,
  getSync,
  setSync
};
