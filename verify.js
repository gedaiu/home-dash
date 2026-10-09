#!/usr/bin/env node

const { api } = require('node-hue-api');
const axios = require('axios');
const { loadConfig } = require('./scripts/shared/network-config');

const NANOLEAF_DEFAULT_PORT = 16021;
const NANOLEAF_TIMEOUT_MS = 5000;
const HTTP_UNAUTHORIZED = 401;

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

async function verifyHue(config) {
  const { ip: bridgeIp, username } = config?.hue || {};

  if (!bridgeIp || !username) {
    console.log('Hue: Not configured');

    return false;
  }

  console.log(`Hue: Connecting to ${bridgeIp}...`);

  try {
    await printHueSummary(bridgeIp, username);

    return true;
  } catch (err) {
    console.log(`Hue: Connection failed - ${err.message}`);

    return false;
  }
}

async function printHueSummary(bridgeIp, username) {
  const hueApi = await api.createLocal(bridgeIp).connect(username);
  const bridgeConfig = await hueApi.configuration.getConfiguration();

  console.log(`Hue: Connected to "${bridgeConfig.name}"`);
  console.log(`Hue: Bridge ID ${bridgeConfig.bridgeid}`);
  console.log(`Hue: API version ${bridgeConfig.apiversion}`);

  const lights = await hueApi.lights.getAll();

  console.log(`Hue: ${lights.length} light(s) available`);
}

async function verifyNanoleaf(config) {
  const { ip: panelIp, port, authToken } = config?.nanoleaf || {};

  if (!panelIp || !authToken) {
    console.log('Nanoleaf: Not configured');

    return false;
  }

  const address = buildNanoleafAddress(panelIp, port);

  console.log(`Nanoleaf: Connecting to ${address}...`);

  try {
    await printNanoleafSummary(`http://${address}/api/v1/${authToken}`);

    return true;
  } catch (err) {
    console.log(describeNanoleafFailure(err, address));

    return false;
  }
}

function buildNanoleafAddress(panelIp, port) {
  return `${panelIp}:${port || NANOLEAF_DEFAULT_PORT}`;
}

async function printNanoleafSummary(baseUrl) {
  const { data: controller } = await axios.get(baseUrl, { timeout: NANOLEAF_TIMEOUT_MS });

  console.log(`Nanoleaf: Connected to "${controller.name}"`);
  console.log(`Nanoleaf: Model ${controller.model}`);
  console.log(`Nanoleaf: Firmware ${controller.firmwareVersion}`);
  console.log(`Nanoleaf: ${controller.panelLayout?.numPanels || 'Unknown'} panel(s)`);
}

function describeNanoleafFailure(err, address) {
  if (err.response?.status === HTTP_UNAUTHORIZED) {
    return 'Nanoleaf: Authentication failed - token may be invalid';
  }

  if (err.code === 'ECONNREFUSED') {
    return `Nanoleaf: Connection refused at ${address}`;
  }

  return `Nanoleaf: Connection failed - ${err.message}`;
}

main();
