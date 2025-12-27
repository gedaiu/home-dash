#!/usr/bin/env node

// Simplified test - just try to get any observe updates

const coap = require('node-coap-client').CoapClient;
const crypto = require('crypto');

const SECRET_KEY = 'JiangPan';
const DEVICE_IP = process.argv[2] || '192.168.1.237';
const baseUrl = `coap://${DEVICE_IP}:5683`;

console.log('Testing Philips Air Purifier at:', DEVICE_IP);

async function test() {
  // Reset any existing connections
  coap.reset();
  
  // Step 1: Info
  console.log('\n1. Getting device info...');
  const info = await coap.request(`${baseUrl}/sys/dev/info`, 'get');
  console.log('Info:', info.payload.toString());
  
  // Step 2: Sync
  console.log('\n2. Syncing...');
  const token = crypto.randomBytes(32).toString('hex').toUpperCase();
  const sync = await coap.request(`${baseUrl}/sys/dev/sync`, 'post', 
    Buffer.from(token, 'utf-8'));
  const counter = sync.payload.toString('utf-8');
  console.log('Counter:', counter);
  
  // Step 3: Observe with raw output
  console.log('\n3. Starting observe (30 seconds)...');
  console.log('Waiting for observe updates...\n');
  
  let updateCount = 0;
  
  await coap.observe(`${baseUrl}/sys/dev/status`, 'get', 
    (response) => {
      updateCount++;
      console.log(`Update ${updateCount}:`);
      console.log('  Code:', response.code?.major + '.' + response.code?.minor);
      console.log('  Payload length:', response.payload?.length || 0);
      if (response.payload && response.payload.length > 0) {
        const hex = response.payload.toString('utf-8');
        console.log('  First 40 chars:', hex.slice(0, 40));
      }
      console.log('');
    }, 
    '', 
    { keepAlive: true, confirmable: false, retransmit: true }
  );
  
  console.log('Observe registered');
  
  // Wait 30 seconds
  await new Promise(r => setTimeout(r, 30000));
  
  console.log(`\nReceived ${updateCount} updates`);
  coap.stopObserving(`${baseUrl}/sys/dev/status`);
  coap.reset();
}

test().catch(err => {
  console.error('Error:', err);
  coap.reset();
});
