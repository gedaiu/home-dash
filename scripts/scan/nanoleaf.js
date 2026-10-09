const storage = require('../../src/services/storage');
const discovery = require('../../src/discovery');
const auth = require('../../src/auth');
const { pairWithRetries } = require('./pairing');

async function configureNanoleaf() {
  console.log('\nScanning for Nanoleaf panels...');

  const panels = await discovery.nanoleaf.discoverDevices();

  if (panels.length === 0) {
    console.log('No Nanoleaf devices found on the network.');

    return false;
  }

  const [panel] = panels;

  console.log('Found Nanoleaf: ' + panel.name + ' at ' + panel.ip + ':' + panel.port);
  console.log('\n=== Nanoleaf Authentication ===');

  return pairWithRetries({
    prompt: 'Hold the power button on your Nanoleaf for 5-7 seconds until the LED flashes, then press Enter... ',
    authenticate: () => auth.nanoleaf.authenticate(panel.ip, panel.port, 1),
    successMessage: 'Successfully authenticated with Nanoleaf!',
    saveCredentials: result => storage.setNanoleaf({ 'ip': panel.ip, port: panel.port, authToken: result.authToken }),
    pendingMessage: 'Nanoleaf not in pairing mode',
    retryMessage: 'Please try again - hold the power button for 5-7 seconds...',
    exhaustedMessage: 'Failed to authenticate with Nanoleaf after maximum retries'
  });
}

module.exports = { configureNanoleaf };
