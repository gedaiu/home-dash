const readline = require('readline-sync');
const storage = require('../../src/services/storage');
const airpurifierService = require('../../src/services/airpurifier');

const PROBE_ATTEMPTS = 3;
const PROBE_RETRY_DELAY_MS = 2000;
const DEFAULT_SUBNET = '192.168.1';

const PAIRING_INSTRUCTION_LINES = [
  '\n=== Air Purifier Pairing Instructions ===',
  '',
  'Philips air purifiers use encrypted CoAP for local control.',
  'If connection fails, try the following:',
  '',
  'For most AC models (AC1xxx, AC2xxx, AC3xxx, AC4xxx):',
  '  1. Power off the purifier completely',
  '  2. Wait 10 seconds',
  '  3. Power it back on',
  '  4. Wait until WiFi indicator is stable',
  '  5. Run this scan again within 2 minutes',
  '',
  'For AC08xx series (AC0830, AC0850, etc):',
  '  1. Make sure the device is ON and connected to WiFi',
  '  2. Open the Philips Air+ app',
  '  3. Ensure the app can connect to the device',
  '  4. Close the app completely',
  '  5. Run this scan within 30 seconds',
  '',
  'Note: Some newer firmware versions may disable local control.',
  ''
];

async function configureAirPurifiers() {
  console.log('\nScanning for Philips Air Purifiers...');
  console.log('Using mDNS, SSDP, and CoAP discovery methods...');

  const devices = await findDevices();

  if (devices.length > 0 && readline.keyInYN('Add another air purifier manually?')) {
    addManualDevice(devices);
  }

  return storeProbedDevices(devices);
}

async function findDevices() {
  const devices = await discoverWithDeepScan();

  if (devices.length === 0) {
    console.log('No air purifiers found.');

    offerManualDevice(devices);

    return devices;
  }

  console.log('Found ' + devices.length + ' potential air purifier(s):');

  for (const device of devices) {
    device.probed = await probeDevice(device);
  }

  return devices;
}

async function discoverWithDeepScan() {
  const devices = await airpurifierService.discover();

  if (devices.length > 0) {
    return devices;
  }

  console.log('No air purifiers found via mDNS/SSDP.');

  if (!readline.keyInYN('\nWould you like to do a deep network scan (scans all IPs on subnet)?')) {
    return devices;
  }

  const subnet = readline.question(`Enter subnet to scan (default: ${DEFAULT_SUBNET}): `) || DEFAULT_SUBNET;

  console.log('Scanning ' + subnet + '.1-254 for CoAP devices...');

  return airpurifierService.discoverDeep(subnet);
}

function offerManualDevice(devices) {
  if (readline.keyInYN('\nWould you like to manually enter an air purifier IP address?')) {
    addManualDevice(devices);
  }
}

function addManualDevice(devices) {
  const deviceIp = readline.question('Enter the IP address: ');

  if (deviceIp) {
    devices.push({ 'ip': deviceIp, name: 'Air Purifier (' + deviceIp + ')' });
  }
}

async function probeDevice(device) {
  const sourceLabel = device.source === 'stored' ? 'previously discovered' : (device.source || 'unknown');

  console.log('  - ' + device.ip + ' (' + sourceLabel + ')');
  console.log('    Probing for device info...');

  const deviceInfo = await probeWithRetry(device.ip);

  if (!deviceInfo) {
    console.log('    Could not connect after multiple attempts.');

    return null;
  }

  printProbeInfo(deviceInfo, device.ip);

  return deviceInfo;
}

async function probeWithRetry(deviceIp) {
  for (let attempt = 1; attempt <= PROBE_ATTEMPTS; attempt++) {
    console.log('    Probe attempt ' + attempt + '/' + PROBE_ATTEMPTS + '...');

    const deviceInfo = await airpurifierService.probeDevice(deviceIp);

    if (deviceInfo) {
      return deviceInfo;
    }

    await handleFailedProbe(attempt);
  }

  return null;
}

async function handleFailedProbe(attempt) {
  if (attempt === 1) {
    PAIRING_INSTRUCTION_LINES.forEach(line => console.log(line));
    readline.question('Press Enter when device is ready to retry... ');

    return;
  }

  if (attempt < PROBE_ATTEMPTS) {
    console.log('    Waiting before retry...');
    await new Promise(resolve => setTimeout(resolve, PROBE_RETRY_DELAY_MS));
  }
}

function printProbeInfo(deviceInfo, deviceIp) {
  const hasPm25 = deviceInfo.pm25 !== null && deviceInfo.pm25 !== undefined;
  const hasCustomName = deviceInfo.name && deviceInfo.name !== 'Air Purifier (' + deviceIp + ')';
  const optionalLines = [
    [deviceInfo.modelId, '    Model: ' + deviceInfo.modelId],
    [hasCustomName, '    Name: ' + deviceInfo.name],
    [deviceInfo.firmware, '    Firmware: ' + deviceInfo.firmware],
    [hasPm25, '    PM2.5: ' + deviceInfo.pm25 + ' ug/m3']
  ];

  console.log('    Protocol: ' + deviceInfo.protocol.toUpperCase());
  optionalLines.filter(([isPresent]) => isPresent).forEach(([, line]) => console.log(line));
  console.log('    Power: ' + (deviceInfo.power ? 'ON' : 'OFF'));
}

function storeProbedDevices(devices) {
  const results = devices.map(configureDevice);

  return results.some(Boolean);
}

function configureDevice(device) {
  console.log('\n=== Configuring Air Purifier at ' + device.ip + ' ===');

  if (!device.probed) {
    console.log('Skipping - could not connect to device.');

    return false;
  }

  storeDevice(device);

  return true;
}

function storeDevice(device) {
  const config = {
    id: 'purifier-' + device.ip.replace(/\./g, '-'),
    'ip': device.ip,
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
}

module.exports = { configureAirPurifiers };
