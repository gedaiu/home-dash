import { getOrCreate, byDescending } from '../shared/collections.js';

const MAC_PREFIX_LENGTH = 8;
const BITS_PER_OCTET = 8;
const DECIMAL_RADIX = 10;
const UNKNOWN_COUNTRY = 'Unknown';

export function sortByIp(devices) {
  return [...devices].sort((left, right) => ipToNumber(left.ip) - ipToNumber(right.ip));
}

export function buildConnectionStats({ connections, devices, displayMode }) {
  const stats = { devices: new Map(), destinations: new Map(), countries: new Map() };

  for (const connection of connections) {
    if (connection.enriched && connection.srcMac) {
      recordConnection(stats, connection, { devices, displayMode });
    }
  }

  return stats;
}

export function sortedByBytes(recordsByKey) {
  return Array.from(recordsByKey.values()).sort(byDescending('bytes'));
}

export function devicesForCountry(stats, countryCode) {
  return Array.from(stats.devices.values())
    .filter(deviceRecord => deviceRecord.countries.has(countryCode))
    .map(deviceRecord => ({ ...deviceRecord, bytesToCountry: bytesFor(deviceRecord.countries, countryCode) }))
    .sort(byDescending('bytesToCountry'));
}

export function devicesForDestination(stats, destLabel) {
  const destination = stats.destinations.get(destLabel);
  if (!destination) return [];

  return Array.from(destination.devices)
    .map(mac => stats.devices.get(mac))
    .filter(Boolean)
    .map(deviceRecord => ({ ...deviceRecord, bytesToDest: bytesFor(deviceRecord.destinations, destLabel) }))
    .sort(byDescending('bytesToDest'));
}

export function buildRemoteDestinations(connections) {
  const destinationsByIp = new Map();

  for (const connection of connections.filter(entry => entry.enriched)) {
    addRemoteConnection(destinationsByIp, connection);
  }

  return Array.from(destinationsByIp.values()).sort(byDescending('bytes'));
}

function addRemoteConnection(destinationsByIp, connection) {
  const existing = destinationsByIp.get(connection.dst_ip);

  if (existing) {
    existing.bytes += connection.bytes || 0;
    existing.connectionCount++;

    return;
  }

  destinationsByIp.set(connection.dst_ip, newRemoteDestination(connection));
}

function newRemoteDestination(connection) {
  const { enriched } = connection;

  return {
    ipAddress: connection.dst_ip,
    hostname: enriched.hostname || null,
    country: enriched.country || null,
    org: enriched.org || enriched.asName || null,
    bytes: connection.bytes || 0,
    connectionCount: 1
  };
}

function bytesFor(recordsByKey, key) {
  return recordsByKey.get(key)?.bytes || 0;
}

export function resolveSelectedRecords({ selection, stats, devices }) {
  const { mac, country, destination } = selection;

  return {
    device: selectDeviceDetails({ mac, stats, devices }),
    countryRecord: country && !destination ? stats.countries.get(country) : null,
    destinationRecord: destination ? stats.destinations.get(destination) : null
  };
}

function selectDeviceDetails({ mac, stats, devices }) {
  if (!mac) return null;
  const trackedDevice = stats.devices.get(mac);
  if (trackedDevice) return trackedDevice;

  const knownDevice = devices.find(device => device.mac === mac);

  return knownDevice ? idleDeviceRecord(knownDevice) : null;
}

function ipToNumber(ipAddress) {
  if (!ipAddress) {
    return 0;
  }

  return ipAddress.split('.').reduce((accumulator, part) => (accumulator << BITS_PER_OCTET) + parseInt(part, DECIMAL_RADIX), 0) >>> 0;
}

function idleDeviceRecord(device) {
  return {
    mac: device.mac,
    hostname: device.hostname || device.mac.substring(0, MAC_PREFIX_LENGTH),
    ipAddress: device.ip,
    totalBytes: 0,
    connectionCount: 0,
    countries: new Map(),
    destinations: new Map()
  };
}

