const fs = require('node:fs');

const CONFIG_FILE = './network-config.json';
const JSON_INDENT = 2;

function loadConfig() {
  if (!fs.existsSync(CONFIG_FILE)) {
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
  } catch {
    return null;
  }
}

function saveConfig(config) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, JSON_INDENT), 'utf-8');
}

module.exports = { CONFIG_FILE, loadConfig, saveConfig };
