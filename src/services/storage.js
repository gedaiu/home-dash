module.exports = {
  ...require('./storage/config'),
  ...require('./storage/air-purifiers'),
  ...require('./storage/state-files'),
  ...require('./storage/sensors'),
  ...require('./storage/history-codec'),
  ...require('./storage/light-log'),
  ...require('./storage/watcher')
};
