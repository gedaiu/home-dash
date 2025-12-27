#!/usr/bin/env node

const coap = require('node-coap-client').CoapClient;
const crypto = require('crypto');
const aesjs = require('aes-js');

const SECRET_KEY = 'JiangPan';
const DEVICE_IP = process.argv[2] || '192.168.1.237';
const baseUrl = `coap://${DEVICE_IP}:5683`;

console.log('Philips Air Purifier - Raw Data Dump');
console.log('Device:', DEVICE_IP);
console.log('');

function decrypt(hexPayload) {
  const saltHex = hexPayload.slice(0, 8);
  const ciphertextHex = hexPayload.slice(8, -64);

  const hash = crypto.createHash('md5')
    .update(Buffer.from(SECRET_KEY + saltHex, 'utf-8'))
    .digest('hex')
    .toUpperCase();

  const key = Buffer.from(hash.substring(0, 16), 'utf-8');
  const iv = Buffer.from(hash.substring(16), 'utf-8');

  const ciphertext = Buffer.from(ciphertextHex, 'hex');
  const aesCbc = new aesjs.ModeOfOperation.cbc(key, iv);
  const decrypted = aesCbc.decrypt(ciphertext);

  const plaintext = aesjs.utils.utf8.fromBytes(decrypted);
  const cleaned = plaintext.replace(/[\u0000-\u001f]+/g, '');
  
  return JSON.parse(cleaned);
}

async function run() {
  coap.stopObserving(`${baseUrl}/sys/dev/status`);
  coap.reset(baseUrl);
  
  // Sync
  const token = crypto.randomBytes(32).toString('hex').toUpperCase();
  await coap.request(`${baseUrl}/sys/dev/sync`, 'post',
    Buffer.from(token, 'utf-8'),
    { keepAlive: true, confirmable: true, retransmit: true }
  );
  console.log('Synced\n');

  // Get one status update and dump all fields
  await new Promise((resolve) => {
    const timeout = setTimeout(() => {
      console.log('Timeout - no updates received');
      resolve();
    }, 15000);

    coap.observe(`${baseUrl}/sys/dev/status`, 'get', 
      (response) => {
        if (response.payload && response.payload.length > 0) {
          clearTimeout(timeout);
          const payload = response.payload.toString('utf-8');
          
          try {
            const data = decrypt(payload);
            console.log('=== RAW DECRYPTED DATA ===');
            console.log(JSON.stringify(data, null, 2));
          } catch (e) {
            console.log('Decrypt failed:', e.message);
          }
          
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

run().catch(console.error);
