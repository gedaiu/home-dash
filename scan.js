#!/usr/bin/env node

const readline = require('readline-sync');
const storage = require('./src/services/storage');
const hueService = require('./src/services/hue');
const nanoleafService = require('./src/services/nanoleaf');
const airpurifierService = require('./src/services/airpurifier');
const roombaService = require('./src/services/roomba');
const discovery = require('./src/discovery');
const auth = require('./src/auth');

const DEVICE_TYPES = [
  { id: 'hue', name: 'Philips Hue Bridge' },
  { id: 'nanoleaf', name: 'Nanoleaf panels' },
  { id: 'airpurifier', name: 'Philips Air Purifiers' },
  { id: 'roomba', name: 'iRobot Roomba' },
  { id: 'homeconnect', name: 'Bosch/Siemens Home Connect' }
];

function getConfigStatus(deviceId) {
  switch (deviceId) {
    case 'hue': {
      const config = storage.getHue();
      return config?.username ? 'configured (' + config.ip + ')' : 'not configured';
    }
    case 'nanoleaf': {
      const config = storage.getNanoleaf();
      return config?.authToken ? 'configured (' + config.ip + ')' : 'not configured';
    }
    case 'airpurifier': {
      const configs = storage.getAirPurifiers();
      return configs.length > 0 ? 'configured (' + configs.length + ' device(s))' : 'not configured';
    }
    case 'roomba': {
      const config = storage.getRoomba();
      return config?.password ? 'configured (' + config.ip + ')' : 'not configured';
    }
    case 'homeconnect': {
      const config = storage.getHomeConnect();
      return config?.clientId ? 'configured' : 'not configured';
    }
    default:
      return 'unknown';
  }
}

function showDeviceMenu() {
  console.log('\nSelect devices to scan/configure:\n');
  console.log('  0. All devices');

  DEVICE_TYPES.forEach((device, index) => {
    const status = getConfigStatus(device.id);
    console.log('  ' + (index + 1) + '. ' + device.name + ' [' + status + ']');
  });

  console.log('');

  const input = readline.question('Enter numbers separated by commas (e.g., 1,3,4) or 0 for all: ');

  if (input.trim() === '0' || input.trim() === '') {
    return DEVICE_TYPES.map(d => d.id);
  }

  const selectedNumbers = input
    .split(',')
    .map(s => parseInt(s.trim(), 10))
    .filter(n => !isNaN(n) && n >= 1 && n <= DEVICE_TYPES.length);

  if (selectedNumbers.length === 0) {
    console.log('No valid selection. Scanning all devices.');
    return DEVICE_TYPES.map(d => d.id);
  }

  return selectedNumbers.map(n => DEVICE_TYPES[n - 1].id);
}

async function configureHue() {
  console.log('\nScanning for Philips Hue Bridge...');

  const ip = await discovery.hue.discoverBridge();

  if (!ip) {
    console.log('No Hue Bridge found on the network.');
    return false;
  }

  console.log('Found Hue Bridge at ' + ip);

  console.log('\n=== Hue Bridge Authentication ===');

  for (let attempt = 1; attempt <= 3; attempt++) {
    readline.question('Press the Link button on your Hue Bridge, then press Enter... ');

    const result = await auth.hue.authenticate(ip, 1);

    if (result.success) {
      console.log('Successfully authenticated with Hue Bridge!');
      storage.setHue({ ip, username: result.username });
      return true;
    }

    if (result.retriesExhausted) {
      console.log('Link button not pressed (attempt ' + attempt + '/3)');
      if (attempt < 3) {
        console.log('Please try again...');
      }
    } else {
      console.log('Authentication failed: ' + result.error);
      return false;
    }
  }

  console.log('Failed to authenticate with Hue Bridge after maximum retries');
  return false;
}

async function configureNanoleaf() {
  console.log('\nScanning for Nanoleaf panels...');

  const devices = await discovery.nanoleaf.discoverDevices();

  if (devices.length === 0) {
    console.log('No Nanoleaf devices found on the network.');
    return false;
  }

  const device = devices[0];
  console.log('Found Nanoleaf: ' + device.name + ' at ' + device.ip + ':' + device.port);

  console.log('\n=== Nanoleaf Authentication ===');

  for (let attempt = 1; attempt <= 3; attempt++) {
    readline.question('Hold the power button on your Nanoleaf for 5-7 seconds until the LED flashes, then press Enter... ');

    const result = await auth.nanoleaf.authenticate(device.ip, device.port, 1);

    if (result.success) {
      console.log('Successfully authenticated with Nanoleaf!');
      storage.setNanoleaf({
        ip: device.ip,
        port: device.port,
        authToken: result.authToken
      });
      return true;
    }

    if (result.retriesExhausted) {
      console.log('Nanoleaf not in pairing mode (attempt ' + attempt + '/3)');
      if (attempt < 3) {
        console.log('Please try again - hold the power button for 5-7 seconds...');
      }
    } else {
      console.log('Authentication failed: ' + result.error);
      return false;
    }
  }

  console.log('Failed to authenticate with Nanoleaf after maximum retries');
  return false;
}

