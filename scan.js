#!/usr/bin/env node

const { DEVICE_TYPES, showDeviceMenu } = require('./scripts/scan/device-menu');
const { printConfiguredDevices } = require('./scripts/scan/summary');
const { configureHue } = require('./scripts/scan/hue');
const { configureNanoleaf } = require('./scripts/scan/nanoleaf');
const { configureAirPurifiers } = require('./scripts/scan/airpurifier');
const { configureRoomba } = require('./scripts/scan/roomba');
const { configureHomeConnect } = require('./scripts/scan/homeconnect');

const CONFIGURATORS = {
  hue: configureHue,
  nanoleaf: configureNanoleaf,
  airpurifier: configureAirPurifiers,
  roomba: configureRoomba,
  homeconnect: configureHomeConnect
};

const INTRO_LINES = [
  '=== Smart Home Network Scanner ===\n',
  'This tool will discover and configure:',
  '- Philips Hue Bridge',
  '- Nanoleaf panels',
  '- Philips Air Purifiers',
  '- iRobot Roomba',
  '- Bosch/Siemens Home Connect appliances'
];

async function main() {
  INTRO_LINES.forEach(line => console.log(line));

  const selectedDevices = showDeviceMenu();

  if (selectedDevices.length === 0) {
    console.log('\nNo devices selected. Exiting.');
    process.exit(0);
  }

  console.log('\nSelected: ' + selectedDevices.join(', '));

  try {
    await runConfigurators(selectedDevices);

    console.log('\n=== Setup Complete ===');
    printConfiguredDevices();
    console.log('\nYou can now start the web server with: npm start');
    process.exit(0);
  } catch (err) {
    console.error('\nError: ' + err.message);
    process.exit(1);
  }
}

async function runConfigurators(selectedDevices) {
  for (const deviceType of DEVICE_TYPES) {
    if (selectedDevices.includes(deviceType.id)) {
      await CONFIGURATORS[deviceType.id]();
    }
  }
}

main();
