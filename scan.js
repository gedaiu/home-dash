#!/usr/bin/env node

const { discovery, api } = require('node-hue-api');
const Bonjour = require('bonjour-service').default;
const axios = require('axios');
const readline = require('readline-sync');
const fs = require('node:fs');
const fsPromises = require('node:fs/promises');

const CONFIG_FILE = './network-config.json';
const NANOLEAF_DEFAULT_PORT = 16021;
const APP_NAME = 'hue-nanoleaf-sync';
const DEVICE_NAME = 'cli-scanner';

async function discoverHueBridge() {
  console.log('Scanning for Philips Hue Bridge...');

  let bridges = await discovery.nupnpSearch();

  if (bridges.length === 0) {
    console.log('N-UPnP search found nothing, trying UPnP (takes ~5 seconds)...');
    bridges = await discovery.upnpSearch(5000);
  }

  if (bridges.length === 0) {
    throw new Error('No Hue Bridge found on the network');
  }

  const bridge = bridges[0];
  console.log(`Found Hue Bridge at ${bridge.ipaddress}`);
  return bridge.ipaddress;
}

async function discoverNanoleaf(timeout = 10000) {
  console.log('\nScanning for Nanoleaf panels...');

  return new Promise((resolve) => {
    const bonjour = new Bonjour();
    const foundDevices = [];

    const browser = bonjour.find({ type: 'nanoleafapi' });

    browser.on('up', (service) => {
      const ip = service.addresses?.find((addr) => !addr.includes(':')) || service.host;
      const port = service.port || NANOLEAF_DEFAULT_PORT;

      console.log(`Found Nanoleaf: ${service.name} at ${ip}:${port}`);
      foundDevices.push({ name: service.name, ip, port });
    });

    setTimeout(() => {
      browser.stop();
      bonjour.destroy();

      if (foundDevices.length === 0) {
        console.log('No Nanoleaf devices found on the network.');
        resolve(null);
      } else {
        resolve(foundDevices[0]);
      }
    }, timeout);
  });
}

async function authenticateHueBridge(ipAddress) {
  console.log('\n=== Hue Bridge Authentication ===');

  const unauthenticatedApi = await api.createLocal(ipAddress).connect();
  const maxRetries = 3;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    readline.question('Press the Link button on your Hue Bridge, then press Enter... ');

    try {
      const createdUser = await unauthenticatedApi.users.createUser(APP_NAME, DEVICE_NAME);
      console.log('Successfully authenticated with Hue Bridge!');
      return createdUser.username;
    } catch (err) {
      const isLinkButtonError = err.getHueErrorType && err.getHueErrorType() === 101;

      if (isLinkButtonError) {
        console.log(`Link button not pressed (attempt ${attempt}/${maxRetries})`);
        if (attempt < maxRetries) {
          console.log('Please try again...');
        }
      } else {
        throw err;
      }
    }
  }

  throw new Error('Failed to authenticate with Hue Bridge after maximum retries');
}

async function authenticateNanoleaf(ip, port) {
  console.log('\n=== Nanoleaf Authentication ===');

  const maxRetries = 3;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    readline.question('Hold the power button on your Nanoleaf for 5-7 seconds until the LED flashes, then press Enter... ');

    try {
      const response = await axios.post(`http://${ip}:${port}/api/v1/new`, {}, { timeout: 5000 });
      const authToken = response.data.auth_token;

      if (!authToken) {
        throw new Error('Invalid response from Nanoleaf API: missing auth_token');
      }

      console.log('Successfully authenticated with Nanoleaf!');
      return authToken;
    } catch (err) {
      if (err.response?.status === 403) {
        console.log(`Nanoleaf not in pairing mode (attempt ${attempt}/${maxRetries})`);
        if (attempt < maxRetries) {
          console.log('Please try again - hold the power button for 5-7 seconds...');
        }
      } else if (err.code === 'ECONNREFUSED') {
        throw new Error(`Cannot connect to Nanoleaf at ${ip}:${port}`);
      } else {
        throw err;
      }
    }
  }

  throw new Error('Failed to authenticate with Nanoleaf after maximum retries');
}

async function saveConfig(config) {
  const json = JSON.stringify(config, null, 2);
  await fsPromises.writeFile(CONFIG_FILE, json, 'utf-8');
  console.log(`\nConfiguration saved to ${CONFIG_FILE}`);
}

function loadExistingConfig() {
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

function hasHueConfig(config) {
  return config?.hue?.ip && config?.hue?.username;
}

function hasNanoleafConfig(config) {
  return config?.nanoleaf?.ip && config?.nanoleaf?.authToken;
}

async function main() {
  console.log('=== Hue/Nanoleaf Network Scanner ===\n');

  const existingConfig = loadExistingConfig();
  let resetHue = true;
  let resetNanoleaf = true;

  if (hasHueConfig(existingConfig)) {
    console.log(`Hue Bridge already configured (${existingConfig.hue.ip})`);
    resetHue = readline.keyInYN('Reset Hue Bridge configuration?');
  }

  if (hasNanoleafConfig(existingConfig)) {
    console.log(`Nanoleaf already configured (${existingConfig.nanoleaf.ip})`);
    resetNanoleaf = readline.keyInYN('Reset Nanoleaf configuration?');
  }

  const config = {
    hue: resetHue ? { ip: null, username: null } : existingConfig.hue,
    nanoleaf: resetNanoleaf ? { ip: null, port: null, authToken: null } : existingConfig.nanoleaf
  };

  try {
    let hueIp = null;
    let nanoleaf = null;

    if (resetHue) {
      try {
        hueIp = await discoverHueBridge();
        config.hue.ip = hueIp;
      } catch (err) {
        console.log(`Hue Bridge discovery failed: ${err.message}`);
      }
    }

    if (resetNanoleaf) {
      nanoleaf = await discoverNanoleaf();
      if (nanoleaf) {
        config.nanoleaf.ip = nanoleaf.ip;
        config.nanoleaf.port = nanoleaf.port;
      }
    }

    if (!resetHue && !resetNanoleaf) {
      console.log('\nNo devices to configure. Exiting.');
      process.exit(0);
    }

    if (resetHue && !hueIp && resetNanoleaf && !nanoleaf) {
      console.error('\nNo devices found on the network. Exiting.');
      process.exit(1);
    }

    if (hueIp) {
      config.hue.username = await authenticateHueBridge(hueIp);
    }

    if (nanoleaf) {
      config.nanoleaf.authToken = await authenticateNanoleaf(nanoleaf.ip, nanoleaf.port);
    }

    await saveConfig(config);

    console.log('\n=== Setup Complete ===');
    console.log('You can now use the saved credentials to control your devices.');
  } catch (err) {
    console.error(`\nError: ${err.message}`);
    process.exit(1);
  }
}

main();