function showAirPurifierPairingInstructions() {
  console.log('\n=== Air Purifier Pairing Instructions ===');
  console.log('');
  console.log('Philips air purifiers use encrypted CoAP for local control.');
  console.log('If connection fails, try the following:');
  console.log('');
  console.log('For most AC models (AC1xxx, AC2xxx, AC3xxx, AC4xxx):');
  console.log('  1. Power off the purifier completely');
  console.log('  2. Wait 10 seconds');
  console.log('  3. Power it back on');
  console.log('  4. Wait until WiFi indicator is stable');
  console.log('  5. Run this scan again within 2 minutes');
  console.log('');
  console.log('For AC08xx series (AC0830, AC0850, etc):');
  console.log('  1. Make sure the device is ON and connected to WiFi');
  console.log('  2. Open the Philips Air+ app');
  console.log('  3. Ensure the app can connect to the device');
  console.log('  4. Close the app completely');
  console.log('  5. Run this scan within 30 seconds');
  console.log('');
  console.log('Note: Some newer firmware versions may disable local control.');
  console.log('');
}

async function probeWithRetry(ip, maxAttempts = 3, showInstructionsAfterFirst = false) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    console.log('    Probe attempt ' + attempt + '/' + maxAttempts + '...');
    const info = await airpurifierService.probeDevice(ip);
    if (info) {
      return info;
    }

    if (attempt === 1 && showInstructionsAfterFirst && maxAttempts > 1) {
      showAirPurifierPairingInstructions();
      readline.question('Press Enter when device is ready to retry... ');
    } else if (attempt < maxAttempts) {
      console.log('    Waiting before retry...');
      await new Promise(r => setTimeout(r, 2000));
    }
  }
  return null;
}

async function configureAirPurifiers() {
  console.log('\nScanning for Philips Air Purifiers...');
  console.log('Using mDNS, SSDP, and CoAP discovery methods...');

  let devices = await airpurifierService.discover();

  if (devices.length === 0) {
    console.log('No air purifiers found via mDNS/SSDP.');

    const deepScan = readline.keyInYN('\nWould you like to do a deep network scan (scans all IPs on subnet)?');

    if (deepScan) {
      const subnet = readline.question('Enter subnet to scan (default: 192.168.1): ') || '192.168.1';
      console.log('Scanning ' + subnet + '.1-254 for CoAP devices...');
      devices = await airpurifierService.discoverDeep(subnet);
    }
  }

  if (devices.length === 0) {
    console.log('No air purifiers found.');

    const manualAdd = readline.keyInYN('\nWould you like to manually enter an air purifier IP address?');

    if (manualAdd) {
      const ip = readline.question('Enter the IP address: ');
      if (ip) {
        devices.push({ ip, name: 'Air Purifier (' + ip + ')' });
      }
    }
  } else {
    console.log('Found ' + devices.length + ' potential air purifier(s):');
    for (const d of devices) {
      const sourceLabel = d.source === 'stored' ? 'previously discovered' : (d.source || 'unknown');
      console.log('  - ' + d.ip + ' (' + sourceLabel + ')');

      // Try to probe - show instructions after first failure, then retry 2 more times
      console.log('    Probing for device info...');
      const info = await probeWithRetry(d.ip, 3, true);
      if (info) {
        console.log('    Protocol: ' + info.protocol.toUpperCase());
        if (info.modelId) {
          console.log('    Model: ' + info.modelId);
        }
        if (info.name && info.name !== 'Air Purifier (' + d.ip + ')') {
          console.log('    Name: ' + info.name);
        }
        if (info.firmware) {
          console.log('    Firmware: ' + info.firmware);
        }
        if (info.pm25 !== null && info.pm25 !== undefined) {
          console.log('    PM2.5: ' + info.pm25 + ' ug/m3');
        }
        console.log('    Power: ' + (info.power ? 'ON' : 'OFF'));
        d.probed = info;
      } else {
        console.log('    Could not connect after multiple attempts.');
        d.probed = null;
      }
    }
  }

  if (devices.length > 0 && readline.keyInYN('Add another air purifier manually?')) {
    const ip = readline.question('Enter the IP address: ');
    if (ip) {
      devices.push({ ip, name: 'Air Purifier (' + ip + ')' });
    }
  }

  let configured = 0;

  for (const device of devices) {
    console.log('\n=== Configuring Air Purifier at ' + device.ip + ' ===');

    // If already probed successfully, use that info
    if (device.probed) {
      const safeIp = device.ip.replace(/\./g, '-');
      const config = {
        id: 'purifier-' + safeIp,
        ip: device.ip,
        protocol: device.probed.protocol,
        name: device.probed.name,
        model: device.probed.modelId
      };

      storage.addAirPurifier(config);

      console.log('Added: ' + config.name);
      if (config.model) {
        console.log('  Model: ' + config.model);
      }
      console.log('  Protocol: ' + config.protocol.toUpperCase());
      configured++;
    } else {
      console.log('Skipping - could not connect to device.');
    }
  }

  return configured > 0;
}

