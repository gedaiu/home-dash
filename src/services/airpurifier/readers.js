const { isConfigured, getConfig, getAllConfigs } = require('./device-state');
const { setBroadcast } = require('./logging');
const { getAllPm25Sensors } = require('./history');
const { getStatus, getAllStatuses } = require('./status');

module.exports = {
  isConfigured,
  getConfig,
  getAllConfigs,
  setBroadcast,
  getAllPm25Sensors,
  getStatus,
  getAllStatuses
};
