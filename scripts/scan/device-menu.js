const readline = require('readline-sync');
const storage = require('../../src/services/storage');

const NOT_CONFIGURED = 'not configured';
const DECIMAL_RADIX = 10;

const DEVICE_TYPES = [
  { id: 'hue', name: 'Philips Hue Bridge', describeStatus: describeHueStatus },
  { id: 'nanoleaf', name: 'Nanoleaf panels', describeStatus: describeNanoleafStatus },
  { id: 'airpurifier', name: 'Philips Air Purifiers', describeStatus: describeAirPurifierStatus },
  { id: 'roomba', name: 'iRobot Roomba', describeStatus: describeRoombaStatus },
  { id: 'homeconnect', name: 'Bosch/Siemens Home Connect', describeStatus: describeHomeConnectStatus }
];

function showDeviceMenu() {
  console.log('\nSelect devices to scan/configure:\n');
  console.log('  0. All devices');

  DEVICE_TYPES.forEach((device, index) => {
    console.log('  ' + (index + 1) + '. ' + device.name + ' [' + device.describeStatus() + ']');
  });

  console.log('');

  const input = readline.question('Enter numbers separated by commas (e.g., 1,3,4) or 0 for all: ').trim();

  if (input === '0' || input === '') {
    return listAllDeviceIds();
  }

  const selectedIds = parseSelectedIds(input);

  if (selectedIds.length === 0) {
    console.log('No valid selection. Scanning all devices.');

    return listAllDeviceIds();
  }

  return selectedIds;
}

function listAllDeviceIds() {
  return DEVICE_TYPES.map(device => device.id);
}

function parseSelectedIds(input) {
  return input
    .split(',')
    .map(entry => parseInt(entry.trim(), DECIMAL_RADIX))
    .filter(number => !Number.isNaN(number) && number >= 1 && number <= DEVICE_TYPES.length)
    .map(number => DEVICE_TYPES[number - 1].id);
}

function describeHueStatus() {
  const config = storage.getHue();

  return config?.username ? 'configured (' + config.ip + ')' : NOT_CONFIGURED;
}

function describeNanoleafStatus() {
  const config = storage.getNanoleaf();

  return config?.authToken ? 'configured (' + config.ip + ')' : NOT_CONFIGURED;
}

function describeAirPurifierStatus() {
  const configs = storage.getAirPurifiers();

  return configs.length > 0 ? 'configured (' + configs.length + ' device(s))' : NOT_CONFIGURED;
}

function describeRoombaStatus() {
  const config = storage.getRoomba();

  return config?.password ? 'configured (' + config.ip + ')' : NOT_CONFIGURED;
}

function describeHomeConnectStatus() {
  return storage.getHomeConnect()?.clientId ? 'configured' : NOT_CONFIGURED;
}

module.exports = { DEVICE_TYPES, showDeviceMenu };
