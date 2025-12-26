#!/usr/bin/env node

const { api } = require('node-hue-api');
const axios = require('axios');
const readline = require('readline-sync');
const fs = require('node:fs');
const dorita980 = require('dorita980');

const CONFIG_FILE = './network-config.json';

function loadConfig() {
  if (!fs.existsSync(CONFIG_FILE)) {
    return null;
  }

  try {
    const data = fs.readFileSync(CONFIG_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return null;
  }
}

function saveConfig(config) {
  const json = JSON.stringify(config, null, 2);
  fs.writeFileSync(CONFIG_FILE, json, 'utf-8');
}

async function getHueLights(config) {
  const hueApi = await api.createLocal(config.hue.ip).connect(config.hue.username);
  return await hueApi.lights.getAll();
}

async function getNanoleafInfo(config) {
  const { ip, port, authToken } = config.nanoleaf;
  const baseUrl = `http://${ip}:${port || 16021}/api/v1/${authToken}`;
  const response = await axios.get(baseUrl, { timeout: 5000 });
  return response.data;
}

async function getRoombaStatus(config) {
  if (!config.roomba?.ip || !config.roomba?.blid || !config.roomba?.password) {
    return null;
  }

  try {
    const robot = new dorita980.Local(config.roomba.blid, config.roomba.password, config.roomba.ip);
    const state = await robot.getRobotState(['batPct', 'name']);
    robot.end();
    return {
      name: state.name || 'Roomba',
      battery: state.batPct
    };
  } catch {
    return null;
  }
}

function formatLightState(light) {
  const state = light.state || light._data?.state;
  if (!state?.on) {
    return 'off';
  }

  const bri = state.bri !== undefined ? `${Math.round((state.bri / 254) * 100)}%` : '';
  return `on ${bri}`.trim();
}

async function main() {
  console.log('=== Sync Setup ===\n');

  const config = loadConfig();

  if (!config) {
    console.log('No configuration found. Run "node scan.js" first.');
    process.exit(1);
  }

  if (!config.nanoleaf?.ip || !config.nanoleaf?.authToken) {
    console.log('Nanoleaf not configured. Run "node scan.js" first.');
    process.exit(1);
  }

  console.log('Fetching devices...\n');

  const deviceList = [];
  let nanoleafInfo;

  try {
    nanoleafInfo = await getNanoleafInfo(config);
  } catch (err) {
    console.log(`Failed to connect to Nanoleaf: ${err.message}`);
    process.exit(1);
  }

  console.log(`Nanoleaf: ${nanoleafInfo.name} (${nanoleafInfo.panelLayout?.numPanels || '?'} panels)\n`);

  if (config.hue?.ip && config.hue?.username) {
    try {
      const lights = await getHueLights(config);

      lights.forEach(light => {
        const id = light.id || light._data?.id;
        const name = light.name || light._data?.name;
        const state = formatLightState(light);
        deviceList.push({
          type: 'hue',
          id,
          name,
          state,
          display: `[HUE] ${name} (${state})`
        });
      });
    } catch (err) {
      console.log(`Warning: Could not connect to Hue Bridge: ${err.message}`);
    }
  }

  if (config.roomba?.ip && config.roomba?.blid && config.roomba?.password) {
    const roombaStatus = await getRoombaStatus(config);
    if (roombaStatus) {
      deviceList.push({
        type: 'roomba',
        id: 'roomba',
        name: roombaStatus.name,
        state: `${roombaStatus.battery}% battery`,
        display: `[ROOMBA] ${roombaStatus.name} (${roombaStatus.battery}% battery)`
      });
    } else {
      deviceList.push({
        type: 'roomba',
        id: 'roomba',
        name: 'Roomba',
        state: 'configured',
        display: '[ROOMBA] Roomba (configured)'
      });
    }
  }

  if (config.airPurifiers?.length > 0) {
    config.airPurifiers.forEach(purifier => {
      deviceList.push({
        type: 'airpurifier',
        id: purifier.id,
        name: purifier.name,
        state: 'configured',
        display: `[AIR PURIFIER] ${purifier.name}`
      });
    });
  }

  if (deviceList.length === 0) {
    console.log('No devices found. Run "node scan.js" first to configure devices.');
    process.exit(1);
  }

  console.log('Available devices:\n');

  deviceList.forEach((device, index) => {
    const current = config.sync?.hueDeviceId === device.id ||
                   (config.sync?.deviceType === device.type && config.sync?.deviceId === device.id)
                   ? ' [CURRENT]' : '';
    console.log(`  ${index + 1}. ${device.display}${current}`);
  });

  console.log('');

  const selection = readline.questionInt(`Select device to sync (1-${deviceList.length}): `);

  if (selection < 1 || selection > deviceList.length) {
    console.log('Invalid selection.');
    process.exit(1);
  }

  const selectedDevice = deviceList[selection - 1];

  config.sync = {
    deviceType: selectedDevice.type,
    deviceId: selectedDevice.id,
    deviceName: selectedDevice.name,
    hueDeviceId: selectedDevice.type === 'hue' ? selectedDevice.id : null,
    hueDeviceName: selectedDevice.type === 'hue' ? selectedDevice.name : null
  };

  saveConfig(config);

  console.log(`\nSync configured: "${selectedDevice.name}" -> Nanoleaf "${nanoleafInfo.name}"`);
  console.log(`Configuration saved to ${CONFIG_FILE}`);
}

main();
