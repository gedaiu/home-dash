#!/usr/bin/env node

// Simplified test - just try to get any observe updates

const coap = require('node-coap-client').CoapClient;
const {
  resolveDeviceIp,
  createBaseUrl,
  createSyncToken,
  createObserveOptions,
  delay
} = require('./scripts/philips/common');

const OBSERVE_DURATION_MS = 30000;
const PAYLOAD_PREVIEW_LENGTH = 40;

function main() {
  const deviceIp = resolveDeviceIp();

  console.log('Testing Philips Air Purifier at:', deviceIp);

  runTest(createBaseUrl(deviceIp)).catch(reportFailure);
}

async function runTest(baseUrl) {
  coap.reset();

  await printDeviceInfo(baseUrl);
  await syncWithDevice(baseUrl);

  const stats = { updateCount: 0 };

  await observeStatus(baseUrl, stats);
  await delay(OBSERVE_DURATION_MS);

  console.log(`\nReceived ${stats.updateCount} updates`);
  coap.stopObserving(`${baseUrl}/sys/dev/status`);
  coap.reset();
}

async function printDeviceInfo(baseUrl) {
  console.log('\n1. Getting device info...');

  const infoResponse = await coap.request(`${baseUrl}/sys/dev/info`, 'get');

  console.log('Info:', infoResponse.payload.toString());
}

async function syncWithDevice(baseUrl) {
  console.log('\n2. Syncing...');

  const sync = await coap.request(`${baseUrl}/sys/dev/sync`, 'post', createSyncToken());

  console.log('Counter:', sync.payload.toString('utf-8'));
}

async function observeStatus(baseUrl, stats) {
  console.log('\n3. Starting observe (30 seconds)...');
  console.log('Waiting for observe updates...\n');

  await coap.observe(
    `${baseUrl}/sys/dev/status`,
    'get',
    response => logUpdate(stats, response),
    '',
    createObserveOptions()
  );

  console.log('Observe registered');
}

function logUpdate(stats, response) {
  stats.updateCount++;
  console.log(`Update ${stats.updateCount}:`);
  console.log('  Code:', `${response.code?.major}.${response.code?.minor}`);
  console.log('  Payload length:', response.payload?.length || 0);

  logPayloadPreview(response.payload);
  console.log('');
}

function logPayloadPreview(payload) {
  if (!payload || payload.length === 0) {
    return;
  }

  const payloadText = payload.toString('utf-8');

  console.log('  First 40 chars:', payloadText.slice(0, PAYLOAD_PREVIEW_LENGTH));
}

function reportFailure(err) {
  console.error('Error:', err);
  coap.reset();
}

main();
