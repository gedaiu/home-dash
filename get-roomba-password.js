const dorita980 = require('dorita980');

const ROOMBA_IP = '192.168.1.136';

console.log('=== Roomba Credential Extraction ===\n');
console.log('IMPORTANT: Before running this, you need to:');
console.log('1. Make sure the Roomba is on the Home Base (docked)');
console.log('2. Press and HOLD the HOME button for 2 seconds');
console.log('3. The Roomba will play a tone when ready');
console.log('4. You have about 1 minute to complete this\n');
console.log(`Attempting to get password from Roomba at ${ROOMBA_IP}...\n`);

dorita980.getRobotIP((err, ip) => {
  if (!err) {
    console.log(`Found Roomba broadcasting at: ${ip}`);
  }
});

dorita980.getPasswordCloud(ROOMBA_IP)
  .then(data => {
    console.log('Success! Here are your Roomba credentials:\n');
    console.log('Robot ID (blid):', data.blid);
    console.log('Password:', data.password);
    console.log('\nAdd these to your network-config.json');
  })
  .catch(err => {
    console.error('Failed to get password:', err.message);
    console.log('\nTroubleshooting:');
    console.log('- Make sure you held HOME button until you heard a tone');
    console.log('- Check that the IP address is correct');
    console.log('- Ensure Roomba is connected to WiFi');
    console.log('- Try again within 1 minute of pressing the button');
  });
