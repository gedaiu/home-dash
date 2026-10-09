const storage = require('../../src/services/storage');
const discovery = require('../../src/discovery');
const auth = require('../../src/auth');
const { pairWithRetries } = require('./pairing');

async function configureHue() {
  console.log('\nScanning for Philips Hue Bridge...');

  const bridgeIp = await discovery.hue.discoverBridge();

  if (!bridgeIp) {
    console.log('No Hue Bridge found on the network.');

    return false;
  }

  console.log('Found Hue Bridge at ' + bridgeIp);
  console.log('\n=== Hue Bridge Authentication ===');

  return pairWithRetries({
    prompt: 'Press the Link button on your Hue Bridge, then press Enter... ',
    authenticate: () => auth.hue.authenticate(bridgeIp, 1),
    successMessage: 'Successfully authenticated with Hue Bridge!',
    saveCredentials: result => storage.setHue({ 'ip': bridgeIp, username: result.username }),
    pendingMessage: 'Link button not pressed',
    retryMessage: 'Please try again...',
    exhaustedMessage: 'Failed to authenticate with Hue Bridge after maximum retries'
  });
}

module.exports = { configureHue };
