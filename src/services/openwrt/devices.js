const { state, deviceMap, broadcast } = require('./state');

function handleDeviceMessage(reported) {
  asArray(reported).forEach(upsertDevice);

  state.devices = Array.from(deviceMap.values());

  broadcast({
    type: 'openwrt:devices',
    data: state.devices
  });
}

function upsertDevice(device) {
  const existing = deviceMap.get(device.mac);

  if (existing) {
    Object.assign(existing, device);
    existing.lastSeen = Date.now();

    return;
  }

  deviceMap.set(device.mac, {
    ...device,
    firstSeen: Date.now(),
    lastSeen: Date.now()
  });
}

function handleTrafficMessage(trafficReports) {
  if (Array.isArray(trafficReports)) {
    trafficReports.forEach(applyTraffic);
  }

  broadcast({
    type: 'openwrt:traffic',
    data: trafficReports
  });
}

function applyTraffic(traffic) {
  const device = deviceMap.get(traffic.mac);

  if (!device) {
    return;
  }

  device.traffic = {
    'rx': traffic.rx || 0,
    'tx': traffic.tx || 0,
    lastUpdate: Date.now()
  };
}

function asArray(value) {
  return Array.isArray(value) ? value : [value];
}

module.exports = { handleDeviceMessage, handleTrafficMessage, asArray };
