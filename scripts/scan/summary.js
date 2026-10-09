const storage = require('../../src/services/storage');

function printConfiguredDevices() {
  console.log('Configured devices:');

  const lines = [
    describeHue(),
    describeNanoleaf(),
    ...describeAirPurifiers(),
    describeRoomba(),
    describeHomeConnect()
  ];

  lines.filter(Boolean).forEach(line => console.log(line));
}

function describeHue() {
  const config = storage.getHue();

  return config?.username ? '  - Hue Bridge: ' + config.ip : null;
}

function describeNanoleaf() {
  const config = storage.getNanoleaf();

  return config?.authToken ? '  - Nanoleaf: ' + config.ip : null;
}

function describeAirPurifiers() {
  return storage.getAirPurifiers().map(purifier => '  - Air Purifier: ' + purifier.name + ' (' + purifier.ip + ')');
}

function describeRoomba() {
  const config = storage.getRoomba();

  if (config?.password) {
    return '  - Roomba: ' + config.ip;
  }

  return config?.ip ? '  - Roomba: ' + config.ip + ' (authentication pending)' : null;
}

function describeHomeConnect() {
  return storage.getHomeConnect()?.clientId ? '  - Home Connect: Configured (requires web authentication)' : null;
}

module.exports = { printConfiguredDevices };
