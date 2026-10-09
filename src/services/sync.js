const hueService = require('./hue');
const nanoleafService = require('./nanoleaf');
const storage = require('./storage');
const color = require('../lib/color');

const POLL_INTERVAL_SLOW_MS = 5000;
const POLL_INTERVAL_FAST_MS = 1000;
const FAST_POLL_DURATION_MS = 10000;
const RGB_CHANNELS = ['r', 'g', 'b'];
const PRESENTATIONS = {
  animation: { label: 'with animation', present: presentAnimation },
  static: { label: 'static', present: presentStaticColor }
};

const state = {
  running: false,
  lastSync: null,
  lastError: null,
  currentColor: null,
  lastLightState: null,
  fastPollUntil: 0,
  pollTimer: null,
  nanoleafOff: false
};

let broadcastHandler = null;

async function start() {
  if (state.running) {
    return failure('Already running');
  }

  const config = storage.load();
  const configError = findConfigError(config);

  if (configError) {
    return failure(configError);
  }

  state.running = true;
  state.lastError = null;
  state.lastLightState = null;
  state.nanoleafOff = false;

  log(`Starting sync: ${config.sync.hueDeviceName} -> Nanoleaf`);
  broadcast(getStatus());

  await poll();
  schedulePoll();

  return { success: true };
}

function findConfigError(config) {
  if (!hasHueCredentials(config.hue)) {
    return 'Hue Bridge not configured';
  }

  if (!hasNanoleafCredentials(config.nanoleaf)) {
    return 'Nanoleaf not configured';
  }

  return config.sync?.hueDeviceId ? null : 'No light selected for sync';
}

function failure(error) {
  return { success: false, error };
}

function stop() {
  if (state.pollTimer) {
    clearTimeout(state.pollTimer);
    state.pollTimer = null;
  }

  state.running = false;
  log('Sync stopped');
  broadcast(getStatus());

  return { success: true };
}

function schedulePoll() {
  if (!state.running) {
    return;
  }

  const interval = Date.now() < state.fastPollUntil ? POLL_INTERVAL_FAST_MS : POLL_INTERVAL_SLOW_MS;

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
    await syncLight(config);
  } catch (err) {
    state.lastError = err.message;
    log(`Error: ${err.message}`);
    broadcast(getStatus());
  }
}

async function syncLight(config) {
  const light = await hueService.getLight(config.sync.hueDeviceId);

  if (!light) {
    await handleMissingLight(config);

    return;
  }

  const lightState = light.state;

  if (!lightState.on || !lightState.reachable) {
    await handleLightOff(config, lightState);

    return;
  }

  state.nanoleafOff = false;

  if (color.stateChanged(state.lastLightState, lightState)) {
    await applyLightColor(config, lightState);
  }
}

async function handleMissingLight(config) {
  if (!hasHueCredentials(config.hue)) {
    throw new Error('Hue Bridge not configured');
  }

  if (state.nanoleafOff) {
    return;
  }

  await turnNanoleafOff('unreachable');
  state.lastLightState = null;
  storage.logLightChange(config.sync.hueDeviceName, blackColor(), 'unreachable', unreachableLightState());
  broadcast(getStatus());
}

async function handleLightOff(config, lightState) {
  if (state.nanoleafOff) {
    return;
  }

  const reason = lightState.reachable ? 'off' : 'unreachable';

  await turnNanoleafOff(reason);
  state.lastLightState = { ...lightState };
  state.fastPollUntil = Date.now() + FAST_POLL_DURATION_MS;
  storage.logLightChange(config.sync.hueDeviceName, blackColor(), reason, lightState);
  broadcast(getStatus());
}

async function applyLightColor(config, lightState) {
  const rgb = color.getLightRgb(lightState);
  const target = toNanoleafTarget(config, lightState, rgb);
  const mode = color.isCloseToWhite(lightState) ? 'static' : 'animation';
  const { label, present } = PRESENTATIONS[mode];

  await nanoleafService.setOn(true);
  await present(target);
  log(`RGB(${rgb.r}, ${rgb.g}, ${rgb.b}) ${label}`);
  storage.logLightChange(config.sync.hueDeviceName, rgb, mode, lightState);
  recordSync(rgb, lightState);
}

function toNanoleafTarget(config, lightState, rgb) {
  const hsl = color.rgbToHsl(rgb.r, rgb.g, rgb.b);
  const nanoleafConfig = config.nanoleaf || {};

  return {
    hue: Math.round(hsl.h),
    sat: Math.round(hsl.s),
    bri: color.mapBrightness(lightState.bri, nanoleafConfig.minBrightness, nanoleafConfig.maxBrightness)
  };
}

async function presentAnimation(target) {
  await nanoleafService.createOrUpdateEffect(target.hue, target.sat, target.bri);
  await nanoleafService.selectEffect('HueSync');
}

async function presentStaticColor(target) {
  await nanoleafService.setColor(target.hue, target.sat, target.bri);
}

function recordSync(rgb, lightState) {
  state.currentColor = rgb;
  state.lastLightState = { ...lightState };
  state.lastSync = new Date().toISOString();
  state.fastPollUntil = Date.now() + FAST_POLL_DURATION_MS;

  broadcast(getStatus());
}

async function turnNanoleafOff(reason) {
  log(`Hue light ${reason} -> Nanoleaf OFF`);
  await nanoleafService.setOn(false);
  state.nanoleafOff = true;
  state.currentColor = blackColor();
}

function hasHueCredentials(hueConfig) {
  return Boolean(hueConfig?.ip && hueConfig?.username);
}

function hasNanoleafCredentials(nanoleafConfig) {
  return Boolean(nanoleafConfig?.ip && nanoleafConfig?.authToken);
}

function blackColor() {
  return Object.fromEntries(RGB_CHANNELS.map((channel) => [channel, 0]));
}

function unreachableLightState() {
  return Object.fromEntries([['on', false], ['bri', 0]]);
}

function getStatus() {
  return {
    running: state.running,
    lastSync: state.lastSync,
    lastError: state.lastError,
    currentColor: state.currentColor
  };
}

function log(message) {
  if (broadcastHandler) {
    broadcastHandler({ type: 'log', data: { source: 'sync', message } });
  }
}

function broadcast(payload) {
  if (broadcastHandler) {
    broadcastHandler({ type: 'sync', data: payload });
  }
}

function setBroadcast(handler) {
  broadcastHandler = handler;
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
