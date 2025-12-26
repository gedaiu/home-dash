#!/usr/bin/env node

const readline = require('readline-sync');
const fs = require('node:fs');
const fsPromises = require('node:fs/promises');

const discovery = require('./src/discovery');
const auth = require('./src/auth');

const CONFIG_FILE = './network-config.json';

const DEVICE_TYPES = [
  { id: 'hue', name: 'Philips Hue Bridge' },
  { id: 'nanoleaf', name: 'Nanoleaf panels' },
  { id: 'airpurifier', name: 'Philips Air Purifiers' },
  { id: 'roomba', name: 'iRobot Roomba' },
  { id: 'homeconnect', name: 'Bosch/Siemens Home Connect' }
];

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

function hasHomeConnectConfig(config) {
  return config?.homeConnect?.clientId && config?.homeConnect?.clientSecret;
}

function getConfigStatus(config, deviceId) {
  switch (deviceId) {
    case 'hue':
      return hasHueConfig(config) ? `configured (${config.hue.ip})` : 'not configured';
    case 'nanoleaf':
      return hasNanoleafConfig(config) ? `configured (${config.nanoleaf.ip})` : 'not configured';
    case 'airpurifier':
      return hasAirPurifierConfig(config) ? `configured (${config.airPurifiers.length} device(s))` : 'not configured';
    case 'roomba':
      return hasRoombaConfig(config) ? `configured (${config.roomba.ip})` : 'not configured';
    case 'homeconnect':
      return hasHomeConnectConfig(config) ? 'configured' : 'not configured';
    default:
      return 'unknown';
  }
}

function showDeviceMenu(existingConfig) {
  console.log('\nSelect devices to scan/configure:\n');
  console.log('  0. All devices');

  DEVICE_TYPES.forEach((device, index) => {
    const status = getConfigStatus(existingConfig, device.id);
    console.log(`  ${index + 1}. ${device.name} [${status}]`);
  });

  console.log('');

  const input = readline.question('Enter numbers separated by commas (e.g., 1,3,4) or 0 for all: ');

  if (input.trim() === '0' || input.trim() === '') {
    return DEVICE_TYPES.map(d => d.id);
  }

  const selectedNumbers = input.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n) && n >= 1 && n <= DEVICE_TYPES.length);

  if (selectedNumbers.length === 0) {
    console.log('No valid selection. Scanning all devices.');
    return DEVICE_TYPES.map(d => d.id);
  }

  return selectedNumbers.map(n => DEVICE_TYPES[n - 1].id);
}

async function discoverAndConfigureHue(config) {
  console.log('\nScanning for Philips Hue Bridge...');

  const ip = await discovery.hue.discoverBridge();

  if (!ip) {
    console.log('No Hue Bridge found on the network.');
    return false;
  }

  console.log(`Found Hue Bridge at ${ip}`);
  config.hue.ip = ip;

  console.log('\n=== Hue Bridge Authentication ===');

  for (let attempt = 1; attempt <= 3; attempt++) {
    readline.question('Press the Link button on your Hue Bridge, then press Enter... ');

    const result = await auth.hue.authenticate(ip, 1);

    if (result.success) {
      console.log('Successfully authenticated with Hue Bridge!');
      config.hue.username = result.username;
      return true;
    }

    if (result.retriesExhausted) {
      console.log(`Link button not pressed (attempt ${attempt}/3)`);
      if (attempt < 3) {
        console.log('Please try again...');
      }
    } else {
      console.log(`Authentication failed: ${result.error}`);
      return false;
    }
  }

  console.log('Failed to authenticate with Hue Bridge after maximum retries');
  return false;
}

