#!/usr/bin/env node

const coap = require('node-coap-client').CoapClient;
const crypto = require('crypto');
const aesjs = require('aes-js');

const SECRET_KEY = 'JiangPan';
const DEVICE_IP = process.argv[2] || '192.168.1.237';
const baseUrl = `coap://${DEVICE_IP}:5683`;

console.log('Philips Air Purifier Test');
console.log('Device:', DEVICE_IP);
console.log('');

function decrypt(hexPayload) {
  const saltHex = hexPayload.slice(0, 8);
  const ciphertextHex = hexPayload.slice(8, -64);
  const digestHex = hexPayload.slice(-64);

  // Verify digest
  const computedDigest = crypto.createHash('sha256')
    .update(saltHex + ciphertextHex)
    .digest('hex')
    .toUpperCase();

  if (computedDigest !== digestHex.toUpperCase()) {
    console.log('WARNING: Digest mismatch');
  }

  // Derive key/iv: MD5(SECRET_KEY + salt) as UTF-8, split in half
  const hash = crypto.createHash('md5')
    .update(Buffer.from(SECRET_KEY + saltHex, 'utf-8'))
    .digest('hex')
    .toUpperCase();

  const key = Buffer.from(hash.substring(0, 16), 'utf-8');
  const iv = Buffer.from(hash.substring(16), 'utf-8');

  // Decrypt
  const ciphertext = Buffer.from(ciphertextHex, 'hex');
  const aesCbc = new aesjs.ModeOfOperation.cbc(key, iv);
  const decrypted = aesCbc.decrypt(ciphertext);

  // Clean and parse
  const plaintext = aesjs.utils.utf8.fromBytes(decrypted);
  const cleaned = plaintext.replace(/[\u0000-\u001f]+/g, '');
  
  return JSON.parse(cleaned);
}

async function run() {
  // Clean start
  coap.stopObserving(`${baseUrl}/sys/dev/status`);
  coap.reset(baseUrl);
  
  // Get info
  console.log('Getting device info...');
  try {
    const info = await coap.request(`${baseUrl}/sys/dev/info`, 'get', null, {
      keepAlive: true, confirmable: true, retransmit: true
    });
    const deviceInfo = JSON.parse(info.payload.toString());
    console.log('Model:', deviceInfo.modelid);
    console.log('Name:', deviceInfo.name);
    console.log('');
  } catch (e) {
    console.log('Info failed:', e.message);
  }

  // Sync
  console.log('Syncing...');
  try {
    const token = crypto.randomBytes(32).toString('hex').toUpperCase();
    const sync = await coap.request(`${baseUrl}/sys/dev/sync`, 'post',
      Buffer.from(token, 'utf-8'),
      { keepAlive: true, confirmable: true, retransmit: true }
    );
    console.log('Counter:', sync.payload.toString('utf-8'));
    console.log('');
  } catch (e) {
    console.log('Sync failed:', e.message);
    return;
  }

  // Observe
  console.log('Starting observe (60 seconds)...');
  console.log('Waiting for status updates...\n');

  let updateCount = 0;

  try {
    await coap.observe(`${baseUrl}/sys/dev/status`, 'get', 
      (response) => {
        if (response.payload && response.payload.length > 0) {
          updateCount++;
          const payload = response.payload.toString('utf-8');
          
          try {
            const data = decrypt(payload);
            const state = data.state?.reported || data;
            
            console.log(`=== Update ${updateCount} ===`);
            console.log('Power:', state.pwr === '1' ? 'ON' : 'OFF');
            console.log('Mode:', state.mode);
            console.log('Fan speed:', state.om);
            console.log('PM2.5:', state.pm25);
            console.log('Humidity:', state.rh, '%');
            console.log('Temperature:', state.temp, 'C');
            console.log('Air quality index:', state.iaql);
            console.log('');
          } catch (e) {
            console.log(`Update ${updateCount}: Decrypt failed -`, e.message);
          }
        }
      },
      '',
      { keepAlive: true, confirmable: false, retransmit: true }
    );
    console.log('Observe registered successfully');
  } catch (e) {
    console.log('Observe failed:', e.message);
  }

  // Wait 60 seconds
  await new Promise(r => setTimeout(r, 60000));

  console.log(`\nTotal updates received: ${updateCount}`);
  
  coap.stopObserving(`${baseUrl}/sys/dev/status`);
  coap.reset(baseUrl);
  console.log('Done');
}

run().catch(err => {
  console.error('Error:', err);
  coap.reset();
});