function recordConnection(stats, connection, context) {
  const flow = {
    connection,
    bytes: connection.bytes || 0,
    country: connection.enriched.country || UNKNOWN_COUNTRY,
    destLabel: destinationLabel(connection, context.displayMode)
  };

  recordDeviceTraffic(stats.devices, flow, context.devices);
  recordDestinationTraffic(stats.destinations, flow);
  recordCountryTraffic(stats.countries, flow);
}

function recordDeviceTraffic(devicesByMac, flow, knownDevices) {
  const { connection, bytes, country, destLabel } = flow;
  const deviceRecord = getOrCreate(devicesByMac, connection.srcMac, () => newDeviceRecord(connection, knownDevices));

  deviceRecord.totalBytes += bytes;
  deviceRecord.connectionCount++;
  widenSeenRange(deviceRecord, connection.lastSeen);
  getOrCreate(deviceRecord.countries, country, () => ({ code: country, bytes: 0 })).bytes += bytes;
  getOrCreate(deviceRecord.destinations, destLabel, () => newDeviceDestination(connection, destLabel, country)).bytes += bytes;
}

function recordDestinationTraffic(destinationsByLabel, flow) {
  const { connection, bytes, country, destLabel } = flow;
  const destRecord = getOrCreate(destinationsByLabel, destLabel, () => newGlobalDestination(connection, destLabel, country));

  destRecord.totalBytes += bytes;
  destRecord.connectionCount++;
  destRecord.devices.add(connection.srcMac);
  widenSeenRange(destRecord, connection.lastSeen);
}

function recordCountryTraffic(countriesByCode, flow) {
  const { connection, bytes, country, destLabel } = flow;
  const countryRecord = getOrCreate(countriesByCode, country, () => newCountryRecord(country));

  countryRecord.totalBytes += bytes;
  countryRecord.devices.add(connection.srcMac);
  countryRecord.destinations.add(destLabel);
}

function destinationLabel(connection, displayMode) {
  const { enriched } = connection;

  if (displayMode === 'ips') return connection.dst_ip;
  if (displayMode === 'hosts') return enriched.hostname || connection.dst_ip;

  return enriched.org || connection.dst_ip;
}

function widenSeenRange(record, lastSeen) {
  if (!lastSeen) return;
  if (lastSeen < record.firstSeen) record.firstSeen = lastSeen;
  if (lastSeen > record.lastSeen) record.lastSeen = lastSeen;
}

function newDeviceRecord(connection, devices) {
  const device = devices.find(candidate => candidate.mac === connection.srcMac);

  return {
    mac: connection.srcMac,
    hostname: deviceHostname(device, connection),
    ipAddress: device?.ip || connection.src_ip,
    totalBytes: 0,
    connectionCount: 0,
    firstSeen: connection.lastSeen || Date.now(),
    lastSeen: connection.lastSeen || Date.now(),
    countries: new Map(),
    destinations: new Map()
  };
}

function deviceHostname(device, connection) {
  return device?.hostname || connection.srcHostname || connection.srcMac.substring(0, MAC_PREFIX_LENGTH);
}

function newDeviceDestination(connection, destLabel, country) {
  return {
    label: destLabel,
    country,
    ipAddress: connection.dst_ip,
    hostname: connection.enriched.hostname,
    org: connection.enriched.org,
    bytes: 0
  };
}

function newGlobalDestination(connection, destLabel, country) {
  return {
    label: destLabel,
    country,
    ipAddress: connection.dst_ip,
    hostname: connection.enriched.hostname,
    org: connection.enriched.org,
    totalBytes: 0,
    connectionCount: 0,
    devices: new Set(),
    firstSeen: connection.lastSeen || Date.now(),
    lastSeen: connection.lastSeen || Date.now()
  };
}

function newCountryRecord(country) {
  return {
    code: country,
    totalBytes: 0,
    devices: new Set(),
    destinations: new Set()
  };
}