async function discoverAndConfigureNanoleaf(config) {
  console.log('\nScanning for Nanoleaf panels...');

  const devices = await discovery.nanoleaf.discoverDevices();

  if (devices.length === 0) {
    console.log('No Nanoleaf devices found on the network.');
    return false;
  }

  const device = devices[0];
  console.log(`Found Nanoleaf: ${device.name} at ${device.ip}:${device.port}`);

  config.nanoleaf.ip = device.ip;
  config.nanoleaf.port = device.port;

  console.log('\n=== Nanoleaf Authentication ===');

  for (let attempt = 1; attempt <= 3; attempt++) {
    readline.question('Hold the power button on your Nanoleaf for 5-7 seconds until the LED flashes, then press Enter... ');

    const result = await auth.nanoleaf.authenticate(device.ip, device.port, 1);

    if (result.success) {
      console.log('Successfully authenticated with Nanoleaf!');
      config.nanoleaf.authToken = result.authToken;
      return true;
    }

    if (result.retriesExhausted) {
      console.log(`Nanoleaf not in pairing mode (attempt ${attempt}/3)`);
      if (attempt < 3) {
        console.log('Please try again - hold the power button for 5-7 seconds...');
      }
    } else {
      console.log(`Authentication failed: ${result.error}`);
      return false;
    }
  }

  console.log('Failed to authenticate with Nanoleaf after maximum retries');
  return false;
}

async function discoverAndConfigureAirPurifiers(config) {
  console.log('\nScanning for Philips Air Purifiers (SSDP)...');

  let devices = await discovery.airpurifier.discoverDevices();

  if (devices.length === 0) {
    console.log('No air purifiers found via SSDP.');
    console.log('Tip: You can manually enter the IP address if you know it.');

    const manualAdd = readline.keyInYN('\nWould you like to manually enter an air purifier IP address?');

    if (manualAdd) {
      const ip = readline.question('Enter the IP address: ');
      if (ip) {
        devices.push({ ip, name: `Air Purifier (${ip})` });
      }
    }
  } else {
    devices.forEach(d => console.log(`Found potential air purifier at ${d.ip}`));
  }

  const addMore = devices.length > 0 && readline.keyInYN('Add another air purifier manually?');
  if (addMore) {
    const ip = readline.question('Enter the IP address: ');
    if (ip) {
      devices.push({ ip, name: `Air Purifier (${ip})` });
    }
  }

  for (const device of devices) {
    console.log(`\n=== Configuring Air Purifier at ${device.ip} ===`);

    const connectionResult = await discovery.airpurifier.testConnection(device.ip);

    if (!connectionResult.success) {
      console.log('Could not connect using any protocol.');
      continue;
    }

    const purifierConfig = discovery.airpurifier.createConfig(device.ip, connectionResult);

    if (purifierConfig) {
      console.log(`Connected to: ${purifierConfig.name} via ${connectionResult.protocol.toUpperCase()}`);

      if (connectionResult.status?.pm25 !== undefined) {
        console.log(`Current PM2.5: ${connectionResult.status.pm25}`);
      }

      config.airPurifiers.push(purifierConfig);
    }
  }

  return config.airPurifiers.length > 0;
}

async function discoverAndConfigureRoomba(config) {
  console.log('\nScanning for iRobot Roomba...');

  let ip = await discovery.roomba.discoverDevice();

  if (!ip) {
    console.log('No Roomba found broadcasting on the network.');

    const manualAdd = readline.keyInYN('\nWould you like to manually enter the Roomba IP address?');

    if (manualAdd) {
      ip = readline.question('Enter the IP address: ');
    }
  } else {
    console.log(`Found Roomba at ${ip}`);
  }

  if (!ip) {
    return false;
  }

  console.log('\n=== Roomba Authentication ===');
  console.log('IMPORTANT: Follow these steps IN ORDER:');
  console.log('');
  console.log('1. Make sure the Roomba is on the Home Base (docked)');
  console.log('2. Press the CLEAN button once to wake up the Roomba');
  console.log('3. Wait for the Roomba to show it is awake (lights on)');
  console.log('4. Press and HOLD the HOME button for 2 seconds');
  console.log('5. Wait for the Roomba to play a series of tones');
  console.log('6. The WIFI light should start flashing');
  console.log('7. You have about 1 minute to complete this\n');

  readline.question('Press Enter IMMEDIATELY after the WIFI light starts flashing... ');

  console.log('Getting robot credentials...');

  const result = await auth.roomba.authenticate(ip);

  if (result.success) {
    console.log('Successfully got Roomba credentials!');
    console.log(`  BLID: ${result.blid}`);
    config.roomba.ip = ip;
    config.roomba.blid = result.blid;
    config.roomba.password = result.password;
    return true;
  }

  console.log(`\nFailed to get Roomba credentials: ${result.error}`);
  console.log('\nTroubleshooting:');
  console.log('- Make sure the Roomba is docked and powered on');
  console.log('- Hold HOME button for 2+ seconds until you hear tones');
  console.log('- The WIFI light should start flashing');
  console.log('- Run this script again within 1 minute of pressing the button');
  console.log('- Make sure the IP address is correct');

  const keepIp = readline.keyInYN('\nSave the IP address anyway (you can try authentication later)?');
  if (keepIp) {
    config.roomba.ip = ip;
  }

  return false;
}

