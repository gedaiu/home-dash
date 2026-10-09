#!/usr/bin/env node

const coap = require('node-coap-client').CoapClient;
const {
  resolveDeviceIp,
  createBaseUrl,
  createSyncToken,
  createObserveOptions,
  createConfirmedOptions,
  splitPayload,
  computeDigest,
  decryptPayload,
  delay
} = require('./scripts/philips/common');

const OBSERVE_DURATION_MS = 60000;

function main() {
  const deviceIp = resolveDeviceIp();

  console.log('Philips Air Purifier Test');
  console.log('Device:', deviceIp);
  console.log('');

  run(createBaseUrl(deviceIp)).catch(reportFailure);
}

async function run(baseUrl) {
  coap.stopObserving(`${baseUrl}/sys/dev/status`);
  coap.reset(baseUrl);

  await printDeviceInfo(baseUrl);

  if (!(await syncWithDevice(baseUrl))) {
    return;
  }

  const stats = { updateCount: 0 };

  await observeStatus(baseUrl, stats);
  await delay(OBSERVE_DURATION_MS);

  console.log(`\nTotal updates received: ${stats.updateCount}`);

  coap.stopObserving(`${baseUrl}/sys/dev/status`);
  coap.reset(baseUrl);
  console.log('Done');
}

async function printDeviceInfo(baseUrl) {
  console.log('Getting device info...');

  try {
    const infoResponse = await coap.request(`${baseUrl}/sys/dev/info`, 'get', null, createConfirmedOptions());
    const deviceInfo = JSON.parse(infoResponse.payload.toString());

    console.log('Model:', deviceInfo.modelid);
    console.log('Name:', deviceInfo.name);
    console.log('');
  } catch (error) {
    console.log('Info failed:', error.message);
  }
}

async function syncWithDevice(baseUrl) {
  console.log('Syncing...');

  try {
    const sync = await coap.request(`${baseUrl}/sys/dev/sync`, 'post', createSyncToken(), createConfirmedOptions());

    console.log('Counter:', sync.payload.toString('utf-8'));
    console.log('');

    return true;
  } catch (error) {
    console.log('Sync failed:', error.message);

    return false;
  }
}

async function observeStatus(baseUrl, stats) {
  console.log('Starting observe (60 seconds)...');
  console.log('Waiting for status updates...\n');

  try {
    await coap.observe(
      `${baseUrl}/sys/dev/status`,
      'get',
      response => handleStatus(stats, response),
      '',
      createObserveOptions()
    );
    console.log('Observe registered successfully');
  } catch (error) {
    console.log('Observe failed:', error.message);
  }
}

function handleStatus(stats, response) {
  if (!response.payload || response.payload.length === 0) {
    return;
  }

  stats.updateCount++;

  try {
    printStatus(stats.updateCount, decrypt(response.payload.toString('utf-8')));
  } catch (error) {
    console.log(`Update ${stats.updateCount}: Decrypt failed -`, error.message);
  }
}

function decrypt(hexPayload) {
  const { saltHex, ciphertextHex, digestHex } = splitPayload(hexPayload);

  if (computeDigest(saltHex, ciphertextHex) !== digestHex.toUpperCase()) {
    console.log('WARNING: Digest mismatch');
  }

  return decryptPayload(hexPayload);
}

function printStatus(updateCount, payload) {
  const state = payload.state?.reported || payload;

  console.log(`=== Update ${updateCount} ===`);
  console.log('Power:', state.pwr === '1' ? 'ON' : 'OFF');
  console.log('Mode:', state.mode);
  console.log('Fan speed:', state.om);
  console.log('PM2.5:', state.pm25);
  console.log('Humidity:', state.rh, '%');
  console.log('Temperature:', state.temp, 'C');
  console.log('Air quality index:', state.iaql);
  console.log('');
}

function reportFailure(err) {
  console.error('Error:', err);
  coap.reset();
}

main();
