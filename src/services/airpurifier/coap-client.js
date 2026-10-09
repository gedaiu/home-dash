const { CoapClient: coap } = require('node-coap-client');

const COAP_PORT = 5683;

function buildCoapUrl(host) {
  return `coap://${host}:${COAP_PORT}`;
}

function confirmableOptions() {
  return { keepAlive: true, confirmable: true, retransmit: true };
}

async function requestDeviceInfo(baseUrl) {
  const response = await coap.request(`${baseUrl}/sys/dev/info`, 'get', null, confirmableOptions());

  if (!response.payload) {
    return null;
  }

  return JSON.parse(response.payload.toString());
}

module.exports = { coap, buildCoapUrl, confirmableOptions, requestDeviceInfo };
