const DEFAULT_MIN_BRIGHTNESS = 5;
const DEFAULT_MAX_BRIGHTNESS = 100;
const SATURATION_THRESHOLD = 50;

const HUE_MAX = 65535;
const LEVEL_MAX = 254;
const HUE_SECTORS = 6;
const RGB_MAX = 255;
const SECTOR_CHANNELS = [
  ['value', 'rising', 'lowest'],
  ['falling', 'value', 'lowest'],
  ['lowest', 'value', 'rising'],
  ['lowest', 'falling', 'value'],
  ['rising', 'lowest', 'value'],
  ['value', 'lowest', 'falling']
];

function hueToRgb(hue, sat, bri) {
  const hueFraction = hue / HUE_MAX;
  const saturation = sat / LEVEL_MAX;
  const value = bri / LEVEL_MAX;
  const sector = Math.floor(hueFraction * HUE_SECTORS);
  const fraction = hueFraction * HUE_SECTORS - sector;
  const levels = {
    value,
    lowest: value * (1 - saturation),
    falling: value * (1 - fraction * saturation),
    rising: value * (1 - (1 - fraction) * saturation)
  };
  const [red, green, blue] = SECTOR_CHANNELS[sector % HUE_SECTORS] ?? [];

  return rgbFrom([levels[red], levels[green], levels[blue]], (channel) => Math.round(channel * RGB_MAX));
}

const MIRED_SCALE = 1000000;
const TEMPERATURE_SCALE = 100;
const WARM_TEMPERATURE_LIMIT = 66;

function ctToRgb(mireds, bri) {
  const kelvin = Math.round(MIRED_SCALE / mireds);
  const temperature = kelvin / TEMPERATURE_SCALE;
  const brightness = bri / LEVEL_MAX;
  const channels = temperature <= WARM_TEMPERATURE_LIMIT ? warmChannels(temperature) : coolChannels(temperature);

  return rgbFrom(channels, (channel) => Math.round(clampToByte(channel) * brightness));
}

const GAMMA = 2.4;
const INVERSE_GAMMA = 1 / GAMMA;
const GAMMA_OFFSET = 0.055;
const GAMMA_LINEAR_LIMIT = 0.0031308;
const GAMMA_LINEAR_SLOPE = 12.92;
const XYZ_TO_RGB_ROWS = [
  { cieX: 1.656492, cieY: -0.354851, cieZ: -0.255038 },
  { cieX: -0.707196, cieY: 1.655397, cieZ: 0.036152 },
  { cieX: 0.051713, cieY: -0.121364, cieZ: 1.011530 }
];

function xyToRgb(xCoord, yCoord, bri) {
  const cieY = bri / LEVEL_MAX;
  const cieX = (cieY / yCoord) * xCoord;
  const cieZ = (cieY / yCoord) * (1 - xCoord - yCoord);

  const linear = XYZ_TO_RGB_ROWS.map((row) => cieX * row.cieX + cieY * row.cieY + cieZ * row.cieZ);
  const gammaCorrected = linear.map((channel) => {
    return channel <= GAMMA_LINEAR_LIMIT
      ? GAMMA_LINEAR_SLOPE * channel
      : (1 + GAMMA_OFFSET) * Math.pow(channel, INVERSE_GAMMA) - GAMMA_OFFSET;
  });
  const peak = Math.max(...gammaCorrected);
  const normalized = peak > 1 ? gammaCorrected.map((channel) => channel / peak) : gammaCorrected;

  return rgbFrom(normalized, (channel) => Math.round(clampToByte(channel * RGB_MAX)));
}

const DEGREES = 360;
const PERCENT = 100;

function rgbToHsl(red, green, blue) {
  const channels = [red, green, blue].map((channel) => channel / RGB_MAX);
  const max = Math.max(...channels);
  const min = Math.min(...channels);
  const lightness = (max + min) / 2;
  const isGray = max === min;
  const saturation = isGray ? 0 : hslSaturation({ max, min, lightness });
  const hueFraction = isGray ? 0 : hslHueFraction(channels, max - min);

  return { 'h': hueFraction * DEGREES, 's': saturation * PERCENT, 'l': lightness * PERCENT };
}

function isCloseToWhite(state) {
  if (state.colormode === 'hs' || state.colormode === 'xy') {
    return (state.sat / LEVEL_MAX) * PERCENT < SATURATION_THRESHOLD;
  }

  return true;
}

