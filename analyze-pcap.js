#!/usr/bin/env node

const fs = require('node:fs');

const pcapFile = process.argv[2] || '/tmp/purifier_capture.pcap';

if (!fs.existsSync(pcapFile)) {
  console.error('File not found:', pcapFile);
  console.error('Usage: node analyze-pcap.js <pcap-file>');
  process.exit(1);
}

const data = fs.readFileSync(pcapFile);
console.log('=== PCAP Analysis ===');
console.log('File size:', data.length, 'bytes');
console.log('');

// PCAP global header is 24 bytes
if (data.length < 24) {
  console.error('File too small to be a valid pcap');
  process.exit(1);
}

const magicLE = data.readUInt32LE(0);
const magicBE = data.readUInt32BE(0);

let isLittleEndian = false;
if (magicLE === 0xd4c3b2a1 || magicLE === 0xa1b2c3d4) {
  isLittleEndian = magicLE === 0xd4c3b2a1;
} else if (magicBE === 0xd4c3b2a1 || magicBE === 0xa1b2c3d4) {
  isLittleEndian = magicBE === 0xd4c3b2a1;
} else {
  console.error('Invalid pcap magic number:', magicLE.toString(16), magicBE.toString(16));
  process.exit(1);
}

console.log('PCAP format:', isLittleEndian ? 'little-endian' : 'big-endian');
console.log('Magic (LE):', magicLE.toString(16), 'Magic (BE):', magicBE.toString(16));

const read32 = isLittleEndian
  ? (buf, off) => buf.readUInt32LE(off)
  : (buf, off) => buf.readUInt32BE(off);

const read16 = isLittleEndian
  ? (buf, off) => buf.readUInt16LE(off)
  : (buf, off) => buf.readUInt16BE(off);

const linkType = read32(data, 20);
console.log('Link type:', linkType, linkType === 1 ? '(Ethernet)' : '');
console.log('');

let offset = 24;
let packetNum = 0;
const connections = new Map();
const ports = new Map();
const protocols = new Map();

while (offset + 16 <= data.length) {
  const tsSec = read32(data, offset);
  const tsUsec = read32(data, offset + 4);
  const capturedLen = read32(data, offset + 8);
  const originalLen = read32(data, offset + 12);

  offset += 16;

  if (offset + capturedLen > data.length) {
    break;
  }

  const packetData = data.slice(offset, offset + capturedLen);
  offset += capturedLen;
  packetNum++;

  // Parse Ethernet header (14 bytes)
  if (packetData.length < 14) {
    continue;
  }

  const etherType = packetData.readUInt16BE(12);

  // Only process IPv4 (0x0800)
  if (etherType !== 0x0800) {
    continue;
  }

  // Parse IPv4 header
  const ipHeader = packetData.slice(14);
  if (ipHeader.length < 20) {
    continue;
  }

  const ipVersion = (ipHeader[0] >> 4) & 0x0f;
  const ipHeaderLen = (ipHeader[0] & 0x0f) * 4;
  const ipProtocol = ipHeader[9];

  const srcIp = `${ipHeader[12]}.${ipHeader[13]}.${ipHeader[14]}.${ipHeader[15]}`;
  const dstIp = `${ipHeader[16]}.${ipHeader[17]}.${ipHeader[18]}.${ipHeader[19]}`;

  let protoName = 'unknown';
  let srcPort = 0;
  let dstPort = 0;
  let payloadOffset = 14 + ipHeaderLen;

  if (ipProtocol === 6) {
    // TCP
    protoName = 'TCP';
    const tcpHeader = packetData.slice(payloadOffset);
    if (tcpHeader.length >= 4) {
      srcPort = tcpHeader.readUInt16BE(0);
      dstPort = tcpHeader.readUInt16BE(2);
      const tcpHeaderLen = ((tcpHeader[12] >> 4) & 0x0f) * 4;
      payloadOffset += tcpHeaderLen;
    }
  } else if (ipProtocol === 17) {
    // UDP
    protoName = 'UDP';
    const udpHeader = packetData.slice(payloadOffset);
    if (udpHeader.length >= 8) {
      srcPort = udpHeader.readUInt16BE(0);
      dstPort = udpHeader.readUInt16BE(2);
      payloadOffset += 8;
    }
  } else if (ipProtocol === 1) {
    protoName = 'ICMP';
  }

  const payload = packetData.slice(payloadOffset);

  // Track connections
  const connKey = `${srcIp}:${srcPort} -> ${dstIp}:${dstPort} (${protoName})`;
  const connInfo = connections.get(connKey) || { count: 0, bytes: 0, payloads: [] };
  connInfo.count++;
  connInfo.bytes += payload.length;
  if (payload.length > 0 && connInfo.payloads.length < 3) {
    connInfo.payloads.push({
      timestamp: new Date(tsSec * 1000).toISOString(),
      hex: payload.slice(0, 100).toString('hex'),
      ascii: payload.slice(0, 100).toString('utf-8').replace(/[^\x20-\x7E]/g, '.')
    });
  }
  connections.set(connKey, connInfo);

  // Track ports
  if (srcPort > 0) {
    ports.set(srcPort, (ports.get(srcPort) || 0) + 1);
  }
  if (dstPort > 0) {
    ports.set(dstPort, (ports.get(dstPort) || 0) + 1);
  }

  // Track protocols
  protocols.set(protoName, (protocols.get(protoName) || 0) + 1);
}

console.log('=== Summary ===');
console.log('Total packets:', packetNum);
console.log('');

console.log('=== Protocols ===');
for (const [proto, count] of [...protocols.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${proto}: ${count} packets`);
}
console.log('');

console.log('=== Top Ports ===');
const sortedPorts = [...ports.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20);
for (const [port, count] of sortedPorts) {
  let service = '';
  if (port === 80) service = ' (HTTP)';
  else if (port === 443) service = ' (HTTPS)';
  else if (port === 5683) service = ' (CoAP)';
  else if (port === 5684) service = ' (CoAPs/DTLS)';
  else if (port === 8080) service = ' (HTTP-alt)';
  else if (port === 8443) service = ' (HTTPS-alt)';
  else if (port === 5222) service = ' (XMPP)';
  else if (port === 1883) service = ' (MQTT)';
  else if (port === 8883) service = ' (MQTT/TLS)';
  console.log(`  Port ${port}: ${count} packets${service}`);
}
console.log('');

console.log('=== Connections ===');
const sortedConns = [...connections.entries()].sort((a, b) => b[1].count - a[1].count);
for (const [conn, info] of sortedConns) {
  console.log(`\n${conn}`);
  console.log(`  Packets: ${info.count}, Bytes: ${info.bytes}`);

  if (info.payloads.length > 0) {
    console.log('  Sample payloads:');
    for (const p of info.payloads) {
      console.log(`    [${p.timestamp}]`);
      console.log(`    Hex: ${p.hex.slice(0, 80)}${p.hex.length > 80 ? '...' : ''}`);
      console.log(`    ASCII: ${p.ascii.slice(0, 80)}${p.ascii.length > 80 ? '...' : ''}`);
    }
  }
}
