const axios = require('axios');
const { rgbToHsl } = require('./color-conversion');

const NANOLEAF_DEFAULT_PORT = 16021;
const REQUEST_TIMEOUT_MS = 5000;
const HUE_LEVEL_MAX = 254;
const DEFAULT_MIN_BRIGHTNESS = 5;
const DEFAULT_MAX_BRIGHTNESS = 100;
const EFFECT_NAME = 'HueSync';

async function setNanoleafColor(config, rgb, { hueBrightness, useAnimation }) {
  const baseUrl = buildBaseUrl(config);

  if (rgb.red === 0 && rgb.green === 0 && rgb.blue === 0) {
    await putState(baseUrl, { 'on': { value: false } });

    return;
  }

  const hsl = rgbToHsl(rgb);
  const target = {
    hue: Math.round(hsl.hue),
    sat: Math.round(hsl.sat),
    bri: mapBrightness(hueBrightness, config)
  };

  await putState(baseUrl, { 'on': { value: true } });

  if (useAnimation) {
    await applyAnimation(baseUrl, target);

    return;
  }

  await putState(baseUrl, {
    hue: { value: target.hue },
    sat: { value: target.sat },
    brightness: { value: target.bri }
  });
}

function readBrightnessRange(config) {
  return {
    minBrightness: config.nanoleaf?.minBrightness ?? DEFAULT_MIN_BRIGHTNESS,
    maxBrightness: config.nanoleaf?.maxBrightness ?? DEFAULT_MAX_BRIGHTNESS
  };
}

function buildBaseUrl(config) {
  const { ip: panelIp, port, authToken } = config.nanoleaf;

  return `http://${panelIp}:${port || NANOLEAF_DEFAULT_PORT}/api/v1/${authToken}`;
}

function mapBrightness(hueBrightness, config) {
  const { minBrightness, maxBrightness } = readBrightnessRange(config);
  const huePercent = hueBrightness / HUE_LEVEL_MAX;

  return Math.round(minBrightness + huePercent * (maxBrightness - minBrightness));
}

async function applyAnimation(baseUrl, target) {
  try {
    await createOrUpdateEffect(baseUrl, target);
    await axios.put(`${baseUrl}/effects`, { select: EFFECT_NAME }, { timeout: REQUEST_TIMEOUT_MS });
  } catch (err) {
    console.error('Effect error:', err.response?.data || err.message);
  }
}

async function createOrUpdateEffect(baseUrl, target) {
  const effect = {
    command: 'add',
    animName: EFFECT_NAME,
    animType: 'random',
    colorType: 'HSB',
    palette: [
      { hue: target.hue, saturation: target.sat, brightness: 100 },
      { hue: target.hue, saturation: target.sat, brightness: 40 }
    ],
    brightnessRange: { minValue: 40, maxValue: 100 },
    transTime: { minValue: 20, maxValue: 30 },
    delayTime: { minValue: 10, maxValue: 20 },
    loop: true
  };

  await axios.put(`${baseUrl}/effects`, { write: effect }, { timeout: REQUEST_TIMEOUT_MS });
  await putState(baseUrl, { brightness: { value: target.bri } });
}

async function putState(baseUrl, body) {
  await axios.put(`${baseUrl}/state`, body, { timeout: REQUEST_TIMEOUT_MS });
}

module.exports = { setNanoleafColor, readBrightnessRange };
