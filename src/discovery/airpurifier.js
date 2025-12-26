const dgram = require('node:dgram');
const { HttpClient, PlainCoapClient, CoapClient } = require('philips-air');

async function discoverDevices(timeout = 10000) {
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
    }, timeout);
  });
}

async function testConnection(ip) {
  const protocols = ['http', 'plain-coap', 'coap'];

  for (const protocol of protocols) {
    try {
      let client;
      switch (protocol) {
        case 'coap':
          client = new CoapClient(ip, 5000);
          break;
        case 'plain-coap':
          client = new PlainCoapClient(ip, 5000);
          break;
        default:
          client = new HttpClient(ip, 5000);
      }

      const status = await client.getStatus();
      return { success: true, protocol, status };
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

  return {
    id: `purifier-${ip.replace(/\./g, '-')}`,
    ip,
    protocol: connectionResult.protocol,
    name: connectionResult.status?.name || `Air Purifier (${ip})`
  };
}

module.exports = {
  discoverDevices,
  testConnection,
  createConfig
};
