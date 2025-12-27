#!/usr/bin/env node

// Test script based on node-red-contrib-philips-airjs
// Uses node-coap-client library

const coap = require('node-coap-client').CoapClient;
const crypto = require('crypto');
const aesjs = require('aes-js');

const SECRET_KEY = 'JiangPan';
const DEVICE_IP = process.argv[2] || '192.168.1.237';

console.log('Testing Philips Air Purifier at:', DEVICE_IP);
console.log('');

let msgCounter = '';

function deriveKeyIvForDecrypt(saltHex) {
  // For decryption: MD5(SECRET_KEY + salt) where salt is 8-char hex string
  // Key and IV are the hex string used as UTF-8 bytes (16 chars = 16 bytes each)
  const hash = crypto.createHash('md5')
    .update(Buffer.from(SECRET_KEY + saltHex, 'utf-8'))
    .digest('hex')
    .toUpperCase();

  const halfLen = hash.length / 2;
  const key = Buffer.from(hash.substring(0, halfLen), 'utf-8');
  const iv = Buffer.from(hash.substring(halfLen), 'utf-8');

  return { key, iv };
}

function increaseCounter() {
  const inbuffer = Buffer.from(msgCounter, 'hex');
  const counterint = inbuffer.readUInt32BE(0) + 1;
  const outbuffer = Buffer.allocUnsafe(4);
  outbuffer.writeUInt32BE(counterint, 0);
  msgCounter = outbuffer.toString('hex').toUpperCase();
}

function decrypt(payload) {
  try {
    const hexString = payload.toString('utf-8');
    console.log('Raw hex payload length:', hexString.length);

    if (hexString.length < 72) {
      console.log('Payload too short for encrypted data');
      return null;
    }

    // Extract salt/counter (first 8 hex chars)
    const saltHex = hexString.slice(0, 8);
    console.log('Salt from payload:', saltHex);

    // Extract ciphertext (middle part)
    const ciphertextHex = hexString.slice(8, -64);
    console.log('Ciphertext length:', ciphertextHex.length / 2, 'bytes');

    // Extract digest (last 64 hex chars)
    const digestHex = hexString.slice(-64);

    if (!ciphertextHex || ciphertextHex.length === 0) {
      console.log('No ciphertext');
      return null;
    }

    // Verify SHA256 digest: hash of (salt + ciphertext) as string, not binary
    const computedDigest = crypto.createHash('sha256')
      .update(saltHex + ciphertextHex)
      .digest('hex')
      .toUpperCase();

    if (computedDigest !== digestHex.toUpperCase()) {
      console.log('Digest mismatch!');
      console.log('Expected:', digestHex.toUpperCase().slice(0, 16) + '...');
      console.log('Computed:', computedDigest.slice(0, 16) + '...');
    } else {
      console.log('Digest OK');
    }

    // Derive key/iv for decryption
    const { key, iv } = deriveKeyIvForDecrypt(saltHex);

    // Decrypt using aes-js CBC
    const ciphertext = Buffer.from(ciphertextHex, 'hex');
    const aesCbc = new aesjs.ModeOfOperation.cbc(key, iv);
    const decrypted = aesCbc.decrypt(ciphertext);

    // Convert to string and remove PKCS7 padding manually
    const plaintext = aesjs.utils.utf8.fromBytes(decrypted);
    // Find the end of valid JSON (before padding chars)
    const jsonEnd = plaintext.lastIndexOf('}') + 1;
    const jsonStr = plaintext.slice(0, jsonEnd);

    console.log('Decrypted:', jsonStr.slice(0, 200) + (jsonStr.length > 200 ? '...' : ''));
    return JSON.parse(jsonStr);
  } catch (err) {
    console.error('Decrypt error:', err.message);
    return null;
  }
}

