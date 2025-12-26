#!/usr/bin/env node

const { discovery, api } = require('node-hue-api');
const Bonjour = require('bonjour-service').default;
const axios = require('axios');
const readline = require('readline-sync');
const fs = require('node:fs');
const fsPromises = require('node:fs/promises');
const dgram = require('node:dgram');
const { HttpClient, PlainCoapClient, CoapClient } = require('philips-air');
const dorita980 = require('dorita980');

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

async function discoverAirPurifiers(timeout = 10000) {
  console.log('\nScanning for Philips Air Purifiers (SSDP)...');

  return new Promise((resolve) => {
    const devices = [];
    const seen = new Set();

    const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });

    socket.on('error', () => {
      socket.close();
      resolve(devices);
    });

    socket.on('message', (msg, rinfo) => {
      const response = msg.toString();

      if (response.includes('philips') || response.includes('Air') || response.includes('Purifier')) {
        if (!seen.has(rinfo.address)) {
          seen.add(rinfo.address);
          console.log(`Found potential air purifier at ${rinfo.address}`);
          devices.push({
            ip: rinfo.address,
            name: `Air Purifier (${rinfo.address})`
          });
        }
      }
    });

    socket.bind(() => {
      socket.setBroadcast(true);

      const ssdpMessage = Buffer.from(
        'M-SEARCH * HTTP/1.1\r\n' +
        'HOST: 239.255.255.250:1900\r\n' +
        'MAN: "ssdp:discover"\r\n' +
        'MX: 3\r\n' +
        'ST: urn:philips-com:device:DiProduct:1\r\n' +
        '\r\n'
      );

      socket.send(ssdpMessage, 0, ssdpMessage.length, 1900, '239.255.255.250');

      setTimeout(() => {
        const ssdpAll = Buffer.from(
          'M-SEARCH * HTTP/1.1\r\n' +
          'HOST: 239.255.255.250:1900\r\n' +
          'MAN: "ssdp:discover"\r\n' +
          'MX: 3\r\n' +
          'ST: ssdp:all\r\n' +
          '\r\n'
        );
        socket.send(ssdpAll, 0, ssdpAll.length, 1900, '239.255.255.250');
      }, 1000);
    });

    setTimeout(() => {
      socket.close();

      if (devices.length === 0) {
        console.log('No air purifiers found via SSDP.');
        console.log('Tip: You can manually enter the IP address if you know it.');
      }

      resolve(devices);
    }, timeout);
  });
}

async function discoverRoomba(timeout = 5000) {
  console.log('\nScanning for iRobot Roomba...');

  return new Promise((resolve) => {
    const timeoutId = setTimeout(() => {
      resolve(null);
    }, timeout);

    dorita980.getRobotIP((err, ip) => {
      clearTimeout(timeoutId);

      if (err) {
        console.log('No Roomba found broadcasting on the network.');
        resolve(null);
      } else {
        console.log(`Found Roomba at ${ip}`);
        resolve(ip);
      }
    });
  });
}

