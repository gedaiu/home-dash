#!/usr/bin/env node

// Test decryption with actual payload from device

const crypto = require('crypto');
const aesjs = require('aes-js');

const SECRET_KEY = 'JiangPan';

function deriveKeyIv(saltHex) {
  // MD5(SECRET_KEY + salt) as UTF-8 string
  const hash = crypto.createHash('md5')
    .update(Buffer.from(SECRET_KEY + saltHex, 'utf-8'))
    .digest('hex')
    .toUpperCase();

  const halfLen = hash.length / 2;
  const key = Buffer.from(hash.substring(0, halfLen), 'utf-8');
  const iv = Buffer.from(hash.substring(halfLen), 'utf-8');

  return { key, iv };
}

function decrypt(hexPayload) {
  console.log('Payload length:', hexPayload.length);

  // Extract parts
  const saltHex = hexPayload.slice(0, 8);
  const ciphertextHex = hexPayload.slice(8, -64);
  const digestHex = hexPayload.slice(-64);

  console.log('Salt:', saltHex);
  console.log('Ciphertext length:', ciphertextHex.length / 2, 'bytes');
  console.log('Digest:', digestHex.slice(0, 16) + '...');

  // Verify digest: SHA256(salt + ciphertext) as hex string
  const computedDigest = crypto.createHash('sha256')
    .update(saltHex + ciphertextHex)
    .digest('hex')
    .toUpperCase();

  console.log('Computed digest:', computedDigest.slice(0, 16) + '...');
  console.log('Digest match:', computedDigest.toUpperCase() === digestHex.toUpperCase());

  // Derive key/iv
  const { key, iv } = deriveKeyIv(saltHex);
  console.log('Key (utf8):', key.toString('utf8'));
  console.log('IV (utf8):', iv.toString('utf8'));

  // Decrypt
  const ciphertext = Buffer.from(ciphertextHex, 'hex');
  const aesCbc = new aesjs.ModeOfOperation.cbc(key, iv);
  const decrypted = aesCbc.decrypt(ciphertext);

  // Convert and clean
  const plaintext = aesjs.utils.utf8.fromBytes(decrypted);
  // Remove control chars and find JSON
  const cleaned = plaintext.replace(/[\u0000-\u0019]+/g, '');
  console.log('Cleaned length:', cleaned.length);
  console.log('First 200 chars:', cleaned.slice(0, 200));
  
  try {
    const json = JSON.parse(cleaned);
    console.log('\nParsed JSON:', JSON.stringify(json, null, 2).slice(0, 500));
    return json;
  } catch (e) {
    console.log('JSON parse error:', e.message);
    return null;
  }
}

// Test with sample payload from your device
// Using the first 40 chars you provided: 9FA2BC4BACF77CA5AFE69305CDE88256472AF858
// We need the full payload - let me capture it

const coap = require('node-coap-client').CoapClient;
const DEVICE_IP = process.argv[2] || '192.168.1.237';
const baseUrl = `coap://${DEVICE_IP}:5683`;

async function test() {
  coap.reset();
  
  // Sync first
  const token = crypto.randomBytes(32).toString('hex').toUpperCase();
  await coap.request(`${baseUrl}/sys/dev/sync`, 'post', Buffer.from(token, 'utf-8'));
  console.log('Synced\n');
  
  // Get one observe update
  let resolved = false;
  await new Promise((resolve) => {
    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        resolve();
      }
    }, 10000);
    
    coap.observe(`${baseUrl}/sys/dev/status`, 'get', 
      (response) => {
        if (response.payload && response.payload.length > 0 && !resolved) {
          resolved = true;
          clearTimeout(timeout);
          const payload = response.payload.toString('utf-8');
          console.log('Got payload!\n');
          decrypt(payload);
          coap.stopObserving(`${baseUrl}/sys/dev/status`);
          resolve();
        }
      }, 
      '', 
      { keepAlive: true, confirmable: false, retransmit: true }
    );
  });
  
  coap.reset();
}

test().catch(console.error);
