#!/usr/bin/env node

const { loadConfig } = require('./scripts/shared/network-config');
const { exitWhen, hasValues } = require('./scripts/shared/cli-checks');
const { syncHueDevice } = require('./scripts/sync/hue-sync');
const { syncRoombaDevice } = require('./scripts/sync/roomba-sync');

async function main() {
  console.log('=== Device to Nanoleaf Sync ===\n');

  const config = loadConfig();

  exitWhen(!config, 'No configuration found. Run "node scan.js" first.');

  const deviceType = config.sync?.deviceType || (config.sync?.hueDeviceId ? 'hue' : null);

  exitWhen(!deviceType, 'No sync device configured. Run "node setup-sync.js" first.');

  if (deviceType !== 'roomba') {
    await syncHueDevice(config);

    return;
  }

  exitWhen(
    !hasValues(config.roomba, ['ip', 'blid', 'password']),
    'Roomba not fully configured. Run "node scan.js" to configure Roomba credentials.'
  );

  await syncRoombaDevice(config);
}

main();
