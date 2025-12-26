const dgram = require('node:dgram');
const { Bonjour } = require('bonjour-service');
const { PhilipsCoapClient, PlainCoapClient, HttpClient } = require('../lib/philips-coap');
const storage = require('../services/storage');

const COAP_PORT = 5683;
const DISCOVERY_TIMEOUT = 15000;
const REQUEST_TIMEOUT = 5000;

async function discoverViaMdns(timeout = 10000) {
  return new Promise((resolve) => {
    const devices = new Map();
    const bonjour = new Bonjour();

    const serviceTypes = ['_air._tcp', '_philips._tcp', '_coap._udp'];

    for (const type of serviceTypes) {
      const browser = bonjour.find({ type });

      browser.on('up', (service) => {
        const name = service.name || service.host;
        if (name.toLowerCase().includes('philips') ||
            name.toLowerCase().includes('air') ||
            name.toLowerCase().includes('ac')) {
          const ip = service.addresses?.find(a => a.includes('.')) || service.referer?.address;
          if (ip && !devices.has(ip)) {
            devices.set(ip, {
              ip,
              name: service.name || ('Air Purifier (' + ip + ')'),
              host: service.host,
              port: service.port || COAP_PORT,
              source: 'mdns'
            });
          }
        }
      });
    }

    setTimeout(() => {
      bonjour.destroy();
      resolve(Array.from(devices.values()));
    }, timeout);
  });
}

async function discoverViaSsdp(timeout = 10000) {
  return new Promise((resolve) => {
    const devices = new Map();
    const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });

    socket.on('error', () => {
      socket.close();
      resolve(Array.from(devices.values()));
    });

    socket.on('message', (msg, rinfo) => {
      const response = msg.toString().toLowerCase();

      if (response.includes('philips') ||
          response.includes('air') ||
          response.includes('purifier') ||
          response.includes('diproduct')) {
        if (!devices.has(rinfo.address)) {
          devices.set(rinfo.address, {
            ip: rinfo.address,
            name: 'Air Purifier (' + rinfo.address + ')',
            source: 'ssdp'
          });
        }
      }
    });

    socket.bind(() => {
      socket.setBroadcast(true);

      const searches = [
        'urn:philips-com:device:DiProduct:1',
        'urn:schemas-upnp-org:device:Basic:1',
        'ssdp:all'
      ];

      searches.forEach((st, i) => {
        setTimeout(() => {
          const ssdpMessage = Buffer.from(
            'M-SEARCH * HTTP/1.1\r\n' +
            'HOST: 239.255.255.250:1900\r\n' +
            'MAN: "ssdp:discover"\r\n' +
            'MX: 3\r\n' +
            'ST: ' + st + '\r\n' +
            '\r\n'
          );
          socket.send(ssdpMessage, 0, ssdpMessage.length, 1900, '239.255.255.250');
        }, i * 500);
      });
    });

    setTimeout(() => {
      socket.close();
      resolve(Array.from(devices.values()));
    }, timeout);
  });
}

async function discoverViaCoapProbe(subnet, timeout = 8000) {
  const devices = new Map();
  const baseIp = subnet || '192.168.1';

  const probeIp = (ip) => {
    return new Promise((resolve) => {
      const socket = dgram.createSocket('udp4');
      const timer = setTimeout(() => {
        socket.close();
        resolve(null);
      }, 1000);

      socket.on('message', () => {
        clearTimeout(timer);
        socket.close();
        resolve({ ip });
      });

      socket.on('error', () => {
        clearTimeout(timer);
        socket.close();
        resolve(null);
      });

      // CoAP GET request for /sys/dev/info (common Philips endpoint)
      const coapGet = Buffer.from([
        0x40, 0x01, 0x00, 0x01,
        0xbb, 0x73, 0x79, 0x73,
        0x03, 0x64, 0x65, 0x76,
        0x04, 0x69, 0x6e, 0x66, 0x6f
      ]);

      socket.send(coapGet, 0, coapGet.length, COAP_PORT, ip);
    });
  };

  const promises = [];
  for (let i = 1; i <= 254; i++) {
    const ip = baseIp + '.' + i;
    promises.push(probeIp(ip));
  }

  const results = await Promise.all(promises);

  for (const result of results) {
    if (result && !devices.has(result.ip)) {
      devices.set(result.ip, {
        ip: result.ip,
        name: 'Air Purifier (' + result.ip + ')',
        source: 'coap-probe'
      });
    }
  }

  return Array.from(devices.values());
}

async function discoverDevices(timeout = DISCOVERY_TIMEOUT) {
  const storedIps = storage.getDiscoveredAirPurifierIps();

  const [mdnsDevices, ssdpDevices] = await Promise.all([
    discoverViaMdns(timeout - 2000),
    discoverViaSsdp(timeout - 2000)
  ]);

  const allDevices = new Map();

  for (const ip of storedIps) {
    allDevices.set(ip, {
      ip,
      name: 'Air Purifier (' + ip + ')',
      source: 'stored'
    });
  }

  for (const device of [...mdnsDevices, ...ssdpDevices]) {
    if (!allDevices.has(device.ip)) {
      allDevices.set(device.ip, device);
      storage.addDiscoveredAirPurifierIp(device.ip);
    }
  }

  return Array.from(allDevices.values());
}

async function testConnection(ip) {
  const protocols = [
    { name: 'coap', createClient: () => new PhilipsCoapClient(ip, REQUEST_TIMEOUT) },
    { name: 'plain-coap', createClient: () => new PlainCoapClient(ip, REQUEST_TIMEOUT) },
    { name: 'http', createClient: () => new HttpClient(ip, REQUEST_TIMEOUT) }
  ];

  for (const { name, createClient } of protocols) {
    try {
      const client = createClient();
      const status = await client.getStatus();

      return {
        success: true,
        protocol: name,
        status,
        model: status.modelid || status.name || null
      };
    } catch {
      // Try next protocol
    }
  }

  return { success: false };
}

function createConfig(ip, connectionResult) {
  if (!connectionResult.success) {
    return null;
  }

  const safeIp = ip.replace(/\./g, '-');

  return {
    id: 'purifier-' + safeIp,
    ip,
    protocol: connectionResult.protocol,
    name: connectionResult.status?.name || ('Air Purifier (' + ip + ')'),
    model: connectionResult.model
  };
}

async function discoverWithProbe(subnet) {
  const [regularDevices, probeDevices] = await Promise.all([
    discoverDevices(),
    discoverViaCoapProbe(subnet)
  ]);

  const allDevices = new Map();

  for (const device of regularDevices) {
    allDevices.set(device.ip, device);
  }

  for (const device of probeDevices) {
    if (!allDevices.has(device.ip)) {
      allDevices.set(device.ip, device);
      storage.addDiscoveredAirPurifierIp(device.ip);
    }
  }

  return Array.from(allDevices.values());
}

module.exports = {
  discoverDevices,
  discoverViaMdns,
  discoverViaSsdp,
  discoverViaCoapProbe,
  discoverWithProbe,
  testConnection,
  createConfig
};
