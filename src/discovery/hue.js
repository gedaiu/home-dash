const UPNP_TIMEOUT_MS = 5000;

const { discovery } = require('node-hue-api');

async function discoverBridge() {
  let bridges = await discovery.nupnpSearch();

  if (bridges.length === 0) {
    bridges = await discovery.upnpSearch(UPNP_TIMEOUT_MS);
  }

  if (bridges.length === 0) {
    return null;
  }

  return bridges[0].ipaddress;
}

module.exports = {
  discoverBridge
};
