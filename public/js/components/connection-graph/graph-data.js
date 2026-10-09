import { getOrCreate, byDescending } from '../shared/collections.js';

const MAC_PREFIX_LENGTH = 8;
const MAX_DEVICES_PER_RING = 8;
const IPV4_PART_COUNT = 4;
const SUBNET_PART_COUNT = 3;
const UNKNOWN_COUNTRY = 'Unknown';
const UNKNOWN_SUBNET = 'unknown';

export function buildConnectionData({ connections, devices, displayMode = 'orgs', showIdleDevices = true }) {
  const stats = {
    devices: new Map(devices.map(device => [device.mac, knownDeviceRecord(device)])),
    destinations: new Map(),
    countries: new Map()
  };

  connections
    .filter(connection => connection.srcMac && connection.enriched)
    .forEach(connection => recordConnection(stats, connection, displayMode));

  const deviceList = finalizeDevices(stats.devices, showIdleDevices);

  return {
    devices: deviceList,
    destinations: Array.from(stats.destinations.values()).sort(byDescending('totalBytes')),
    countries: Array.from(stats.countries.values()).sort(byDescending('totalBytes')),
    subnets: buildSubnetRings(deviceList)
  };
}

function finalizeDevices(devicesByMac, showIdleDevices) {
  return Array.from(devicesByMac.values())
    .map(record => ({
      ...record,
      destinations: Array.from(record.destinations.values()).sort(byDescending('bytes')),
      countries: Array.from(record.countries.values()).sort(byDescending('bytes'))
    }))
    .filter(record => showIdleDevices || record.connectionCount > 0)
    .sort(byDescending('totalBytes'));
}

function knownDeviceRecord(device) {
  return newDeviceRecord({
    mac: device.mac,
    hostname: device.hostname || device.mac.substring(0, MAC_PREFIX_LENGTH),
    ipAddress: device.ip,
    online: device.online
  });
}

function newDeviceRecord({ mac, hostname, ipAddress, online }) {
  return {
    mac,
    hostname,
    ipAddress,
    subnet: getSubnet(ipAddress),
    isGateway: isGatewayAddress(ipAddress),
    online,
    totalBytes: 0,
    connectionCount: 0,
    destinations: new Map(),
    countries: new Map()
  };
}

function getSubnet(ipAddress) {
  if (!ipAddress) return null;
  const parts = ipAddress.split('.');
  if (parts.length !== IPV4_PART_COUNT) return null;

  return parts.slice(0, SUBNET_PART_COUNT).join('.');
}

function isGatewayAddress(ipAddress) {
  if (!ipAddress) return false;

  return ipAddress.endsWith('.1');
}

function recordConnection(stats, connection, displayMode) {
  const device = getOrCreate(stats.devices, connection.srcMac, () => discoveredDeviceRecord(connection));
  const flow = describeFlow(connection, displayMode);

  recordDeviceFlow(device, flow);
  recordDestinationFlow(stats.destinations, flow);
  recordCountryFlow(stats.countries, flow);
}

function discoveredDeviceRecord(connection) {
  return newDeviceRecord({
    mac: connection.srcMac,
    hostname: connection.srcHostname || connection.srcMac.substring(0, MAC_PREFIX_LENGTH),
    ipAddress: connection.src_ip,
    online: true
  });
}

function describeFlow(connection, displayMode) {
  const { enriched } = connection;
  const org = enriched.org || enriched.asName || enriched.isp;

  return {
    mac: connection.srcMac,
    bytes: connection.bytes || 0,
    country: enriched.country || UNKNOWN_COUNTRY,
    org,
    ipAddress: connection.dst_ip,
    hostname: enriched.hostname,
    label: destinationLabel({ displayMode, org, ipAddress: connection.dst_ip, hostname: enriched.hostname })
  };
}

function destinationLabel({ displayMode, org, ipAddress, hostname }) {
  if (displayMode === 'ips') return ipAddress;
  if (displayMode === 'hosts') return hostname || ipAddress;

  return org || ipAddress;
}