function configureHomeConnect() {
  console.log('\n=== Home Connect Configuration ===');
  console.log('Home Connect requires cloud API access from Bosch/Siemens.');
  console.log('');
  console.log('To get started:');
  console.log('1. Go to https://developer.home-connect.com');
  console.log('2. Create an account and register a new application');
  console.log('3. Select "Authorization Code Grant Flow" as OAuth Flow');
  console.log('4. Set Redirect URI to: http://localhost:3000/api/homeconnect/auth/callback');
  console.log('   (or your server URL + /api/homeconnect/auth/callback)');
  console.log('');

  const clientId = readline.question('Enter your Client ID (or press Enter to skip): ');
  if (!clientId) {
    console.log('Skipping Home Connect configuration.');
    return null;
  }

  const clientSecret = readline.question('Enter your Client Secret: ');
  if (!clientSecret) {
    console.log('Skipping Home Connect configuration.');
    return null;
  }

  console.log('Home Connect credentials saved.');
  console.log('After starting the server, open the web UI and click the');
  console.log('search icon on the Home Connect panel to complete authentication.');

  return {
    clientId,
    clientSecret,
    tokens: null
  };
}

async function main() {
  console.log('=== Smart Home Network Scanner ===\n');
  console.log('This tool will discover and configure:');
  console.log('- Philips Hue Bridge');
  console.log('- Nanoleaf panels');
  console.log('- Philips Air Purifiers');
  console.log('- iRobot Roomba');
  console.log('- Bosch/Siemens Home Connect appliances');

  const existingConfig = loadExistingConfig();

  const selectedDevices = showDeviceMenu(existingConfig);

  if (selectedDevices.length === 0) {
    console.log('\nNo devices selected. Exiting.');
    process.exit(0);
  }

  console.log(`\nSelected: ${selectedDevices.join(', ')}`);

  const config = {
    hue: existingConfig?.hue || { ip: null, username: null },
    nanoleaf: existingConfig?.nanoleaf || { ip: null, port: null, authToken: null },
    airPurifiers: existingConfig?.airPurifiers || [],
    roomba: existingConfig?.roomba || { ip: null, blid: null, password: null },
    homeConnect: existingConfig?.homeConnect || null,
    sync: existingConfig?.sync || null
  };

  if (selectedDevices.includes('hue')) {
    config.hue = { ip: null, username: null };
  }
  if (selectedDevices.includes('nanoleaf')) {
    config.nanoleaf = { ip: null, port: null, authToken: null };
  }
  if (selectedDevices.includes('airpurifier')) {
    config.airPurifiers = [];
  }
  if (selectedDevices.includes('roomba')) {
    config.roomba = { ip: null, blid: null, password: null };
  }
  if (selectedDevices.includes('homeconnect')) {
    config.homeConnect = null;
  }

  try {
    if (selectedDevices.includes('hue')) {
      await discoverAndConfigureHue(config);
    }

    if (selectedDevices.includes('nanoleaf')) {
      await discoverAndConfigureNanoleaf(config);
    }

    if (selectedDevices.includes('airpurifier')) {
      await discoverAndConfigureAirPurifiers(config);
    }

    if (selectedDevices.includes('roomba')) {
      await discoverAndConfigureRoomba(config);
    }

    if (selectedDevices.includes('homeconnect')) {
      const homeConnectConfig = configureHomeConnect();
      if (homeConnectConfig) {
        config.homeConnect = homeConnectConfig;
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
    } else if (config.roomba?.ip) {
      console.log(`  - Roomba: ${config.roomba.ip} (authentication pending)`);
    }

    if (config.homeConnect?.clientId) {
      console.log('  - Home Connect: Configured (requires web authentication)');
    }

    console.log('\nYou can now start the web server with: npm start');
    process.exit(0);
  } catch (err) {
    console.error(`\nError: ${err.message}`);
    process.exit(1);
  }
}

main();
