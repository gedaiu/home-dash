const DEFAULT_ROOMBA_IP = '192.168.1.136';

const BANNER_LINES = [
  '=== Roomba Credential Extraction ===\n',
  'IMPORTANT: Before running this, you need to:',
  '1. Make sure the Roomba is on the Home Base (docked)',
  '2. Press and HOLD the HOME button for 2 seconds',
  '3. The Roomba will play a tone when ready',
  '4. You have about 1 minute to complete this\n'
];

const TROUBLESHOOTING_LINES = [
  '\nTroubleshooting:',
  '- Make sure you held HOME button until you heard a tone',
  '- Check that the IP address is correct',
  '- Ensure Roomba is connected to WiFi',
  '- Try again within 1 minute of pressing the button'
];

const SUCCESS_LINES = [
  '\nNow run: node get-roomba-password.js blid',
  'to get the robot ID (blid)',
  '\nOr check your iRobot app for the blid.'
];

function main() {
  const dorita980 = require('dorita980');
  const roombaIp = process.argv[2] || DEFAULT_ROOMBA_IP;

  printLines(BANNER_LINES);
  console.log(`Attempting to get password from Roomba at ${roombaIp}...\n`);

  dorita980.getRobotPublicInfo(roombaIp, reportRobotInfo);
  dorita980.getPassword(roombaIp).then(reportPassword).catch(reportPasswordFailure);
}

function reportRobotInfo(err, robotInfo) {
  if (err) {
    console.error('Failed to get robot info:', err.message);

    return;
  }

  console.log('Found Roomba:', robotInfo.robotname || 'Unknown');
  console.log('Software version:', robotInfo.sw || 'Unknown');
}

function reportPassword(password) {
  console.log('\nSuccess! Here are your Roomba credentials:\n');
  console.log('Password:', password);
  printLines(SUCCESS_LINES);
}

function reportPasswordFailure(err) {
  console.error('Failed to get password:', err.message);
  printLines(TROUBLESHOOTING_LINES);
}

function printLines(lines) {
  lines.forEach(line => console.log(line));
}

main();
