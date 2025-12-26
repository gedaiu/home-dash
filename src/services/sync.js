const hueService = require('./hue');
const nanoleafService = require('./nanoleaf');
const storage = require('./storage');
const color = require('../lib/color');

const POLL_INTERVAL_SLOW_MS = 5000;
const POLL_INTERVAL_FAST_MS = 1000;
const FAST_POLL_DURATION_MS = 10000;

let state = {
  running: false,
  lastSync: null,
  lastError: null,
  currentColor: null,
  lastLightState: null,
  fastPollUntil: 0,
  pollTimer: null,
  nanoleafOff: false
};

let broadcastFn = null;

function setBroadcast(fn) {
  broadcastFn = fn;
}

function broadcast(type, data) {
  if (broadcastFn) {
    broadcastFn({ type, data });
  }
}

function log(message) {
  const timestamp = new Date().toLocaleTimeString();
  broadcast('log', { timestamp, message });
}

function getStatus() {
  return {
    running: state.running,
    lastSync: state.lastSync,
    lastError: state.lastError,
    currentColor: state.currentColor
  };
}

async function start() {
  if (state.running) {
    return { success: false, error: 'Already running' };
  }

  const config = storage.load();

  if (!config.hue?.ip || !config.hue?.username) {
    return { success: false, error: 'Hue Bridge not configured' };
  }

  if (!config.nanoleaf?.ip || !config.nanoleaf?.authToken) {
    return { success: false, error: 'Nanoleaf not configured' };
  }

  if (!config.sync?.hueDeviceId) {
    return { success: false, error: 'No light selected for sync' };
  }

  state.running = true;
  state.lastError = null;
  state.lastLightState = null;
  state.nanoleafOff = false;

  log(`Starting sync: ${config.sync.hueDeviceName} -> Nanoleaf`);
  broadcast('status', getStatus());

  await poll();
  schedulePoll();

  return { success: true };
}

function stop() {
  if (state.pollTimer) {
    clearTimeout(state.pollTimer);
    state.pollTimer = null;
  }

  state.running = false;
  log('Sync stopped');
  broadcast('status', getStatus());

  return { success: true };
}

function schedulePoll() {
  if (!state.running) {
    return;
  }

  const now = Date.now();
  const interval = now < state.fastPollUntil ? POLL_INTERVAL_FAST_MS : POLL_INTERVAL_SLOW_MS;

  state.pollTimer = setTimeout(async () => {
    await poll();
    schedulePoll();
  }, interval);
}

async function poll() {
  if (!state.running) {
    return;
  }

  const config = storage.load();

  try {
    const light = await hueService.getLight(config.sync.hueDeviceId);

    if (!light) {
      const hueConfig = config.hue;
      if (!hueConfig?.ip || !hueConfig?.username) {
        throw new Error('Hue Bridge not configured');
      }

      if (!state.nanoleafOff) {
        log('Hue light unreachable -> Nanoleaf OFF');
        await nanoleafService.setOn(false);
        state.nanoleafOff = true;
        state.currentColor = { r: 0, g: 0, b: 0 };
        state.lastLightState = null;
        storage.logLightChange(config.sync.hueDeviceName, { r: 0, g: 0, b: 0 }, 'unreachable', { on: false, bri: 0 });
        broadcast('status', getStatus());
      }
      return;
    }

    const lightState = light.state;

    if (!lightState.on || !lightState.reachable) {
      if (!state.nanoleafOff) {
        const reason = !lightState.reachable ? 'unreachable' : 'off';
        log(`Hue light ${reason} -> Nanoleaf OFF`);
        await nanoleafService.setOn(false);
        state.nanoleafOff = true;
        state.currentColor = { r: 0, g: 0, b: 0 };
        state.lastLightState = { ...lightState };
        state.fastPollUntil = Date.now() + FAST_POLL_DURATION_MS;
        storage.logLightChange(config.sync.hueDeviceName, { r: 0, g: 0, b: 0 }, reason, lightState);
        broadcast('status', getStatus());
      }
      return;
    }

    state.nanoleafOff = false;

    if (color.stateChanged(state.lastLightState, lightState)) {
      const rgb = color.getLightRgb(lightState);
      const hsl = color.rgbToHsl(rgb.r, rgb.g, rgb.b);
      const isWhite = color.isCloseToWhite(lightState);
      const useAnimation = !isWhite;

      const nanoleafConfig = config.nanoleaf || {};
      const bri = color.mapBrightness(
        lightState.bri,
        nanoleafConfig.minBrightness,
        nanoleafConfig.maxBrightness
      );

      const hue = Math.round(hsl.h);
      const sat = Math.round(hsl.s);

      await nanoleafService.setOn(true);

      if (useAnimation) {
        await nanoleafService.createOrUpdateEffect(hue, sat, bri);
        await nanoleafService.selectEffect('HueSync');
        log(`RGB(${rgb.r}, ${rgb.g}, ${rgb.b}) with animation`);
        storage.logLightChange(config.sync.hueDeviceName, rgb, 'animation', lightState);
      } else {
        await nanoleafService.setColor(hue, sat, bri);
        log(`RGB(${rgb.r}, ${rgb.g}, ${rgb.b}) static`);
        storage.logLightChange(config.sync.hueDeviceName, rgb, 'static', lightState);
      }

      state.currentColor = rgb;
      state.lastLightState = { ...lightState };
      state.lastSync = new Date().toISOString();
      state.fastPollUntil = Date.now() + FAST_POLL_DURATION_MS;

      broadcast('status', getStatus());
    }
  } catch (err) {
    state.lastError = err.message;
    log(`Error: ${err.message}`);
    broadcast('status', getStatus());
  }
}

function getConfig() {
  return storage.getSync();
}

function setConfig(syncConfig) {
  storage.setSync(syncConfig);
  broadcast('config', syncConfig);
}

module.exports = {
  start,
  stop,
  getStatus,
  getConfig,
  setConfig,
  setBroadcast,
  // Export constants for testing
  POLL_INTERVAL_SLOW_MS,
  POLL_INTERVAL_FAST_MS,
  FAST_POLL_DURATION_MS
};
