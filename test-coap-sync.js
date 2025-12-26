#!/usr/bin/env node

const dgram = require('node:dgram');
const crypto = require('node:crypto');

const ip = process.argv[2] || '192.168.1.237';
const COAP_PORT = 5683;

console.log('=== CoAP Sync Test ===');
console.log('Target:', ip);
console.log('');

function createCoapPacket(type, code, messageId, token, options, payload) {
  const tokenLen = token ? token.length : 0;
  const header = Buffer.alloc(4);
  header[0] = (1 << 6) | (type << 4) | tokenLen;
  header[1] = code;
  header[2] = (messageId >> 8) & 0xff;
  header[3] = messageId & 0xff;

  const parts = [header];
  if (token && tokenLen > 0) {
    parts.push(token);
  }

  let lastOptNum = 0;
  for (const opt of options) {
    const delta = opt.number - lastOptNum;
    lastOptNum = opt.number;
    const value = Buffer.isBuffer(opt.value) ? opt.value : Buffer.from(opt.value, 'utf-8');

    let deltaNibble = delta;
    let lenNibble = value.length;

    if (delta >= 13) {
      deltaNibble = 13;
    }
    if (value.length >= 13) {
      lenNibble = 13;
    }

    parts.push(Buffer.from([(deltaNibble << 4) | lenNibble]));
    if (delta >= 13) {
      parts.push(Buffer.from([delta - 13]));
    }
    if (value.length >= 13) {
      parts.push(Buffer.from([value.length - 13]));
    }
    parts.push(value);
  }

  if (payload && payload.length > 0) {
    parts.push(Buffer.from([0xff]));
    parts.push(Buffer.isBuffer(payload) ? payload : Buffer.from(payload, 'utf-8'));
  }

  return Buffer.concat(parts);
}

function parseCoapResponse(buffer) {
  if (buffer.length < 4) {
    return null;
  }

  const version = (buffer[0] >> 6) & 0x03;
  const type = (buffer[0] >> 4) & 0x03;
  const tokenLength = buffer[0] & 0x0f;
  const code = buffer[1];
  const codeClass = (code >> 5) & 0x07;
  const codeDetail = code & 0x1f;
  const messageId = (buffer[2] << 8) | buffer[3];

  let offset = 4;
  const token = buffer.slice(offset, offset + tokenLength);
  offset += tokenLength;

  const options = [];
  let optionNumber = 0;

  while (offset < buffer.length && buffer[offset] !== 0xff) {
    const optByte = buffer[offset++];
    let delta = (optByte >> 4) & 0x0f;
    let length = optByte & 0x0f;

    if (delta === 13) {
      delta = buffer[offset++] + 13;
    } else if (delta === 14) {
      delta = ((buffer[offset] << 8) | buffer[offset + 1]) + 269;
      offset += 2;
    }

    if (length === 13) {
      length = buffer[offset++] + 13;
    } else if (length === 14) {
      length = ((buffer[offset] << 8) | buffer[offset + 1]) + 269;
      offset += 2;
    }

    optionNumber += delta;
    options.push({ number: optionNumber, value: buffer.slice(offset, offset + length) });
    offset += length;
  }

  let payload = null;
  if (offset < buffer.length && buffer[offset] === 0xff) {
    payload = buffer.slice(offset + 1);
  }

  return {
    version,
    type,
    typeStr: ['CON', 'NON', 'ACK', 'RST'][type],
    code,
    codeStr: codeClass + '.' + String(codeDetail).padStart(2, '0'),
    messageId,
    token,
    options,
    payload
  };
}

function sendAndParse(path, method, payload = null) {
  return new Promise((resolve) => {
    const socket = dgram.createSocket('udp4');
    const token = crypto.randomBytes(4);
    const msgId = Math.floor(Math.random() * 65535);

    const timer = setTimeout(() => {
      socket.close();
      resolve(null);
    }, 10000);

    socket.on('message', (msg) => {
      clearTimeout(timer);
      socket.close();

      console.log('Raw response:', msg.toString('hex'));
      console.log('');

      const parsed = parseCoapResponse(msg);
      resolve(parsed);
    });

    socket.on('error', (err) => {
      clearTimeout(timer);
      socket.close();
      console.log('Error:', err.message);
      resolve(null);
    });

    const pathParts = path.split('/').filter(p => p);
    const options = pathParts.map(part => ({
      number: 11, // URI-Path
      value: part
    }));

    const code = method === 'POST' ? 0x02 : 0x01;
    const packet = createCoapPacket(0, code, msgId, token, options, payload);

    console.log('Sending', method, path);
    console.log('Request:', packet.toString('hex'));
    console.log('');

    socket.send(packet, COAP_PORT, ip);
  });
}

async function main() {
  // Step 1: Try sync
  console.log('=== Step 1: Sync ===');
  const syncToken = crypto.randomBytes(16).toString('hex');
  console.log('Sync token:', syncToken);

  const syncResponse = await sendAndParse('/sys/dev/sync', 'POST', syncToken);

  if (syncResponse) {
    console.log('Parsed sync response:');
    console.log('  Type:', syncResponse.typeStr);
    console.log('  Code:', syncResponse.codeStr);
    console.log('  Token:', syncResponse.token.toString('hex'));

    if (syncResponse.payload) {
      const payloadStr = syncResponse.payload.toString('utf-8');
      console.log('  Payload:', payloadStr);
      console.log('  Payload hex:', syncResponse.payload.toString('hex'));

      // Try to extract counter from payload
      // Format might be: counter as hex string
      if (/^[0-9a-fA-F]+$/.test(payloadStr)) {
        const counter = parseInt(payloadStr, 16);
        console.log('  Counter (parsed):', counter);
      }
    }
  }

  console.log('');

  // Step 2: Try status request after sync
  console.log('=== Step 2: Status Request ===');
  const statusResponse = await sendAndParse('/sys/dev/status', 'GET');

  if (statusResponse) {
    console.log('Parsed status response:');
    console.log('  Type:', statusResponse.typeStr);
    console.log('  Code:', statusResponse.codeStr);

    if (statusResponse.payload) {
      console.log('  Payload length:', statusResponse.payload.length);
      console.log('  Payload hex:', statusResponse.payload.toString('hex').slice(0, 200));

      // Check if payload looks like encrypted data or JSON
      const payloadStr = statusResponse.payload.toString('utf-8');
      if (payloadStr.startsWith('{')) {
        console.log('  Payload JSON:', payloadStr);
      } else if (/^[0-9a-fA-F]+$/.test(payloadStr)) {
        console.log('  Payload appears to be encrypted hex');
        console.log('  First 8 chars (counter?):', payloadStr.slice(0, 8));
        console.log('  Counter value:', parseInt(payloadStr.slice(0, 8), 16));
      }
    }
  } else {
    console.log('No status response (timeout)');
  }

  console.log('');
  console.log('=== Analysis ===');
  console.log('The sync response payload appears to contain the session counter.');
  console.log('After sync, status requests should return encrypted data.');
  console.log('The encryption uses AES-128-CBC with a hardcoded key.');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
