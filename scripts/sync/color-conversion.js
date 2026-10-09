const RGB_MAX = 255;
const HUE_LEVEL_MAX = 254;
const HUE_WHEEL_MAX = 65535;
const HUE_SEXTANTS = 6;
const HUE_BLUE_SEXTANT_OFFSET = 4;
const DEGREES_IN_CIRCLE = 360;
const PERCENT = 100;
const LIGHTNESS_MIDPOINT = 0.5;

const MICRO_KELVIN = 1000000;
const KELVIN_PER_STEP = 100;
const WARM_TEMP_LIMIT = 66;
const NO_BLUE_TEMP_LIMIT = 19;
const BLUE_TEMP_SHIFT = 10;
const COOL_TEMP_SHIFT = 60;
const WARM_GREEN_SCALE = 99.4708025861;
const WARM_GREEN_OFFSET = 161.1195681661;
const WARM_BLUE_SCALE = 138.5177312231;
const WARM_BLUE_OFFSET = 305.0447927307;
const COOL_RED_SCALE = 329.698727446;
const COOL_RED_EXPONENT = -0.1332047592;
const COOL_GREEN_SCALE = 288.1221695283;
const COOL_GREEN_EXPONENT = -0.0755148492;

const GAMMA_LINEAR_LIMIT = 0.0031308;
const GAMMA_LINEAR_SCALE = 12.92;
const GAMMA_OFFSET = 0.055;
const GAMMA_ROOT = 2.4;

const XYZ_TO_RGB_MATRIX = {
  red: { fromX: 1.656492, fromY: -0.354851, fromZ: -0.255038 },
  green: { fromX: -0.707196, fromY: 1.655397, fromZ: 0.036152 },
  blue: { fromX: 0.051713, fromY: -0.121364, fromZ: 1.01153 }
};

function hueToRgb(hue, sat, bri) {
  const hueFraction = hue / HUE_WHEEL_MAX;
  const saturation = sat / HUE_LEVEL_MAX;
  const value = bri / HUE_LEVEL_MAX;
  const sector = Math.floor(hueFraction * HUE_SEXTANTS);
  const fraction = hueFraction * HUE_SEXTANTS - sector;
  const low = value * (1 - saturation);
  const falling = value * (1 - fraction * saturation);
  const rising = value * (1 - (1 - fraction) * saturation);
  const channelsBySector = [
    [value, rising, low],
    [falling, value, low],
    [low, value, rising],
    [low, falling, value],
    [rising, low, value],
    [value, low, falling]
  ];
  const [red, green, blue] = channelsBySector[sector % HUE_SEXTANTS];

  return mapRgb({ red, green, blue }, channel => Math.round(channel * RGB_MAX));
}

function ctToRgb(mired, bri) {
  const kelvinHundreds = Math.round(MICRO_KELVIN / mired) / KELVIN_PER_STEP;
  const brightness = bri / HUE_LEVEL_MAX;
  const channels = kelvinHundreds <= WARM_TEMP_LIMIT ? warmChannels(kelvinHundreds) : coolChannels(kelvinHundreds);

  return mapRgb(channels, channel => Math.round(clamp(channel, 0, RGB_MAX) * brightness));
}

function xyToRgb(chromaX, chromaY, bri) {
  const brightness = bri / HUE_LEVEL_MAX;
  const ratio = brightness / chromaY;
  const tristimulus = {
    fromX: ratio * chromaX,
    fromY: brightness,
    fromZ: ratio * (1 - chromaX - chromaY)
  };
  const gammaRgb = mapRgb(XYZ_TO_RGB_MATRIX, row => applyGamma(projectXyz(row, tristimulus)));
  const peak = Math.max(gammaRgb.red, gammaRgb.green, gammaRgb.blue);
  const normalized = peak > 1 ? mapRgb(gammaRgb, channel => channel / peak) : gammaRgb;

  return mapRgb(normalized, channel => Math.round(clamp(channel * RGB_MAX, 0, RGB_MAX)));
}

function rgbToHsl(rgb) {
  const unit = mapRgb(rgb, channel => channel / RGB_MAX);
  const peak = Math.max(unit.red, unit.green, unit.blue);
  const trough = Math.min(unit.red, unit.green, unit.blue);
  const lightness = (peak + trough) / 2;
  const spread = peak - trough;
  const isGray = peak === trough;
  const divisor = lightness > LIGHTNESS_MIDPOINT ? 2 - peak - trough : peak + trough;

  return {
    hue: isGray ? 0 : hueFractionOf(unit, peak, spread) * DEGREES_IN_CIRCLE,
    sat: isGray ? 0 : (spread / divisor) * PERCENT,
    lightness: lightness * PERCENT
  };
}

function warmChannels(kelvinHundreds) {
  const hasBlue = kelvinHundreds > NO_BLUE_TEMP_LIMIT;

  return {
    red: RGB_MAX,
    green: WARM_GREEN_SCALE * Math.log(kelvinHundreds) - WARM_GREEN_OFFSET,
    blue: hasBlue ? WARM_BLUE_SCALE * Math.log(kelvinHundreds - BLUE_TEMP_SHIFT) - WARM_BLUE_OFFSET : 0
  };
}

function coolChannels(kelvinHundreds) {
  return {
    red: COOL_RED_SCALE * Math.pow(kelvinHundreds - COOL_TEMP_SHIFT, COOL_RED_EXPONENT),
    green: COOL_GREEN_SCALE * Math.pow(kelvinHundreds - COOL_TEMP_SHIFT, COOL_GREEN_EXPONENT),
    blue: RGB_MAX
  };
}

function applyGamma(linear) {
  if (linear <= GAMMA_LINEAR_LIMIT) {
    return GAMMA_LINEAR_SCALE * linear;
  }

  return (1 + GAMMA_OFFSET) * Math.pow(linear, 1 / GAMMA_ROOT) - GAMMA_OFFSET;
}

function projectXyz(row, tristimulus) {
  return tristimulus.fromX * row.fromX + tristimulus.fromY * row.fromY + tristimulus.fromZ * row.fromZ;
}

function hueFractionOf(rgb, peak, spread) {
  if (peak === rgb.red) {
    return ((rgb.green - rgb.blue) / spread + (rgb.green < rgb.blue ? HUE_SEXTANTS : 0)) / HUE_SEXTANTS;
  }

  if (peak === rgb.green) {
    return ((rgb.blue - rgb.red) / spread + 2) / HUE_SEXTANTS;
  }

  return ((rgb.red - rgb.green) / spread + HUE_BLUE_SEXTANT_OFFSET) / HUE_SEXTANTS;
}

function mapRgb(rgb, transform) {
  return { red: transform(rgb.red), green: transform(rgb.green), blue: transform(rgb.blue) };
}

function describeRgb(rgb) {
  return { 'r': rgb.red, 'g': rgb.green, 'b': rgb.blue };
}

function clamp(value, lowest, highest) {
  return Math.min(highest, Math.max(lowest, value));
}

module.exports = { hueToRgb, ctToRgb, xyToRgb, rgbToHsl, describeRgb };
