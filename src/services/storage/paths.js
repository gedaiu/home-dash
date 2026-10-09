const fs = require('node:fs');
const path = require('node:path');

function buildStoragePaths() {
  const isTest = process.env.NODE_ENV === 'test';
  const projectRoot = path.join(__dirname, '../../..');
  const defaultConfigFile = isTest ? 'data/test-config.json' : 'network-config.json';
  const dataDir = process.env.HOME_DASHBOARD_DATA || path.join(projectRoot, 'data');

  return {
    isTest,
    configFile: process.env.HOME_DASHBOARD_CONFIG || path.join(projectRoot, defaultConfigFile),
    dataDir,
    sensorsDir: path.join(dataDir, 'sensors'),
    logsDir: path.join(dataDir, 'logs'),
    panelNamesFile: path.join(dataDir, 'panel-names.json'),
    coapStateFile: path.join(dataDir, 'coap-state.json'),
    devicesFile: path.join(dataDir, 'devices.json'),
    homeConnectCacheFile: path.join(dataDir, 'homeconnect-cache.json')
  };
}

const storagePaths = buildStoragePaths();

function ensureSensorsDir() {
  ensureDataDir();
  ensureDir(storagePaths.sensorsDir);
}

function ensureLogsDir() {
  ensureDataDir();
  ensureDir(storagePaths.logsDir);
}

function ensureDataDir() {
  ensureDir(storagePaths.dataDir);
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

module.exports = { storagePaths, ensureDataDir, ensureSensorsDir, ensureLogsDir };
