const { hueToRgb, ctToRgb, xyToRgb } = require('./color-conversion');

const HUE_LEVEL_MAX = 254;
const RGB_MAX = 255;
const PERCENT = 100;
const SATURATION_THRESHOLD = 50;
const BLACK = { red: 0, green: 0, blue: 0 };
const TRACKED_FIELDS = ['on', 'bri', 'hue', 'sat', 'ct', 'colormode'];

function isCloseToWhite(state) {
  if (state.colormode !== 'hs' && state.colormode !== 'xy') {
    return true;
  }

  return (state.sat / HUE_LEVEL_MAX) * PERCENT < SATURATION_THRESHOLD;
}

function getLightRgb(state) {
  if (!state.on) {
    return BLACK;
  }

  const colorRgb = convertByColorMode(state);

  if (colorRgb) {
    return colorRgb;
  }

  const brightness = Math.round((state.bri / HUE_LEVEL_MAX) * RGB_MAX);

  return { red: brightness, green: brightness, blue: brightness };
}

function convertByColorMode(state) {
  if (state.colormode === 'ct') {
    return ctToRgb(state.ct, state.bri);
  }

  if (state.colormode === 'hs') {
    return hueToRgb(state.hue || 0, state.sat || 0, state.bri);
  }

  return convertXy(state);
}

function convertXy(state) {
  if (state.colormode !== 'xy' || !state.xy) {
    return null;
  }

  return xyToRgb(state.xy[0], state.xy[1], state.bri);
}

function stateChanged(previous, current) {
  if (!previous) {
    return true;
  }

  return xyChanged(previous, current) || TRACKED_FIELDS.some(field => previous[field] !== current[field]);
}

function xyChanged(previous, current) {
  return previous.xy?.[0] !== current.xy?.[0] || previous.xy?.[1] !== current.xy?.[1];
}

module.exports = { isCloseToWhite, getLightRgb, stateChanged, BLACK };