async function testAirPurifierConnection(ip) {
  const protocols = ['http', 'plain-coap', 'coap'];

  for (const protocol of protocols) {
    try {
      let client;
      switch (protocol) {
        case 'coap':
          client = new CoapClient(ip, 5000);
          break;
        case 'plain-coap':
          client = new PlainCoapClient(ip, 5000);
          break;
        default:
          client = new HttpClient(ip, 5000);
      }

      const status = await client.getStatus();
      console.log(`Connected via ${protocol.toUpperCase()} protocol`);
      return { success: true, protocol, status };
    } catch {
      // Try next protocol
    }
  }

  return { success: false };
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

async function configureAirPurifier(ip) {
  console.log(`\n=== Configuring Air Purifier at ${ip} ===`);

  const result = await testAirPurifierConnection(ip);

  if (!result.success) {
    console.log('Could not connect using any protocol.');
    return null;
  }

  const id = `purifier-${ip.replace(/\./g, '-')}`;
  const name = result.status?.name || `Air Purifier (${ip})`;

  console.log(`Connected to: ${name}`);

  if (result.status?.pm25 !== undefined) {
    console.log(`Current PM2.5: ${result.status.pm25}`);
  }

  return {
    id,
    ip,
    protocol: result.protocol,
    name
  };
}

async function authenticateRoomba(ip) {
  console.log('\n=== Roomba Authentication ===');
  console.log('IMPORTANT: Before continuing:');
  console.log('1. Make sure the Roomba is on the Home Base (docked)');
  console.log('2. Press and HOLD the HOME button for 2 seconds');
  console.log('3. Wait for the Roomba to play a tone');
  console.log('4. You have about 1 minute to complete this\n');

  readline.question('Press Enter when the Roomba is ready... ');

  try {
    const data = await dorita980.getPasswordCloud(ip);
    console.log('Successfully got Roomba credentials!');
    return {
      blid: data.blid,
      password: data.password
    };
  } catch (err) {
    console.log(`Failed to get Roomba credentials: ${err.message}`);
    console.log('Troubleshooting:');
    console.log('- Make sure you held HOME button until you heard a tone');
    console.log('- Try again within 1 minute of pressing the button');
    return null;
  }
}

async function backupConfig() {
  if (!fs.existsSync(CONFIG_FILE)) {
    return null;
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const backupFile = `./network-config.backup.${timestamp}.json`;

  try {
    await fsPromises.copyFile(CONFIG_FILE, backupFile);
    console.log(`Backup created: ${backupFile}`);
    return backupFile;
  } catch (err) {
    console.log(`Warning: Could not create backup: ${err.message}`);
    return null;
  }
}

async function saveConfig(config) {
  await backupConfig();

  const json = JSON.stringify(config, null, 2);
  await fsPromises.writeFile(CONFIG_FILE, json, 'utf-8');
  console.log(`Configuration saved to ${CONFIG_FILE}`);
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

function hasAirPurifierConfig(config) {
  return config?.airPurifiers?.length > 0;
}

function hasRoombaConfig(config) {
  return config?.roomba?.ip && config?.roomba?.blid && config?.roomba?.password;
}

async function main() {
  console.log('=== Smart Home Network Scanner ===\n');
  console.log('This tool will discover and configure:');
  console.log('- Philips Hue Bridge');
  console.log('- Nanoleaf panels');
  console.log('- Philips Air Purifiers');
  console.log('- iRobot Roomba\n');

  const existingConfig = loadExistingConfig();
  let resetHue = true;
  let resetNanoleaf = true;
  let resetAirPurifiers = true;
  let resetRoomba = true;

  if (hasHueConfig(existingConfig)) {
    console.log(`Hue Bridge already configured (${existingConfig.hue.ip})`);
    resetHue = readline.keyInYN('Reset Hue Bridge configuration?');
  }

  if (hasNanoleafConfig(existingConfig)) {
    console.log(`Nanoleaf already configured (${existingConfig.nanoleaf.ip})`);
    resetNanoleaf = readline.keyInYN('Reset Nanoleaf configuration?');
  }

  if (hasAirPurifierConfig(existingConfig)) {
    console.log(`Air Purifiers already configured (${existingConfig.airPurifiers.length} device(s))`);
    resetAirPurifiers = readline.keyInYN('Reset Air Purifier configuration?');
  }

  if (hasRoombaConfig(existingConfig)) {
    console.log(`Roomba already configured (${existingConfig.roomba.ip})`);
    resetRoomba = readline.keyInYN('Reset Roomba configuration?');
  }

  const config = {
    hue: resetHue ? { ip: null, username: null } : existingConfig?.hue || { ip: null, username: null },
    nanoleaf: resetNanoleaf ? { ip: null, port: null, authToken: null } : existingConfig?.nanoleaf || { ip: null, port: null, authToken: null },
    airPurifiers: resetAirPurifiers ? [] : existingConfig?.airPurifiers || [],
    roomba: resetRoomba ? { ip: null, blid: null, password: null } : existingConfig?.roomba || { ip: null, blid: null, password: null },
    sync: existingConfig?.sync || null
  };

  try {
    let hueIp = null;
    let nanoleaf = null;
    let airPurifiers = [];
    let roombaIp = null;

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

    if (resetAirPurifiers) {
      airPurifiers = await discoverAirPurifiers();

      if (airPurifiers.length === 0) {
        const manualAdd = readline.keyInYN('\nWould you like to manually enter an air purifier IP address?');

        if (manualAdd) {
          const ip = readline.question('Enter the IP address: ');
          if (ip) {
            airPurifiers.push({ ip, name: `Air Purifier (${ip})` });
          }
        }
      }

      const addMore = airPurifiers.length > 0 && readline.keyInYN('Add another air purifier manually?');
      if (addMore) {
        const ip = readline.question('Enter the IP address: ');
        if (ip) {
          airPurifiers.push({ ip, name: `Air Purifier (${ip})` });
        }
      }
    }

    if (resetRoomba) {
      roombaIp = await discoverRoomba();

      if (!roombaIp) {
        const manualAdd = readline.keyInYN('\nWould you like to manually enter the Roomba IP address?');

        if (manualAdd) {
          roombaIp = readline.question('Enter the IP address: ');
        }
      }

      if (roombaIp) {
        config.roomba.ip = roombaIp;
      }
    }

    if (!resetHue && !resetNanoleaf && !resetAirPurifiers && !resetRoomba) {
      console.log('\nNo devices to configure. Exiting.');
      process.exit(0);
    }

    // Authenticate devices
    if (hueIp) {
      config.hue.username = await authenticateHueBridge(hueIp);
    }

    if (nanoleaf) {
      config.nanoleaf.authToken = await authenticateNanoleaf(nanoleaf.ip, nanoleaf.port);
    }

    for (const purifier of airPurifiers) {
      const purifierConfig = await configureAirPurifier(purifier.ip);
      if (purifierConfig) {
        config.airPurifiers.push(purifierConfig);
      }
    }

    if (roombaIp && resetRoomba) {
      const roombaCredentials = await authenticateRoomba(roombaIp);
      if (roombaCredentials) {
        config.roomba.blid = roombaCredentials.blid;
        config.roomba.password = roombaCredentials.password;
      }
    }

    await saveConfig(config);

    console.log('\n=== Setup Complete ===');
    console.log('Configured devices:');

    if (config.hue?.username) {
      console.log(`  - Hue Bridge: ${config.hue.ip}`);
    }

    if (config.nanoleaf?.authToken) {
      console.log(`  - Nanoleaf: ${config.nanoleaf.ip}`);
    }

    if (config.airPurifiers?.length > 0) {
      config.airPurifiers.forEach(p => {
        console.log(`  - Air Purifier: ${p.name} (${p.ip})`);
      });
    }

    if (config.roomba?.password) {
      console.log(`  - Roomba: ${config.roomba.ip}`);
    }

    console.log('\nYou can now start the web server with: npm start');
  } catch (err) {
    console.error(`\nError: ${err.message}`);
    process.exit(1);
  }
}

main();