function recordDeviceFlow(device, flow) {
  device.totalBytes += flow.bytes;
  device.connectionCount += 1;

  const deviceCountry = getOrCreate(device.countries, flow.country, () => ({ code: flow.country, bytes: 0, count: 0 }));
  deviceCountry.bytes += flow.bytes;
  deviceCountry.count += 1;

  const deviceDestination = getOrCreate(device.destinations, flow.label, () => ({
    label: flow.label,
    country: flow.country,
    org: flow.org,
    ipAddress: flow.ipAddress,
    hostname: flow.hostname,
    bytes: 0,
    count: 0
  }));
  deviceDestination.bytes += flow.bytes;
  deviceDestination.count += 1;
}

function recordDestinationFlow(destinationsByLabel, flow) {
  const destination = getOrCreate(destinationsByLabel, flow.label, () => ({
    label: flow.label,
    country: flow.country,
    org: flow.org,
    ipAddress: flow.ipAddress,
    hostname: flow.hostname,
    totalBytes: 0,
    devices: new Set()
  }));

  destination.totalBytes += flow.bytes;
  destination.devices.add(flow.mac);
}

function recordCountryFlow(countriesByCode, flow) {
  const country = getOrCreate(countriesByCode, flow.country, () => ({
    code: flow.country,
    totalBytes: 0,
    devices: new Set(),
    destinations: new Set()
  }));

  country.totalBytes += flow.bytes;
  country.devices.add(flow.mac);
  country.destinations.add(flow.label);
}

function buildSubnetRings(deviceList) {
  return groupBySubnet(deviceList)
    .map(([subnet, devices]) => ({
      subnet,
      devices,
      totalBytes: sumTotalBytes(devices),
      hasGateway: devices.some(device => device.isGateway)
    }))
    .sort((left, right) => right.devices.length - left.devices.length)
    .flatMap(splitIntoRings);
}

function groupBySubnet(deviceList) {
  const devicesBySubnet = new Map();

  deviceList.forEach(device => {
    getOrCreate(devicesBySubnet, device.subnet || UNKNOWN_SUBNET, () => []).push(device);
  });

  return Array.from(devicesBySubnet.entries());
}

function sumTotalBytes(devices) {
  return devices.reduce((sum, device) => sum + device.totalBytes, 0);
}

function splitIntoRings(subnetData) {
  const gatewayDevices = subnetData.devices.filter(device => device.isGateway);
  const regularDevices = subnetData.devices.filter(device => !device.isGateway);

  if (regularDevices.length <= MAX_DEVICES_PER_RING) {
    return [{
      subnet: subnetData.subnet,
      devices: subnetData.devices,
      totalBytes: subnetData.totalBytes,
      hasGateway: subnetData.hasGateway,
      isFirstRingOfSubnet: true,
      isLastRingOfSubnet: true
    }];
  }

  const ringCount = Math.ceil(regularDevices.length / MAX_DEVICES_PER_RING);

  return [...Array(ringCount).keys()].map(ringIndex =>
    splitRing({ subnet: subnetData.subnet, regularDevices, gatewayDevices, ringIndex, ringCount })
  );
}

function splitRing({ subnet, regularDevices, gatewayDevices, ringIndex, ringCount }) {
  const startIndex = ringIndex * MAX_DEVICES_PER_RING;
  const endIndex = Math.min(startIndex + MAX_DEVICES_PER_RING, regularDevices.length);
  const isLastRing = ringIndex === ringCount - 1;
  const ringDevices = regularDevices.slice(startIndex, endIndex);

  if (isLastRing) {
    ringDevices.push(...gatewayDevices);
  }

  return {
    subnet,
    devices: ringDevices,
    totalBytes: sumTotalBytes(ringDevices),
    hasGateway: isLastRing && gatewayDevices.length > 0,
    isFirstRingOfSubnet: ringIndex === 0,
    isLastRingOfSubnet: isLastRing
  };
}
