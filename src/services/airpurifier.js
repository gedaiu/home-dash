const { PhilipsCoapClient, PlainCoapClient, HttpClient } = require('../lib/philips-coap');
const discovery = require('../discovery/airpurifier');
const storage = require('./storage');

const REQUEST_TIMEOUT = 15000;

let broadcastFn = null;
let pollTimer = null;
const POLL_INTERVAL_MS = 10000;

const purifierClients = new Map();

function getAirQualityLevel(pm25) {
  if (pm25 <= 12) {
    return { level: 'good', color: '#00ff88' };
  }
  if (pm25 <= 35) {
    return { level: 'moderate', color: '#ffcc00' };
  }
  if (pm25 <= 55) {
    return { level: 'unhealthy-sensitive', color: '#ff9900' };
  }
  if (pm25 <= 150) {
    return { level: 'unhealthy', color: '#ff3333' };
  }
  if (pm25 <= 250) {
    return { level: 'very-unhealthy', color: '#cc00cc' };
  }
  return { level: 'hazardous', color: '#990000' };
}

async function discover() {
  return discovery.discoverDevices();
}

async function discoverDeep(subnet) {
  return discovery.discoverWithProbe(subnet);
}

function getClient(config) {
  const key = config.ip + '-' + config.protocol;

  if (purifierClients.has(key)) {
    return purifierClients.get(key);
  }

  let client;
  switch (config.protocol) {
    case 'coap':
      client = new PhilipsCoapClient(config.ip, REQUEST_TIMEOUT);
      break;
    case 'plain-coap':
      client = new PlainCoapClient(config.ip, REQUEST_TIMEOUT);
      break;
    default:
      client = new HttpClient(config.ip, REQUEST_TIMEOUT);
  }

  purifierClients.set(key, client);
  return client;
}

async function testCoapSyncOnly(ip, verbose = false) {
  // Test if the device responds to CoAP sync but not status
  // This indicates a cloud-only device
  try {
    const client = new PhilipsCoapClient(ip, REQUEST_TIMEOUT, verbose);
    const synced = await client.sync();

    if (synced) {
      if (verbose) {
        console.log('[airpurifier] CoAP sync succeeded, counter:', client.counter);
      }
      return { syncWorks: true, counter: client.counter };
    }
    return { syncWorks: false };
  } catch {
    return { syncWorks: false };
  }
}

async function testConnectionWithProtocol(ip, protocol, verbose = false) {
  try {
    let client;
    if (verbose) {
      console.log('[airpurifier] Trying protocol:', protocol);
    }
    switch (protocol) {
      case 'coap':
        client = new PhilipsCoapClient(ip, REQUEST_TIMEOUT, verbose);
        break;
      case 'plain-coap':
        client = new PlainCoapClient(ip, REQUEST_TIMEOUT, verbose);
        break;
      default:
        client = new HttpClient(ip, REQUEST_TIMEOUT, verbose);
    }

    const status = await client.getStatus();
    if (verbose) {
      console.log('[airpurifier] Protocol', protocol, 'succeeded');
    }
    return { success: true, status, protocol };
  } catch (err) {
    if (verbose) {
      console.log('[airpurifier] Protocol', protocol, 'failed:', err.message);
    }
    return { success: false, error: err.message };
  }
}

async function testConnection(ip, verbose = false) {
  const protocols = ['coap', 'plain-coap', 'http'];

  for (const protocol of protocols) {
    if (verbose) {
      console.log('[airpurifier] Trying protocol:', protocol);
    }
    const result = await testConnectionWithProtocol(ip, protocol, verbose);
    if (result.success) {
      return result;
    }
  }

  return { success: false };
}

async function testConnectionVerbose(ip) {
  console.log('[airpurifier] Testing connection to', ip, 'with verbose logging');
  return testConnection(ip, true);
}

async function probeDevice(ip, verbose = true) {
  console.log('[airpurifier] Probing device at', ip);
  const result = await testConnection(ip, verbose);

  if (!result.success) {
    // Check if device responds to CoAP sync but not status (cloud-only device)
    if (verbose) {
      console.log('[airpurifier] All protocols failed, checking for cloud-only device...');
    }

    const syncResult = await testCoapSyncOnly(ip, verbose);
    if (syncResult.syncWorks) {
      console.log('[airpurifier] Device responds to CoAP sync but not status requests');
      console.log('[airpurifier] This device likely requires cloud control (MQTT)');
      return {
        ip,
        protocol: 'cloud-only',
        name: 'Air Purifier (' + ip + ')',
        modelId: null,
        pm25: null,
        firmware: null,
        power: null,
        cloudOnly: true,
        rawStatus: null
      };
    }

    console.log('[airpurifier] All protocols failed for', ip);
    return null;
  }

  const status = result.status || {};
  const name = status.name || status.DeviceName || status.type || null;
  const modelId = status.modelid || status.type || status.ProductId || null;
  const pm25 = status.pm25 ?? status.pm2_5 ?? null;
  const firmware = status.swversion || status.WifiVersion || null;

  return {
    ip,
    protocol: result.protocol,
    name: name || 'Air Purifier (' + ip + ')',
    modelId,
    pm25,
    firmware,
    power: status.pwr === '1' || status.pwr === 1 || status.power === 'on',
    rawStatus: status
  };
}

