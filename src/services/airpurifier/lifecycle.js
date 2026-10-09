const { connect, disconnect } = require('./session');
const { getDeviceInfo, configure, remove } = require('./registry');
const { startPolling, stopPolling, startAllPolling, stopAllPolling } = require('./polling');

module.exports = {
  connect,
  disconnect,
  getDeviceInfo,
  configure,
  remove,
  startPolling,
  stopPolling,
  startAllPolling,
  stopAllPolling
};