async function configureRoomba() {
  console.log('\nScanning for iRobot Roomba...');

  let ip = await discovery.roomba.discoverDevice();

  if (!ip) {
    console.log('No Roomba found broadcasting on the network.');

    if (readline.keyInYN('\nWould you like to manually enter the Roomba IP address?')) {
      ip = readline.question('Enter the IP address: ');
    }
  } else {
    console.log('Found Roomba at ' + ip);
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
    console.log('  BLID: ' + result.blid);
    storage.setRoomba({ ip, blid: result.blid, password: result.password });
    return true;
  }

  console.log('\nFailed to get Roomba credentials: ' + result.error);
  console.log('\nTroubleshooting:');
  console.log('- Make sure the Roomba is docked and powered on');
  console.log('- Hold HOME button for 2+ seconds until you hear tones');
  console.log('- The WIFI light should start flashing');
  console.log('- Run this script again within 1 minute of pressing the button');

  if (readline.keyInYN('\nSave the IP address anyway (you can try authentication later)?')) {
    storage.setRoomba({ ip, blid: null, password: null });
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
  console.log('');

  const clientId = readline.question('Enter your Client ID (or press Enter to skip): ');
  if (!clientId) {
    console.log('Skipping Home Connect configuration.');
    return false;
  }

  const clientSecret = readline.question('Enter your Client Secret: ');
  if (!clientSecret) {
    console.log('Skipping Home Connect configuration.');
    return false;
  }

  storage.setHomeConnect({ clientId, clientSecret, tokens: null });

  console.log('Home Connect credentials saved.');
  console.log('After starting the server, complete authentication via the web UI.');

  return true;
}

async function main() {
  console.log('=== Smart Home Network Scanner ===\n');
  console.log('This tool will discover and configure:');
  console.log('- Philips Hue Bridge');
  console.log('- Nanoleaf panels');
  console.log('- Philips Air Purifiers');
  console.log('- iRobot Roomba');
  console.log('- Bosch/Siemens Home Connect appliances');

  const selectedDevices = showDeviceMenu();

  if (selectedDevices.length === 0) {
    console.log('\nNo devices selected. Exiting.');
    process.exit(0);
  }

  console.log('\nSelected: ' + selectedDevices.join(', '));

  try {
    if (selectedDevices.includes('hue')) {
      await configureHue();
    }

    if (selectedDevices.includes('nanoleaf')) {
      await configureNanoleaf();
    }

    if (selectedDevices.includes('airpurifier')) {
      await configureAirPurifiers();
    }

    if (selectedDevices.includes('roomba')) {
      await configureRoomba();
    }

    if (selectedDevices.includes('homeconnect')) {
      configureHomeConnect();
    }

    console.log('\n=== Setup Complete ===');
    console.log('Configured devices:');

    const hueConfig = storage.getHue();
    if (hueConfig?.username) {
      console.log('  - Hue Bridge: ' + hueConfig.ip);
    }

    const nanoleafConfig = storage.getNanoleaf();
    if (nanoleafConfig?.authToken) {
      console.log('  - Nanoleaf: ' + nanoleafConfig.ip);
    }

    const purifiers = storage.getAirPurifiers();
    purifiers.forEach(p => {
      console.log('  - Air Purifier: ' + p.name + ' (' + p.ip + ')');
    });

    const roombaConfig = storage.getRoomba();
    if (roombaConfig?.password) {
      console.log('  - Roomba: ' + roombaConfig.ip);
    } else if (roombaConfig?.ip) {
      console.log('  - Roomba: ' + roombaConfig.ip + ' (authentication pending)');
    }

    const homeConnectConfig = storage.getHomeConnect();
    if (homeConnectConfig?.clientId) {
      console.log('  - Home Connect: Configured (requires web authentication)');
    }

    console.log('\nYou can now start the web server with: npm start');
    process.exit(0);
  } catch (err) {
    console.error('\nError: ' + err.message);
    process.exit(1);
  }
}

main();
