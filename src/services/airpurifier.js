const { HttpClient, PlainCoapClient, CoapClient } = require('philips-air');
const dgram = require('node:dgram');
const storage = require('./storage');

const DISCOVERY_TIMEOUT = 10000;
const REQUEST_TIMEOUT = 5000;

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
  return new Promise((resolve) => {
    const devices = [];
    const seen = new Set();

    const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });

    socket.on('error', () => {
      socket.close();
      resolve(devices);
    });

    socket.on('message', (msg, rinfo) => {
      const response = msg.toString();

      if (response.includes('philips') || response.includes('Air') || response.includes('Purifier')) {
        if (!seen.has(rinfo.address)) {
          seen.add(rinfo.address);
          devices.push({
            ip: rinfo.address,
            name: `Air Purifier (${rinfo.address})`
          });
        }
      }
    });

    socket.bind(() => {
      socket.setBroadcast(true);

      const ssdpMessage = Buffer.from(
        'M-SEARCH * HTTP/1.1\r\n' +
        'HOST: 239.255.255.250:1900\r\n' +
        'MAN: "ssdp:discover"\r\n' +
        'MX: 3\r\n' +
        'ST: urn:philips-com:device:DiProduct:1\r\n' +
        '\r\n'
      );

      socket.send(ssdpMessage, 0, ssdpMessage.length, 1900, '239.255.255.250');

      setTimeout(() => {
        const ssdpAll = Buffer.from(
          'M-SEARCH * HTTP/1.1\r\n' +
          'HOST: 239.255.255.250:1900\r\n' +
          'MAN: "ssdp:discover"\r\n' +
          'MX: 3\r\n' +
          'ST: ssdp:all\r\n' +
          '\r\n'
        );
        socket.send(ssdpAll, 0, ssdpAll.length, 1900, '239.255.255.250');
      }, 1000);
    });

    setTimeout(() => {
      socket.close();
      resolve(devices);
    }, DISCOVERY_TIMEOUT);
  });
}

function getClient(config) {
  const key = `${config.ip}-${config.protocol}`;

  if (purifierClients.has(key)) {
    return purifierClients.get(key);
  }

  let client;
  switch (config.protocol) {
    case 'coap':
      client = new CoapClient(config.ip, REQUEST_TIMEOUT);
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

async function testConnection(ip, protocol = 'http') {
  const config = { ip, protocol };

  try {
    const client = getClient(config);
    const status = await client.getStatus();
    return { success: true, status };
  } catch {
    return { success: false };
  }
}

async function pair(ip) {
  const protocols = ['http', 'plain-coap', 'coap'];

  for (const protocol of protocols) {
    const result = await testConnection(ip, protocol);

    if (result.success) {
      const id = `purifier-${ip.replace(/\./g, '-')}`;
      const purifierConfig = {
        id,
        ip,
        protocol,
        name: result.status?.name || `Air Purifier (${ip})`
      };

      storage.addAirPurifier(purifierConfig);

      return {
        success: true,
        config: purifierConfig,
        status: result.status
      };
    }
  }

  return {
    success: false,
    error: 'Could not connect using any protocol. Make sure the purifier is on the same network.'
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
  pair,
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