async function pair(ip) {
  const deviceInfo = await probeDevice(ip);

  if (!deviceInfo) {
    return {
      success: false,
      error: 'Could not connect using any protocol (CoAP encrypted, CoAP plain, HTTP).'
    };
  }

  const safeIp = ip.replace(/\./g, '-');
  const config = {
    id: 'purifier-' + safeIp,
    ip,
    protocol: deviceInfo.protocol,
    name: deviceInfo.name,
    model: deviceInfo.modelId
  };

  storage.addAirPurifier(config);

  return {
    success: true,
    config,
    status: deviceInfo.rawStatus,
    deviceInfo
  };
}

async function getStatus(purifierId) {
  const config = storage.getAirPurifier(purifierId);
  if (!config) {
    return null;
  }

  try {
    const client = getClient(config);
    const status = await client.getStatus();

    const pm25 = status.pm25 ?? status.pm2_5 ?? null;
    const airQuality = pm25 !== null ? getAirQualityLevel(pm25) : null;

    return {
      id: config.id,
      name: config.name,
      ip: config.ip,
      protocol: config.protocol,
      model: config.model,
      power: status.pwr === '1' || status.pwr === 1 || status.power === 'on',
      mode: status.mode || status.om || 'auto',
      fanSpeed: status.om || status.fan_speed || null,
      pm25,
      airQuality,
      humidity: status.rh ?? status.humidity ?? null,
      temperature: status.temp ?? status.temperature ?? null,
      allergenIndex: status.iaql ?? null,
      filterLife: {
        preFilter: status.fltsts0 ?? null,
        hepaFilter: status.fltsts1 ?? null,
        carbonFilter: status.fltsts2 ?? null
      },
      childLock: status.cl === true || status.cl === '1',
      light: status.aqil ?? status.uil ?? null,
      rawStatus: status
    };
  } catch (err) {
    return {
      id: config.id,
      name: config.name,
      ip: config.ip,
      protocol: config.protocol,
      model: config.model,
      error: err.message,
      offline: true
    };
  }
}

async function getAllStatuses() {
  const configs = storage.getAirPurifiers();
  const statuses = await Promise.all(
    configs.map(config => getStatus(config.id))
  );
  return statuses.filter(Boolean);
}

async function setValues(purifierId, values) {
  const config = storage.getAirPurifier(purifierId);
  if (!config) {
    throw new Error('Purifier not configured');
  }

  const client = getClient(config);
  await client.setValues(values);
}

async function setPower(purifierId, on) {
  await setValues(purifierId, { pwr: on ? '1' : '0' });
}

async function setMode(purifierId, mode) {
  await setValues(purifierId, { mode });
}

async function setFanSpeed(purifierId, speed) {
  await setValues(purifierId, { om: speed });
}

function remove(purifierId) {
  storage.removeAirPurifier(purifierId);
  for (const [key] of purifierClients) {
    if (key.startsWith(purifierId)) {
      purifierClients.delete(key);
    }
  }
}

function updateName(purifierId, name) {
  storage.updateAirPurifier(purifierId, { name });
}

function setBroadcast(fn) {
  broadcastFn = fn;
}

function broadcast(type, data) {
  if (broadcastFn) {
    broadcastFn({ type, data });
  }
}

async function pollPurifiers() {
  try {
    const statuses = await getAllStatuses();
    if (statuses.length > 0) {
      broadcast('airpurifiers', statuses);
    }
  } catch {
    // Ignore polling errors
  }
}

function startPolling() {
  if (pollTimer) {
    return;
  }

  pollTimer = setInterval(pollPurifiers, POLL_INTERVAL_MS);
  pollPurifiers();
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

module.exports = {
  discover,
  discoverDeep,
  pair,
  probeDevice,
  testConnection,
  testConnectionVerbose,
  getStatus,
  getAllStatuses,
  setValues,
  setPower,
  setMode,
  setFanSpeed,
  remove,
  updateName,
  getAirQualityLevel,
  setBroadcast,
  startPolling,
  stopPolling
};
