const { isConfigured } = require('./roomba/config');
const { setBroadcast } = require('./roomba/ui-log');
const { getStatus, getCachedStatus } = require('./roomba/status');
const { start, stop, pause, resume, dock } = require('./roomba/commands');
const { startPolling, stopPolling } = require('./roomba/polling');
const parsers = require('./roomba/parsers');

module.exports = {
  isConfigured,
  getStatus,
  getCachedStatus,
  start,
  stop,
  pause,
  resume,
  dock,
  setBroadcast,
  startPolling,
  stopPolling,
  parseMission: parsers.parseMission,
  parseBattery: parsers.parseBattery,
  parseBin: parsers.parseBin,
  parseLifetimeStats: parsers.parseLifetimeStats,
  parseSettings: parsers.parseSettings,
  parseLastCommand: parsers.parseLastCommand,
  parseDeviceInfo: parsers.parseDeviceInfo
};
