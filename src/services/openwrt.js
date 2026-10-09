const { setBroadcast, getState, getRouters, getDevices, getConnections } = require('./openwrt/state');
const { handleAgentConnection } = require('./openwrt/agent');
const { getGraphData } = require('./openwrt/graph');
const { refreshConnectionEnrichment } = require('./openwrt/connections');

module.exports = {
  setBroadcast,
  handleAgentConnection,
  getState,
  getRouters,
  getDevices,
  getConnections,
  getGraphData,
  refreshConnectionEnrichment
};