async function testConnection() {
  const baseUrl = `coap://${DEVICE_IP}:5683`;

  console.log('=== Testing CoAP Connection ===');
  console.log('');

  try {
    // Step 1: Get device info (unencrypted)
    console.log('--- Step 1: GET /sys/dev/info ---');
    try {
      const infoResponse = await coap.request(`${baseUrl}/sys/dev/info`, 'get', null, {
        keepAlive: true,
        confirmable: true,
        retransmit: true
      });
      console.log('Response code:', infoResponse.code.major + '.' + infoResponse.code.minor);
      if (infoResponse.payload) {
        const info = JSON.parse(infoResponse.payload.toString());
        console.log('Device Info:', JSON.stringify(info, null, 2));
      }
    } catch (err) {
      console.log('Failed:', err.message);
    }
    console.log('');

    // Step 2: Sync to get counter
    console.log('--- Step 2: POST /sys/dev/sync ---');
    try {
      // Use uppercase hex token like the real implementation
      const syncToken = crypto.randomBytes(32).toString('hex').toUpperCase();
      console.log('Sync token:', syncToken.slice(0, 32) + '...');

      // Stop any existing observe and reset
      coap.stopObserving(`${baseUrl}/sys/dev/status`);
      coap.reset(baseUrl);

      const syncResponse = await coap.request(`${baseUrl}/sys/dev/sync`, 'post',
        Buffer.from(syncToken, 'utf-8'),
        { keepAlive: true, confirmable: true, retransmit: true }
      );

      console.log('Response code:', syncResponse.code.major + '.' + syncResponse.code.minor);

      if (syncResponse.payload) {
        // Sync response gives us the counter as raw hex string
        msgCounter = syncResponse.payload.toString('utf-8');
        console.log('Got counter:', msgCounter);
        console.log('Counter value:', parseInt(msgCounter, 16));
      }
    } catch (err) {
      console.log('Sync failed:', err.message);
      return;
    }
    console.log('');

    // Step 3: Observe status (with correct options)
    console.log('--- Step 3: OBSERVE /sys/dev/status ---');
    console.log('Starting observe (will run for 15 seconds)...');

    let gotData = false;

    const observePromise = new Promise((resolve) => {
      const timeout = setTimeout(() => {
        console.log('Observe timeout');
        coap.stopObserving(`${baseUrl}/sys/dev/status`);
        resolve();
      }, 15000);

      // Use confirmable: false like the real implementation
      coap.observe(`${baseUrl}/sys/dev/status`, 'get', (response) => {
        console.log('\n=== Observe Update ===');
        console.log('Response code:', response.code.major + '.' + response.code.minor);

        if (response.payload && response.payload.length > 0) {
          gotData = true;
          const data = decrypt(response.payload);
          if (data) {
            // Extract interesting fields
            const status = {
              power: data.pwr,
              mode: data.mode,
              fanSpeed: data.om,
              pm25: data.pm25,
              humidity: data.rh,
              temperature: data.temp,
              allergenIndex: data.iaql,
              gasIndex: data.aqig
            };
            console.log('Status:', JSON.stringify(status, null, 2));
          }
        }
      }, '', { keepAlive: true, confirmable: false, retransmit: true })
      .then(() => {
        console.log('Observe started successfully');
      })
      .catch(err => {
        console.log('Observe setup error:', err.message);
        clearTimeout(timeout);
        resolve();
      });
    });

    await observePromise;

    if (!gotData) {
      console.log('\nNo observe data received. Trying direct status request...');

      // Try a direct GET with the counter we have
      console.log('--- Fallback: GET /sys/dev/status ---');
      try {
        const statusResponse = await coap.request(`${baseUrl}/sys/dev/status`, 'get', null, {
          keepAlive: true,
          confirmable: true,
          retransmit: true
        });
        console.log('Response code:', statusResponse.code.major + '.' + statusResponse.code.minor);
        if (statusResponse.payload) {
          const data = decrypt(statusResponse.payload);
          if (data) {
            console.log('Full status data:', JSON.stringify(data, null, 2));
          }
        }
      } catch (err) {
        console.log('Status request failed:', err.message);
      }
    }

  } catch (err) {
    console.error('Connection error:', err);
  } finally {
    console.log('');
    console.log('Cleaning up...');
    coap.reset();
  }
}

testConnection().catch(console.error);
