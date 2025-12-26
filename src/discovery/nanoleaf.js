const Bonjour = require('bonjour-service').default;

const DEFAULT_PORT = 16021;

async function discoverDevices(timeout = 10000) {
  return new Promise((resolve) => {
    const bonjour = new Bonjour();
    const foundDevices = [];

    const browser = bonjour.find({ type: 'nanoleafapi' });

    browser.on('up', (service) => {
      const ip = service.addresses?.find((addr) => !addr.includes(':')) || service.host;
      const port = service.port || DEFAULT_PORT;

      foundDevices.push({ name: service.name, ip, port });
    });

    setTimeout(() => {
      browser.stop();
      bonjour.destroy();
      resolve(foundDevices);
    }, timeout);
  });
}

module.exports = {
  discoverDevices,
  DEFAULT_PORT
};
