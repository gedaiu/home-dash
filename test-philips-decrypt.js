#!/usr/bin/env node

// Test decryption with actual payload from device

const coap = require('node-coap-client').CoapClient;
const {
  resolveDeviceIp,
  createBaseUrl,
  createSyncToken,
  createObserveOptions,
  splitPayload,
  computeDigest,
  deriveKeyIv,
  decryptToText
} = require('./scripts/philips/common');

const OBSERVE_TIMEOUT_MS = 10000;
const DIGEST_PREVIEW_LENGTH = 16;
const CLEANED_PREVIEW_LENGTH = 200;
const PARSED_PREVIEW_LENGTH = 500;
const JSON_INDENT = 2;
const BYTES_PER_HEX_PAIR = 2;

function main() {
  test(createBaseUrl(resolveDeviceIp())).catch(console.error);
}

async function test(baseUrl) {
  coap.reset();

  await coap.request(`${baseUrl}/sys/dev/sync`, 'post', createSyncToken());
  console.log('Synced\n');

  await decryptFirstStatus(baseUrl);

  coap.reset();
}

function decryptFirstStatus(baseUrl) {
  const outcome = { isResolved: false };

  return new Promise(resolve => {
    const timeout = setTimeout(() => finish(outcome, resolve), OBSERVE_TIMEOUT_MS);

    coap.observe(
      `${baseUrl}/sys/dev/status`,
      'get',
      response => handleStatus({ baseUrl, response, outcome, timeout, resolve }),
      '',
      createObserveOptions()
    );
  });
}

function finish(outcome, resolve) {
  if (outcome.isResolved) {
    return;
  }

  outcome.isResolved = true;
  resolve();
}

function handleStatus({ baseUrl, response, outcome, timeout, resolve }) {
  if (!response.payload || response.payload.length === 0 || outcome.isResolved) {
    return;
  }

  clearTimeout(timeout);
  console.log('Got payload!\n');
  decrypt(response.payload.toString('utf-8'));
  coap.stopObserving(`${baseUrl}/sys/dev/status`);
  finish(outcome, resolve);
}

function decrypt(hexPayload) {
  console.log('Payload length:', hexPayload.length);

  const { saltHex, ciphertextHex, digestHex } = splitPayload(hexPayload);

  printPayloadParts({ saltHex, ciphertextHex, digestHex });
  printDerivedKey(saltHex);

  // Remove control chars and find JSON
  const cleaned = decryptToText(saltHex, ciphertextHex).replace(/[\u0000-\u0019]+/g, '');

  console.log('Cleaned length:', cleaned.length);
  console.log('First 200 chars:', cleaned.slice(0, CLEANED_PREVIEW_LENGTH));

  return parseJson(cleaned);
}

function printPayloadParts({ saltHex, ciphertextHex, digestHex }) {
  const computedDigest = computeDigest(saltHex, ciphertextHex);

  console.log('Salt:', saltHex);
  console.log('Ciphertext length:', ciphertextHex.length / BYTES_PER_HEX_PAIR, 'bytes');
  console.log('Digest:', digestHex.slice(0, DIGEST_PREVIEW_LENGTH) + '...');
  console.log('Computed digest:', computedDigest.slice(0, DIGEST_PREVIEW_LENGTH) + '...');
  console.log('Digest match:', computedDigest === digestHex.toUpperCase());
}

function printDerivedKey(saltHex) {
  const { key, initVector } = deriveKeyIv(saltHex);

  console.log('Key (utf8):', key.toString('utf8'));
  console.log('IV (utf8):', initVector.toString('utf8'));
}

function parseJson(cleaned) {
  try {
    const parsed = JSON.parse(cleaned);

    console.log('\nParsed JSON:', JSON.stringify(parsed, null, JSON_INDENT).slice(0, PARSED_PREVIEW_LENGTH));

    return parsed;
  } catch (error) {
    console.log('JSON parse error:', error.message);

    return null;
  }
}

main();
