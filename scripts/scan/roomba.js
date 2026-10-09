const readline = require('readline-sync');
const storage = require('../../src/services/storage');
const discovery = require('../../src/discovery');
const auth = require('../../src/auth');

const AUTH_INSTRUCTION_LINES = [
  '\n=== Roomba Authentication ===',
  'IMPORTANT: Follow these steps IN ORDER:',
  '',
  '1. Make sure the Roomba is on the Home Base (docked)',
  '2. Press the CLEAN button once to wake up the Roomba',
  '3. Wait for the Roomba to show it is awake (lights on)',
  '4. Press and HOLD the HOME button for 2 seconds',
  '5. Wait for the Roomba to play a series of tones',
  '6. The WIFI light should start flashing',
  '7. You have about 1 minute to complete this\n'
];

const TROUBLESHOOTING_LINES = [
  '\nTroubleshooting:',
  '- Make sure the Roomba is docked and powered on',
  '- Hold HOME button for 2+ seconds until you hear tones',
  '- The WIFI light should start flashing',
  '- Run this script again within 1 minute of pressing the button'
];

async function configureRoomba() {
  console.log('\nScanning for iRobot Roomba...');

  const roombaIp = await findRoombaIp();

  if (!roombaIp) {
    return false;
  }

  AUTH_INSTRUCTION_LINES.forEach(line => console.log(line));
  readline.question('Press Enter IMMEDIATELY after the WIFI light starts flashing... ');
  console.log('Getting robot credentials...');

  const result = await auth.roomba.authenticate(roombaIp);

  if (!result.success) {
    offerToSaveIp(roombaIp, result);

    return false;
  }

  console.log('Successfully got Roomba credentials!');
  console.log('  BLID: ' + result.blid);
  storage.setRoomba({ 'ip': roombaIp, blid: result.blid, password: result.password });

  return true;
}

async function findRoombaIp() {
  const discoveredIp = await discovery.roomba.discoverDevice();

  if (discoveredIp) {
    console.log('Found Roomba at ' + discoveredIp);

    return discoveredIp;
  }

  console.log('No Roomba found broadcasting on the network.');

  if (readline.keyInYN('\nWould you like to manually enter the Roomba IP address?')) {
    return readline.question('Enter the IP address: ');
  }

  return null;
}

function offerToSaveIp(roombaIp, failedResult) {
  console.log('\nFailed to get Roomba credentials: ' + failedResult.error);
  TROUBLESHOOTING_LINES.forEach(line => console.log(line));

  if (readline.keyInYN('\nSave the IP address anyway (you can try authentication later)?')) {
    storage.setRoomba({ 'ip': roombaIp, blid: null, password: null });
  }
}

module.exports = { configureRoomba };
