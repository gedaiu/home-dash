const fs = require('node:fs');
const { storagePaths } = require('./paths');
const { load } = require('./config');

const DEBOUNCE_MS = 200;
const changeListeners = [];
const watchState = { watcher: null, lastMtime: 0, debounceTimer: null };

function onConfigChange(listener) {
  changeListeners.push(listener);
}

function stopWatching() {
  if (watchState.watcher) {
    watchState.watcher.close();
    watchState.watcher = null;
  }

  if (watchState.debounceTimer) {
    clearTimeout(watchState.debounceTimer);
    watchState.debounceTimer = null;
  }
}

function startWatching() {
  if (watchState.watcher || storagePaths.isTest || !fs.existsSync(storagePaths.configFile)) {
    return;
  }

  watchState.lastMtime = readConfigMtime();
  watchState.watcher = fs.watch(storagePaths.configFile, { persistent: false }, handleFileEvent);
  console.log('[storage] Watching config file for changes');
}

function readConfigMtime() {
  try {
    return fs.statSync(storagePaths.configFile).mtimeMs;
  } catch {
    return 0;
  }
}

function handleFileEvent(eventType) {
  if (eventType !== 'change') {
    return;
  }

  if (watchState.debounceTimer) {
    clearTimeout(watchState.debounceTimer);
  }

  watchState.debounceTimer = setTimeout(notifyIfModified, DEBOUNCE_MS);
}

function notifyIfModified() {
  try {
    const { mtimeMs } = fs.statSync(storagePaths.configFile);

    if (mtimeMs === watchState.lastMtime) {
      return;
    }

    watchState.lastMtime = mtimeMs;
    notifyConfigChange(load());
  } catch {
    // File might be temporarily unavailable
  }
}

function notifyConfigChange(config) {
  console.log('[storage] Config file changed, notifying listeners...');

  for (const listener of changeListeners) {
    try {
      listener(config);
    } catch (err) {
      console.error('[storage] Error in config change listener:', err.message);
    }
  }
}

module.exports = { onConfigChange, startWatching, stopWatching };
