const { discovery } = require('node-hue-api');

async function discoverBridge() {
  let bridges = await discovery.nupnpSearch();

  if (bridges.length === 0) {
    bridges = await discovery.upnpSearch(5000);
  }

  if (bridges.length === 0) {
    return null;
  }

  return bridges[0].ipaddress;
}

module.exports = {
  discoverBridge
};
