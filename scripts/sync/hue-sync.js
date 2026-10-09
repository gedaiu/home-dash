const { api } = require('node-hue-api');
const { rgbToHsl, describeRgb } = require('./color-conversion');
const { isCloseToWhite, getLightRgb, stateChanged, BLACK } = require('./hue-state');
const { setNanoleafColor, readBrightnessRange } = require('./nanoleaf');
const { schedulePolling } = require('./polling');

const POLL_INTERVAL_SLOW_MS = 5000;
const POLL_INTERVAL_FAST_MS = 1000;
const FAST_POLL_DURATION_MS = 10000;
const MS_PER_SECOND = 1000;
const SATURATION_THRESHOLD = 50;
const LOGGED_STATE_FIELDS = ['on', 'bri', 'hue', 'sat', 'ct', 'xy', 'colormode'];

async function syncHueDevice(config) {
  printBanner(config);

  const hueApi = await api.createLocal(config.hue.ip).connect(config.hue.username);
  const session = { config, hueApi, lastState: null, isNanoleafOff: false, fastPollUntil: 0 };

  await pollHueLight(session);
  schedulePolling(() => pollHueLight(session), () => chooseInterval(session));
}

function printBanner(config) {
  const { minBrightness, maxBrightness } = readBrightnessRange(config);
  const deviceName = config.sync.hueDeviceName || config.sync.deviceName;

  console.log(`Syncing: "${deviceName}" -> Nanoleaf`);
  console.log(`Poll interval: ${POLL_INTERVAL_SLOW_MS}ms (${POLL_INTERVAL_FAST_MS}ms for ${FAST_POLL_DURATION_MS / MS_PER_SECOND}s after change)`);
  console.log(`Saturation threshold for animation: ${SATURATION_THRESHOLD}%`);
  console.log(`Nanoleaf brightness range: ${minBrightness}% - ${maxBrightness}%`);
  console.log('\nPress Ctrl+C to stop.\n');
}

function chooseInterval(session) {
  return Date.now() < session.fastPollUntil ? POLL_INTERVAL_FAST_MS : POLL_INTERVAL_SLOW_MS;
}

async function pollHueLight(session) {
  const { config, hueApi } = session;

  try {
    const light = await hueApi.lights.getLight(config.sync.hueDeviceId || config.sync.deviceId);

    await processLightState(session, light.state || light._data?.state);
  } catch (err) {
    console.error(`Error: ${err.message}`);
  }
}

async function processLightState(session, state) {
  if (!state.on) {
    await handleLightOff(session, state);

    return;
  }

  session.isNanoleafOff = false;

  if (stateChanged(session.lastState, state)) {
    await forwardLightState(session, state);
  }
}

async function handleLightOff(session, state) {
  if (session.isNanoleafOff) {
    return;
  }

  console.log(`${timestamp()} - Hue light OFF, turning Nanoleaf OFF`);
  await setNanoleafColor(session.config, BLACK, { hueBrightness: 0, useAnimation: false });
  rememberChange(session, state);
  session.isNanoleafOff = true;
}

async function forwardLightState(session, state) {
  const rgb = getLightRgb(state);
  const useAnimation = !isCloseToWhite(state);

  console.log('Raw Hue state:', Object.fromEntries(LOGGED_STATE_FIELDS.map(field => [field, state[field]])));
  logConversion(rgb, useAnimation);

  await setNanoleafColor(session.config, rgb, { hueBrightness: state.bri, useAnimation });
  rememberChange(session, state);
}

function logConversion(rgb, useAnimation) {
  const hsl = rgbToHsl(rgb);
  const colorInfo = `RGB(${rgb.red}, ${rgb.green}, ${rgb.blue})`;

  console.log('Converted RGB:', describeRgb(rgb));
  console.log('Converted HSL for Nanoleaf:', {
    hue: Math.round(hsl.hue),
    sat: Math.round(hsl.sat),
    bri: Math.max(1, Math.round(hsl.lightness))
  });
  console.log(`${timestamp()} - ${colorInfo} ${useAnimation ? 'with animation' : 'no animation'}`);
}

function rememberChange(session, state) {
  session.lastState = { ...state };
  session.fastPollUntil = Date.now() + FAST_POLL_DURATION_MS;
}

function timestamp() {
  return new Date().toLocaleTimeString();
}

module.exports = { syncHueDevice };
