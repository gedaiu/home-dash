const { getConfig, getAllConfigs, getDeviceState } = require('./device-state');

const IP_FIELD = 'ip';

function getAllStatuses() {
  return getAllConfigs().map((deviceConfig, index) => getStatus(index));
}

function getStatus(index) {
  const config = getConfig(index);
  const state = getDeviceState(index);

  if (!config) {
    return { index, configured: false };
  }

  return {
    index,
    configured: true,
    connected: state.connected,
    observing: state.observing,
    lastUpdate: state.lastUpdate,
    device: {
      [IP_FIELD]: config.ip,
      name: config.name || state.status?.name,
      model: config.model || state.status?.model
    },
    ...state.status
  };
}

module.exports = { getStatus, getAllStatuses };
