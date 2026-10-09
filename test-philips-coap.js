#!/usr/bin/env node

// Test script based on node-red-contrib-philips-airjs, using the node-coap-client library

const coap = require('node-coap-client').CoapClient;
const {
  resolveDeviceIp,
  createBaseUrl,
  createSyncToken,
  createObserveOptions,
  createConfirmedOptions,
  splitPayload,
  computeDigest,
  decryptToText
} = require('./scripts/philips/common');

const OBSERVE_TIMEOUT_MS = 15000;
const MIN_ENCRYPTED_PAYLOAD_LENGTH = 72;
const BYTES_PER_HEX_PAIR = 2;
const DIGEST_PREVIEW_LENGTH = 16;
const SYNC_TOKEN_PREVIEW_LENGTH = 32;
const DECRYPTED_PREVIEW_LENGTH = 200;
const JSON_INDENT = 2;
const HEX_RADIX = 16;

function main() {
  const deviceIp = resolveDeviceIp();

  console.log('Testing Philips Air Purifier at:', deviceIp);
  console.log('');

  testConnection(createBaseUrl(deviceIp)).catch(console.error);
}

async function testConnection(baseUrl) {
  console.log('=== Testing CoAP Connection ===');
  console.log('');

  try {
    await runSteps(baseUrl);
  } catch (error) {
    console.error('Connection error:', error);
  } finally {
    console.log('');
    console.log('Cleaning up...');
    coap.reset();
  }
}

async function runSteps(baseUrl) {
  await getDeviceInfo(baseUrl);
  console.log('');

  if (!(await syncWithDevice(baseUrl))) {
    return;
  }

  console.log('');

  const hasObservedData = await observeStatus(baseUrl);

  if (!hasObservedData) {
    await requestStatusDirectly(baseUrl);
  }
}

async function getDeviceInfo(baseUrl) {
  console.log('--- Step 1: GET /sys/dev/info ---');

  try {
    const infoResponse = await coap.request(`${baseUrl}/sys/dev/info`, 'get', null, createConfirmedOptions());

    console.log('Response code:', formatCode(infoResponse));

    if (infoResponse.payload) {
      console.log('Device Info:', JSON.stringify(JSON.parse(infoResponse.payload.toString()), null, JSON_INDENT));
    }
  } catch (error) {
    console.log('Failed:', error.message);
  }
}

async function syncWithDevice(baseUrl) {
  console.log('--- Step 2: POST /sys/dev/sync ---');

  try {
    const syncToken = createSyncToken();

    console.log('Sync token:', syncToken.toString('utf-8').slice(0, SYNC_TOKEN_PREVIEW_LENGTH) + '...');

    coap.stopObserving(`${baseUrl}/sys/dev/status`);
    coap.reset(baseUrl);

    const syncResponse = await coap.request(`${baseUrl}/sys/dev/sync`, 'post', syncToken, createConfirmedOptions());

    console.log('Response code:', formatCode(syncResponse));
    printCounter(syncResponse.payload);

    return true;
  } catch (error) {
    console.log('Sync failed:', error.message);

    return false;
  }
}

function printCounter(payload) {
  if (!payload) {
    return;
  }

  const counterHex = payload.toString('utf-8');

  console.log('Got counter:', counterHex);
  console.log('Counter value:', parseInt(counterHex, HEX_RADIX));
}

async function observeStatus(baseUrl) {
  console.log('--- Step 3: OBSERVE /sys/dev/status ---');
  console.log('Starting observe (will run for 15 seconds)...');

  const session = { hasData: false };

  await new Promise(resolve => {
    const timeout = setTimeout(() => {
      console.log('Observe timeout');
      coap.stopObserving(`${baseUrl}/sys/dev/status`);
      resolve();
    }, OBSERVE_TIMEOUT_MS);

    coap.observe(
      `${baseUrl}/sys/dev/status`,
      'get',
      response => handleObserveUpdate(session, response),
      '',
      createObserveOptions()
    )
      .then(() => console.log('Observe started successfully'))
      .catch(error => {
        console.log('Observe setup error:', error.message);
        clearTimeout(timeout);
        resolve();
      });
  });

  return session.hasData;
}

function handleObserveUpdate(session, response) {
  console.log('\n=== Observe Update ===');
  console.log('Response code:', formatCode(response));

  if (!response.payload || response.payload.length === 0) {
    return;
  }

  session.hasData = true;

  const status = decrypt(response.payload);

  if (status) {
    console.log('Status:', JSON.stringify(pickInterestingFields(status), null, JSON_INDENT));
  }
}

function pickInterestingFields(status) {
  return {
    power: status.pwr,
    mode: status.mode,
    fanSpeed: status.om,
    pm25: status.pm25,
    humidity: status.rh,
    temperature: status.temp,
    allergenIndex: status.iaql,
    gasIndex: status.aqig
  };
}

async function requestStatusDirectly(baseUrl) {
  console.log('\nNo observe data received. Trying direct status request...');
  console.log('--- Fallback: GET /sys/dev/status ---');

  try {
    const statusResponse = await coap.request(`${baseUrl}/sys/dev/status`, 'get', null, createConfirmedOptions());

    console.log('Response code:', formatCode(statusResponse));
    printFullStatus(statusResponse.payload);
  } catch (error) {
    console.log('Status request failed:', error.message);
  }
}

function printFullStatus(payload) {
  if (!payload) {
    return;
  }

  const status = decrypt(payload);

  if (status) {
    console.log('Full status data:', JSON.stringify(status, null, JSON_INDENT));
  }
}

function decrypt(payload) {
  try {
    const hexString = payload.toString('utf-8');

    console.log('Raw hex payload length:', hexString.length);

    if (hexString.length < MIN_ENCRYPTED_PAYLOAD_LENGTH) {
      console.log('Payload too short for encrypted data');

      return null;
    }

    return decryptHex(hexString);
  } catch (error) {
    console.error('Decrypt error:', error.message);

    return null;
  }
}

function decryptHex(hexString) {
  const { saltHex, ciphertextHex, digestHex } = splitPayload(hexString);

  console.log('Salt from payload:', saltHex);
  console.log('Ciphertext length:', ciphertextHex.length / BYTES_PER_HEX_PAIR, 'bytes');

  if (!ciphertextHex || ciphertextHex.length === 0) {
    console.log('No ciphertext');

    return null;
  }

  printDigestCheck(computeDigest(saltHex, ciphertextHex), digestHex.toUpperCase());

  const plaintext = decryptToText(saltHex, ciphertextHex);
  const jsonText = plaintext.slice(0, plaintext.lastIndexOf('}') + 1);
  const ellipsis = jsonText.length > DECRYPTED_PREVIEW_LENGTH ? '...' : '';

  console.log('Decrypted:', jsonText.slice(0, DECRYPTED_PREVIEW_LENGTH) + ellipsis);

  return JSON.parse(jsonText);
}

function printDigestCheck(computedDigest, expectedDigest) {
  if (computedDigest === expectedDigest) {
    console.log('Digest OK');

    return;
  }

  console.log('Digest mismatch!');
  console.log('Expected:', expectedDigest.slice(0, DIGEST_PREVIEW_LENGTH) + '...');
  console.log('Computed:', computedDigest.slice(0, DIGEST_PREVIEW_LENGTH) + '...');
}

function formatCode(response) {
  return `${response.code.major}.${response.code.minor}`;
}

main();
