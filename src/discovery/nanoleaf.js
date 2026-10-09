const bonjourService = require('bonjour-service');

const DEFAULT_PORT = 16021;
const DEFAULT_TIMEOUT_MS = 10000;

async function discoverDevices(timeout = DEFAULT_TIMEOUT_MS) {
  return new Promise((resolve) => {
    const bonjour = new bonjourService.default();
    const foundDevices = [];

    const browser = bonjour.find({ type: 'nanoleafapi' });

    browser.on('up', (service) => {
      const address = service.addresses?.find((addr) => !addr.includes(':')) || service.host;
      const port = service.port || DEFAULT_PORT;

      foundDevices.push({ name: service.name, 'ip': address, port });
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