function getLightRgb(state) {
  if (!state.on) {
    return rgbFrom([0, 0, 0], Number);
  }

  if (state.colormode === 'ct') {
    return ctToRgb(state.ct, state.bri);
  }

  if (state.colormode === 'xy' && state.xy) {
    return xyStateToRgb(state);
  }

  return state.colormode === 'hs' ? hsStateToRgb(state) : grayRgb(state.bri);
}

const COMPARED_FIELDS = ['on', 'bri', 'hue', 'sat', 'ct', 'colormode'];

function stateChanged(previous, current) {
  if (!previous) {
    return true;
  }

  return COMPARED_FIELDS.some((field) => previous[field] !== current[field])
    || xyChanged(previous.xy, current.xy);
}

function mapBrightness(hueBrightness, minBri = DEFAULT_MIN_BRIGHTNESS, maxBri = DEFAULT_MAX_BRIGHTNESS) {
  const huePercent = hueBrightness / LEVEL_MAX;

  return Math.round(minBri + huePercent * (maxBri - minBri));
}

function rgbFrom(channels, convert) {
  const [red, green, blue] = channels.map(convert);

  return { 'r': red, 'g': green, 'b': blue };
}

function clampToByte(channel) {
  return Math.min(RGB_MAX, Math.max(0, channel));
}

const GREEN_LOG_FIT = { scale: 99.4708025861, offset: 161.1195681661 };
const BLUE_LOG_FIT = { scale: 138.5177312231, offset: 305.0447927307 };
const BLUE_CUTOFF_TEMPERATURE = 19;
const BLUE_TEMPERATURE_SHIFT = 10;

function warmChannels(temperature) {
  const blue = temperature <= BLUE_CUTOFF_TEMPERATURE ? 0 : logFit(BLUE_LOG_FIT, temperature - BLUE_TEMPERATURE_SHIFT);

  return [RGB_MAX, logFit(GREEN_LOG_FIT, temperature), blue];
}

function logFit({ scale, offset }, input) {
  return scale * Math.log(input) - offset;
}

const RED_POWER_FIT = { scale: 329.698727446, exponent: -0.1332047592 };
const GREEN_POWER_FIT = { scale: 288.1221695283, exponent: -0.0755148492 };
const COOL_TEMPERATURE_SHIFT = 60;

function coolChannels(temperature) {
  const shifted = temperature - COOL_TEMPERATURE_SHIFT;

  return [powerFit(RED_POWER_FIT, shifted), powerFit(GREEN_POWER_FIT, shifted), RGB_MAX];
}

function powerFit({ scale, exponent }, input) {
  return scale * Math.pow(input, exponent);
}

const LIGHTNESS_MIDPOINT = 0.5;

function hslSaturation({ max, min, lightness }) {
  const delta = max - min;

  return lightness > LIGHTNESS_MIDPOINT ? delta / (2 - max - min) : delta / (max + min);
}

const GREEN_SECTOR_OFFSET = 2;
const BLUE_SECTOR_OFFSET = 4;

function hslHueFraction([red, green, blue], delta) {
  const max = Math.max(red, green, blue);

  if (max === red) {
    return ((green - blue) / delta + (green < blue ? HUE_SECTORS : 0)) / HUE_SECTORS;
  }

  if (max === green) {
    return ((blue - red) / delta + GREEN_SECTOR_OFFSET) / HUE_SECTORS;
  }

  return ((red - green) / delta + BLUE_SECTOR_OFFSET) / HUE_SECTORS;
}

function xyStateToRgb(state) {
  const [xCoord, yCoord] = state.xy;

  return xyToRgb(xCoord, yCoord, state.bri);
}

function hsStateToRgb(state) {
  return hueToRgb(state.hue || 0, state.sat || 0, state.bri);
}

function grayRgb(bri) {
  const brightness = Math.round((bri / LEVEL_MAX) * RGB_MAX);

  return rgbFrom([brightness, brightness, brightness], Number);
}

function xyChanged(previousXy, currentXy) {
  return previousXy?.[0] !== currentXy?.[0] || previousXy?.[1] !== currentXy?.[1];
}

module.exports = {
  hueToRgb,
  ctToRgb,
  xyToRgb,
  rgbToHsl,
  isCloseToWhite,
  getLightRgb,
  stateChanged,
  mapBrightness,
  SATURATION_THRESHOLD,
  DEFAULT_MIN_BRIGHTNESS,
  DEFAULT_MAX_BRIGHTNESS
};
