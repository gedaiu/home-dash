#!/usr/bin/env node

const dgram = require('node:dgram');
const crypto = require('node:crypto');

const COAP_PORT = 5683;
const COAP_TYPE_CON = 0;
const COAP_GET = 0x01;
const COAP_POST = 0x02;
const COAP_OPT_URI_PATH = 11;

const ip = process.argv[2] || '192.168.1.237';
const timeout = parseInt(process.argv[3], 10) || 30000;

console.log('=== CoAP Protocol Debugger ===');
console.log('Target IP:', ip);
console.log('Timeout:', timeout, 'ms');
console.log('');

function hexDump(buffer, prefix = '') {
  const hex = buffer.toString('hex');
  const ascii = buffer.toString('utf-8').replace(/[^\x20-\x7E]/g, '.');

  console.log(prefix + 'Hex (' + buffer.length + ' bytes):');
  for (let i = 0; i < hex.length; i += 32) {
    const hexPart = hex.slice(i, i + 32).match(/.{1,2}/g)?.join(' ') || '';
    const asciiPart = ascii.slice(i / 2, i / 2 + 16);
    console.log(prefix + '  ' + hexPart.padEnd(48) + ' | ' + asciiPart);
  }
}

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
    let deltaExt = null;
    let lenExt = null;

    if (delta >= 13) {
      deltaNibble = 13;
      deltaExt = Buffer.from([delta - 13]);
    }

    if (value.length >= 13) {
      lenNibble = 13;
      lenExt = Buffer.from([value.length - 13]);
    }

    parts.push(Buffer.from([(deltaNibble << 4) | lenNibble]));
    if (deltaExt) {
      parts.push(deltaExt);
    }
    if (lenExt) {
      parts.push(lenExt);
    }
    parts.push(value);
  }

  if (payload && payload.length > 0) {
    parts.push(Buffer.from([0xff]));
    parts.push(Buffer.isBuffer(payload) ? payload : Buffer.from(payload, 'utf-8'));
  }

  return Buffer.concat(parts);
}

function parseCoapPacket(buffer) {
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
    codeStr: codeClass + '.' + codeDetail.toString().padStart(2, '0'),
    messageId,
    token,
    options,
    payload
  };
}

async function sendAndReceive(path, method, payload = null) {
  return new Promise((resolve) => {
    const socket = dgram.createSocket('udp4');
    const token = crypto.randomBytes(4);
    const msgId = Math.floor(Math.random() * 65535);

    console.log('--- Sending ' + method + ' ' + path + ' ---');

    const pathParts = path.split('/').filter(p => p);
    const options = pathParts.map(part => ({
      number: COAP_OPT_URI_PATH,
      value: part
    }));

    const code = method === 'POST' ? COAP_POST : COAP_GET;
    const packet = createCoapPacket(COAP_TYPE_CON, code, msgId, token, options, payload);

    console.log('Request packet:');
    hexDump(packet, '  ');
    if (payload) {
      console.log('  Payload:', payload.toString().slice(0, 100));
    }
    console.log('');

    const timer = setTimeout(() => {
      console.log('  TIMEOUT - No response received');
      console.log('');
      socket.close();
      resolve(null);
    }, timeout);

    socket.on('message', (msg, rinfo) => {
      clearTimeout(timer);

      console.log('Response from ' + rinfo.address + ':' + rinfo.port + ':');
      hexDump(msg, '  ');

      const parsed = parseCoapPacket(msg);
      if (parsed) {
        console.log('  Parsed:');
        console.log('    Type:', parsed.typeStr, '(' + parsed.type + ')');
        console.log('    Code:', parsed.codeStr);
        console.log('    Message ID:', parsed.messageId);
        console.log('    Token:', parsed.token.toString('hex'));
        console.log('    Options:', parsed.options.length);
        for (const opt of parsed.options) {
          console.log('      Option ' + opt.number + ':', opt.value.toString('utf-8'));
        }
        if (parsed.payload) {
          console.log('    Payload (' + parsed.payload.length + ' bytes):');
          const payloadStr = parsed.payload.toString('utf-8');
          if (payloadStr.length <= 200) {
            console.log('      ' + payloadStr);
          } else {
            console.log('      ' + payloadStr.slice(0, 200) + '...');
          }

          // Check if it looks like encrypted data
          if (/^[0-9a-f]+$/i.test(payloadStr) && payloadStr.length >= 72) {
            console.log('    Encrypted payload detected:');
            console.log('      Counter (hex):', payloadStr.slice(0, 8));
            console.log('      Counter (dec):', parseInt(payloadStr.slice(0, 8), 16));
            console.log('      Data length:', (payloadStr.length - 72) / 2, 'bytes');
            console.log('      SHA256 digest:', payloadStr.slice(-64));
          }
        }
      }
      console.log('');

      socket.close();
      resolve(parsed);
    });

    socket.on('error', (err) => {
      clearTimeout(timer);
      console.log('  ERROR:', err.message);
      console.log('');
      socket.close();
      resolve(null);
    });

    socket.send(packet, COAP_PORT, ip, (err) => {
      if (err) {
        clearTimeout(timer);
        console.log('  SEND ERROR:', err.message);
        console.log('');
        socket.close();
        resolve(null);
      } else {
        console.log('  Packet sent, waiting for response...');
      }
    });
  });
}

async function main() {
  console.log('Step 1: Try sync endpoint with random token');
  console.log('=========================================');
  const syncToken = crypto.randomBytes(16).toString('hex');
  console.log('Sync token:', syncToken);
  await sendAndReceive('/sys/dev/sync', 'POST', syncToken);

  console.log('Step 2: Try direct status request');
  console.log('==================================');
  await sendAndReceive('/sys/dev/status', 'GET');

  console.log('Step 3: Try alternate sync endpoint');
  console.log('====================================');
  await sendAndReceive('/cgi-bin/api.cgi', 'POST', syncToken);

  console.log('Step 4: Try status with different paths');
  console.log('========================================');
  await sendAndReceive('/status', 'GET');
  await sendAndReceive('/air', 'GET');
  await sendAndReceive('/di/v1/products/1/air', 'GET');

  console.log('Done. Check output above for protocol details.');
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
