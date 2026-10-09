#!/usr/bin/env node

const coap = require('node-coap-client').CoapClient;
const {
  resolveDeviceIp,
  createBaseUrl,
  createSyncToken,
  createObserveOptions,
  createConfirmedOptions,
  decryptPayload
} = require('./scripts/philips/common');

const STATUS_TIMEOUT_MS = 15000;
const JSON_INDENT = 2;

function main() {
  const deviceIp = resolveDeviceIp();

  console.log('Philips Air Purifier - Raw Data Dump');
  console.log('Device:', deviceIp);
  console.log('');

  run(createBaseUrl(deviceIp)).catch(console.error);
}

async function run(baseUrl) {
  coap.stopObserving(`${baseUrl}/sys/dev/status`);
  coap.reset(baseUrl);

  await coap.request(`${baseUrl}/sys/dev/sync`, 'post', createSyncToken(), createConfirmedOptions());
  console.log('Synced\n');

  await dumpFirstStatus(baseUrl);

  coap.reset();
}

function dumpFirstStatus(baseUrl) {
  return new Promise(resolve => {
    const timeout = setTimeout(() => {
      console.log('Timeout - no updates received');
      resolve();
    }, STATUS_TIMEOUT_MS);

    coap.observe(
      `${baseUrl}/sys/dev/status`,
      'get',
      response => handleStatus({ baseUrl, response, timeout, resolve }),
      '',
      createObserveOptions()
    );
  });
}

function handleStatus({ baseUrl, response, timeout, resolve }) {
  if (!response.payload || response.payload.length === 0) {
    return;
  }

  clearTimeout(timeout);
  printDecrypted(response.payload.toString('utf-8'));
  coap.stopObserving(`${baseUrl}/sys/dev/status`);
  resolve();
}

function printDecrypted(payload) {
  try {
    const status = decryptPayload(payload);

    console.log('=== RAW DECRYPTED DATA ===');
    console.log(JSON.stringify(status, null, JSON_INDENT));
  } catch (error) {
    console.log('Decrypt failed:', error.message);
  }
}

main();
