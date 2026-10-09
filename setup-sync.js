#!/usr/bin/env node

const { api } = require('node-hue-api');
const axios = require('axios');
const readline = require('readline-sync');
const dorita980 = require('dorita980');
const { CONFIG_FILE, loadConfig, saveConfig } = require('./scripts/shared/network-config');
const { exitWhen, hasValues } = require('./scripts/shared/cli-checks');

const NANOLEAF_DEFAULT_PORT = 16021;
const NANOLEAF_TIMEOUT_MS = 5000;
const HUE_MAX_BRIGHTNESS = 254;
const PERCENT = 100;

async function main() {
  console.log('=== Sync Setup ===\n');

  const config = loadConfig();

  exitWhen(!config, 'No configuration found. Run "node scan.js" first.');
  exitWhen(
    !hasValues(config.nanoleaf, ['ip', 'authToken']),
    'Nanoleaf not configured. Run "node scan.js" first.'
  );

  console.log('Fetching devices...\n');

  const nanoleafInfo = await fetchNanoleafInfoOrExit(config);

  console.log(`Nanoleaf: ${nanoleafInfo.name} (${nanoleafInfo.panelLayout?.numPanels || '?'} panels)\n`);

  const deviceList = await collectDevices(config);

  exitWhen(deviceList.length === 0, 'No devices found. Run "node scan.js" first to configure devices.');

  const selectedDevice = selectDevice(config, deviceList);

  config.sync = buildSyncSettings(selectedDevice);
  saveConfig(config);

  console.log(`\nSync configured: "${selectedDevice.name}" -> Nanoleaf "${nanoleafInfo.name}"`);
  console.log(`Configuration saved to ${CONFIG_FILE}`);
}

async function fetchNanoleafInfoOrExit(config) {
  try {
    return await getNanoleafInfo(config);
  } catch (err) {
    console.log(`Failed to connect to Nanoleaf: ${err.message}`);

    return process.exit(1);
  }
}

async function getNanoleafInfo(config) {
  const { ip: panelIp, port, authToken } = config.nanoleaf;
  const baseUrl = `http://${panelIp}:${port || NANOLEAF_DEFAULT_PORT}/api/v1/${authToken}`;
  const response = await axios.get(baseUrl, { timeout: NANOLEAF_TIMEOUT_MS });

  return response.data;
}

async function collectDevices(config) {
  const [hueDevices, roombaDevices] = await Promise.all([
    collectHueDevices(config),
    collectRoombaDevices(config)
  ]);

  return [...hueDevices, ...roombaDevices, ...collectAirPurifierDevices(config)];
}

async function collectHueDevices(config) {
  if (!hasValues(config.hue, ['ip', 'username'])) {
    return [];
  }

  try {
    const lights = await getHueLights(config);

    return lights.map(createHueDevice);
  } catch (err) {
    console.log(`Warning: Could not connect to Hue Bridge: ${err.message}`);

    return [];
  }
}

async function getHueLights(config) {
  const hueApi = await api.createLocal(config.hue.ip).connect(config.hue.username);

  return await hueApi.lights.getAll();
}

function createHueDevice(light) {
  const name = light.name || light._data?.name;
  const state = formatLightState(light);

  return {
    type: 'hue',
    id: light.id || light._data?.id,
    name,
    state,
    display: `[HUE] ${name} (${state})`
  };
}

function formatLightState(light) {
  const state = light.state || light._data?.state;

  if (!state?.on) {
    return 'off';
  }

  return `on ${formatBrightness(state)}`.trim();
}

function formatBrightness(state) {
  if (state.bri === undefined) {
    return '';
  }

  return `${Math.round((state.bri / HUE_MAX_BRIGHTNESS) * PERCENT)}%`;
}

async function collectRoombaDevices(config) {
  if (!hasValues(config.roomba, ['ip', 'blid', 'password'])) {
    return [];
  }

  return [createRoombaDevice(await getRoombaStatus(config))];
}

async function getRoombaStatus({ roomba }) {
  try {
    const robot = new dorita980.Local(roomba.blid, roomba.password, roomba.ip);
    const robotState = await robot.getRobotState(['batPct', 'name']);

    robot.end();

    return {
      name: robotState.name || 'Roomba',
      battery: robotState.batPct
    };
  } catch {
    return null;
  }
}

function createRoombaDevice(roombaStatus) {
  if (!roombaStatus) {
    return {
      type: 'roomba',
      id: 'roomba',
      name: 'Roomba',
      state: 'configured',
      display: '[ROOMBA] Roomba (configured)'
    };
  }

  return {
    type: 'roomba',
    id: 'roomba',
    name: roombaStatus.name,
    state: `${roombaStatus.battery}% battery`,
    display: `[ROOMBA] ${roombaStatus.name} (${roombaStatus.battery}% battery)`
  };
}

function collectAirPurifierDevices(config) {
  return (config.airPurifiers || []).map(purifier => ({
    type: 'airpurifier',
    id: purifier.id,
    name: purifier.name,
    state: 'configured',
    display: `[AIR PURIFIER] ${purifier.name}`
  }));
}

function selectDevice(config, deviceList) {
  console.log('Available devices:\n');

  deviceList.forEach((device, index) => {
    const marker = isCurrentDevice(config.sync, device) ? ' [CURRENT]' : '';

    console.log(`  ${index + 1}. ${device.display}${marker}`);
  });

  console.log('');

  const selection = readline.questionInt(`Select device to sync (1-${deviceList.length}): `);

  exitWhen(selection < 1 || selection > deviceList.length, 'Invalid selection.');

  return deviceList[selection - 1];
}

function isCurrentDevice(sync, device) {
  const isSameDevice = sync?.deviceId === device.id;

  return sync?.hueDeviceId === device.id || (sync?.deviceType === device.type && isSameDevice);
}

function buildSyncSettings(selectedDevice) {
  const isHue = selectedDevice.type === 'hue';

  return {
    deviceType: selectedDevice.type,
    deviceId: selectedDevice.id,
    deviceName: selectedDevice.name,
    hueDeviceId: isHue ? selectedDevice.id : null,
    hueDeviceName: isHue ? selectedDevice.name : null
  };
}

main();
