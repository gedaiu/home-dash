#!/usr/bin/env node

const dgram = require('node:dgram');
const crypto = require('node:crypto');
const http = require('node:http');
const dns = require('node:dns');

const ip = process.argv[2] || '192.168.1.237';
const timeout = 5000;

console.log('=== Philips Air Purifier Local Probe ===');
console.log('Target:', ip);
console.log('');

// CoAP constants
const COAP_PORT = 5683;
const COAP_TYPE_CON = 0;
const COAP_GET = 0x01;
const COAP_POST = 0x02;
const COAP_OPT_URI_PATH = 11;

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

function sendCoap(path, method = 'GET', payload = null) {
  return new Promise((resolve) => {
    const socket = dgram.createSocket('udp4');
    const token = crypto.randomBytes(4);
    const msgId = Math.floor(Math.random() * 65535);

    const timer = setTimeout(() => {
      socket.close();
      resolve({ success: false, error: 'timeout' });
    }, timeout);

    socket.on('message', (msg, rinfo) => {
      clearTimeout(timer);
      socket.close();
      resolve({
        success: true,
        data: msg,
        hex: msg.toString('hex'),
        ascii: msg.toString('utf-8').replace(/[^\x20-\x7E]/g, '.'),
        from: rinfo
      });
    });

    socket.on('error', (err) => {
      clearTimeout(timer);
      socket.close();
      resolve({ success: false, error: err.message });
    });

    const pathParts = path.split('/').filter(p => p);
    const options = pathParts.map(part => ({
      number: COAP_OPT_URI_PATH,
      value: part
    }));

    const code = method === 'POST' ? COAP_POST : COAP_GET;
    const packet = createCoapPacket(COAP_TYPE_CON, code, msgId, token, options, payload);

    socket.send(packet, COAP_PORT, ip);
  });
}

function httpRequest(port, path, method = 'GET') {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      resolve({ success: false, error: 'timeout' });
    }, timeout);

    const req = http.request({
      hostname: ip,
      port,
      path,
      method,
      timeout
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        clearTimeout(timer);
        resolve({ success: true, status: res.statusCode, data });
      });
    });

    req.on('error', (err) => {
      clearTimeout(timer);
      resolve({ success: false, error: err.message });
    });

    req.on('timeout', () => {
      clearTimeout(timer);
      req.destroy();
      resolve({ success: false, error: 'timeout' });
    });

    req.end();
  });
}

function checkPort(port) {
  return new Promise((resolve) => {
    const socket = require('node:net').createConnection({ host: ip, port, timeout });

    socket.on('connect', () => {
      socket.destroy();
      resolve({ open: true });
    });

    socket.on('error', () => {
      resolve({ open: false });
    });

    socket.on('timeout', () => {
      socket.destroy();
      resolve({ open: false });
    });
  });
}

async function main() {
  console.log('=== Port Scan ===');
  const portsToCheck = [80, 443, 5683, 5684, 8080, 8443, 1883, 8883, 5222, 5223];

  for (const port of portsToCheck) {
    const result = await checkPort(port);
    const status = result.open ? 'OPEN' : 'closed';
    console.log(`  Port ${port}: ${status}`);
  }
  console.log('');

  console.log('=== UDP CoAP Probes (port 5683) ===');
  const coapPaths = [
    '/sys/dev/status',
    '/sys/dev/sync',
    '/status',
    '/air',
    '/.well-known/core',
    '/di/v1/products/1/air',
    '/cgi-bin/api.cgi'
  ];

  for (const path of coapPaths) {
    process.stdout.write(`  GET ${path}... `);
    const result = await sendCoap(path, 'GET');
    if (result.success) {
      console.log('RESPONSE!');
      console.log('    Hex:', result.hex.slice(0, 100));
      console.log('    ASCII:', result.ascii.slice(0, 100));
    } else {
      console.log(result.error);
    }
  }
  console.log('');

  console.log('=== CoAP Sync Attempts ===');
  const syncToken = crypto.randomBytes(16).toString('hex');
  const syncPaths = ['/sys/dev/sync', '/cgi-bin/api.cgi'];

  for (const path of syncPaths) {
    process.stdout.write(`  POST ${path} with token... `);
    const result = await sendCoap(path, 'POST', syncToken);
    if (result.success) {
      console.log('RESPONSE!');
      console.log('    Hex:', result.hex.slice(0, 100));
      console.log('    ASCII:', result.ascii.slice(0, 100));
    } else {
      console.log(result.error);
    }
  }
  console.log('');

  console.log('=== HTTP Probes ===');
  const httpEndpoints = [
    { port: 80, path: '/' },
    { port: 80, path: '/di/v1/products/1/air' },
    { port: 80, path: '/status' },
    { port: 80, path: '/api/status' },
    { port: 8080, path: '/' },
    { port: 8080, path: '/status' }
  ];

  for (const ep of httpEndpoints) {
    process.stdout.write(`  GET http://${ip}:${ep.port}${ep.path}... `);
    const result = await httpRequest(ep.port, ep.path);
    if (result.success) {
      console.log('HTTP', result.status);
      if (result.data) {
        console.log('    Data:', result.data.slice(0, 200));
      }
    } else {
      console.log(result.error);
    }
  }
  console.log('');

  console.log('=== mDNS/DNS-SD Check ===');
  try {
    const addresses = await dns.promises.resolve4(ip);
    console.log('  DNS resolve:', addresses);
  } catch {
    console.log('  DNS resolve: not applicable for IP');
  }

  console.log('');
  console.log('=== Summary ===');
  console.log('Based on traffic capture, this device uses MQTT over TLS (port 8883)');
  console.log('to communicate with Philips cloud servers.');
  console.log('');
  console.log('Local control options:');
  console.log('1. If any CoAP endpoints responded, local control may be possible');
  console.log('2. If HTTP responded, older API may be available');
  console.log('3. Otherwise, cloud-only control via Matter/HomeKit bridge may be needed');
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
