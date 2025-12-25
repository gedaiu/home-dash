#!/usr/bin/env node

const { api } = require('node-hue-api');
const axios = require('axios');
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

async function verifyHue(config) {
  if (!config?.hue?.ip || !config?.hue?.username) {
    console.log('Hue: Not configured');
    return false;
  }

  console.log(`Hue: Connecting to ${config.hue.ip}...`);

  try {
    const hueApi = await api.createLocal(config.hue.ip).connect(config.hue.username);
    const bridgeConfig = await hueApi.configuration.getConfiguration();

    console.log(`Hue: Connected to "${bridgeConfig.name}"`);
    console.log(`Hue: Bridge ID ${bridgeConfig.bridgeid}`);
    console.log(`Hue: API version ${bridgeConfig.apiversion}`);

    const lights = await hueApi.lights.getAll();
    console.log(`Hue: ${lights.length} light(s) available`);

    return true;
  } catch (err) {
    console.log(`Hue: Connection failed - ${err.message}`);
    return false;
  }
}

async function verifyNanoleaf(config) {
  if (!config?.nanoleaf?.ip || !config?.nanoleaf?.authToken) {
    console.log('Nanoleaf: Not configured');
    return false;
  }

  const { ip, port, authToken } = config.nanoleaf;
  const baseUrl = `http://${ip}:${port || 16021}/api/v1/${authToken}`;

  console.log(`Nanoleaf: Connecting to ${ip}:${port || 16021}...`);

  try {
    const response = await axios.get(baseUrl, { timeout: 5000 });
    const data = response.data;

    console.log(`Nanoleaf: Connected to "${data.name}"`);
    console.log(`Nanoleaf: Model ${data.model}`);
    console.log(`Nanoleaf: Firmware ${data.firmwareVersion}`);
    console.log(`Nanoleaf: ${data.panelLayout?.numPanels || 'Unknown'} panel(s)`);

    return true;
  } catch (err) {
    if (err.response?.status === 401) {
      console.log('Nanoleaf: Authentication failed - token may be invalid');
    } else if (err.code === 'ECONNREFUSED') {
      console.log(`Nanoleaf: Connection refused at ${ip}:${port || 16021}`);
    } else {
      console.log(`Nanoleaf: Connection failed - ${err.message}`);
    }
    return false;
  }
}

async function main() {
  console.log('=== Device Verification ===\n');

  const config = loadConfig();

  if (!config) {
    console.log('No configuration found. Run "node scan.js" first.');
    process.exit(1);
  }

  const hueOk = await verifyHue(config);
  console.log('');
  const nanoleafOk = await verifyNanoleaf(config);

  console.log('\n=== Summary ===');
  console.log(`Hue Bridge: ${hueOk ? 'OK' : 'FAILED'}`);
  console.log(`Nanoleaf: ${nanoleafOk ? 'OK' : 'FAILED'}`);

  process.exit(hueOk || nanoleafOk ? 0 : 1);
}

main();
