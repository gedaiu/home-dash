#!/usr/bin/env node

const { api } = require('node-hue-api');
const axios = require('axios');
const readline = require('readline-sync');
const fs = require('node:fs');

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

  if (!config.hue?.ip || !config.hue?.username) {
    console.log('Hue Bridge not configured. Run "node scan.js" first.');
    process.exit(1);
  }

  if (!config.nanoleaf?.ip || !config.nanoleaf?.authToken) {
    console.log('Nanoleaf not configured. Run "node scan.js" first.');
    process.exit(1);
  }

  console.log('Fetching devices...\n');

  let lights;
  let nanoleafInfo;

  try {
    lights = await getHueLights(config);
  } catch (err) {
    console.log(`Failed to connect to Hue Bridge: ${err.message}`);
    process.exit(1);
  }

  try {
    nanoleafInfo = await getNanoleafInfo(config);
  } catch (err) {
    console.log(`Failed to connect to Nanoleaf: ${err.message}`);
    process.exit(1);
  }

  console.log(`Nanoleaf: ${nanoleafInfo.name} (${nanoleafInfo.panelLayout?.numPanels || '?'} panels)\n`);
  console.log('Available Hue lights:\n');

  const lightList = lights.map((light, index) => {
    const id = light.id || light._data?.id;
    const name = light.name || light._data?.name;
    const state = formatLightState(light);
    return { id, name, state, index };
  });

  lightList.forEach((light, index) => {
    const current = config.sync?.hueDeviceId === light.id ? ' [CURRENT]' : '';
    console.log(`  ${index + 1}. ${light.name} (${light.state})${current}`);
  });

  console.log('');

  const selection = readline.questionInt(`Select light to sync (1-${lightList.length}): `);

  if (selection < 1 || selection > lightList.length) {
    console.log('Invalid selection.');
    process.exit(1);
  }

  const selectedLight = lightList[selection - 1];

  config.sync = {
    hueDeviceId: selectedLight.id,
    hueDeviceName: selectedLight.name
  };

  saveConfig(config);

  console.log(`\nSync configured: "${selectedLight.name}" -> Nanoleaf "${nanoleafInfo.name}"`);
  console.log(`Configuration saved to ${CONFIG_FILE}`);
}

main();
