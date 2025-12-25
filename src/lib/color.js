const DEFAULT_MIN_BRIGHTNESS = 5;
const DEFAULT_MAX_BRIGHTNESS = 100;
const SATURATION_THRESHOLD = 50;

function hueToRgb(hue, sat, bri) {
  const h = hue / 65535;
  const s = sat / 254;
  const v = bri / 254;

  let r, g, b;
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);

  switch (i % 6) {
    case 0: r = v; g = t; b = p; break;
    case 1: r = q; g = v; b = p; break;
    case 2: r = p; g = v; b = t; break;
    case 3: r = p; g = q; b = v; break;
    case 4: r = t; g = p; b = v; break;
    case 5: r = v; g = p; b = q; break;
  }

  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255)
  };
}

function ctToRgb(ct, bri) {
  const kelvin = Math.round(1000000 / ct);
  const temp = kelvin / 100;
  const brightness = bri / 254;

  let r, g, b;

  if (temp <= 66) {
    r = 255;
    g = temp;
    g = 99.4708025861 * Math.log(g) - 161.1195681661;
    if (temp <= 19) {
      b = 0;
    } else {
      b = temp - 10;
      b = 138.5177312231 * Math.log(b) - 305.0447927307;
    }
  } else {
    r = temp - 60;
    r = 329.698727446 * Math.pow(r, -0.1332047592);
    g = temp - 60;
    g = 288.1221695283 * Math.pow(g, -0.0755148492);
    b = 255;
  }

  return {
    r: Math.round(Math.min(255, Math.max(0, r)) * brightness),
    g: Math.round(Math.min(255, Math.max(0, g)) * brightness),
    b: Math.round(Math.min(255, Math.max(0, b)) * brightness)
  };
}

function xyToRgb(x, y, bri) {
  const brightness = bri / 254;

  const z = 1.0 - x - y;
  const Y = brightness;
  const X = (Y / y) * x;
  const Z = (Y / y) * z;

  let r = X * 1.656492 - Y * 0.354851 - Z * 0.255038;
  let g = -X * 0.707196 + Y * 1.655397 + Z * 0.036152;
  let b = X * 0.051713 - Y * 0.121364 + Z * 1.011530;

  r = r <= 0.0031308 ? 12.92 * r : (1.0 + 0.055) * Math.pow(r, 1.0 / 2.4) - 0.055;
  g = g <= 0.0031308 ? 12.92 * g : (1.0 + 0.055) * Math.pow(g, 1.0 / 2.4) - 0.055;
  b = b <= 0.0031308 ? 12.92 * b : (1.0 + 0.055) * Math.pow(b, 1.0 / 2.4) - 0.055;

  const maxVal = Math.max(r, g, b);
  if (maxVal > 1) {
    r /= maxVal;
    g /= maxVal;
    b /= maxVal;
  }

  return {
    r: Math.round(Math.min(255, Math.max(0, r * 255))),
    g: Math.round(Math.min(255, Math.max(0, g * 255))),
    b: Math.round(Math.min(255, Math.max(0, b * 255)))
  };
}

function rgbToHsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;

  let h = 0;
  let s = 0;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  return {
    h: h * 360,
    s: s * 100,
    l: l * 100
  };
}

function isCloseToWhite(state) {
  if (state.colormode === 'ct') {
    return true;
  }

  if (state.colormode === 'hs' || state.colormode === 'xy') {
    const satPercent = (state.sat / 254) * 100;
    return satPercent < SATURATION_THRESHOLD;
  }

  return true;
}

function getLightRgb(state) {
  if (!state.on) {
    return { r: 0, g: 0, b: 0 };
  }

  if (state.colormode === 'ct') {
    return ctToRgb(state.ct, state.bri);
  }

  if (state.colormode === 'xy' && state.xy) {
    return xyToRgb(state.xy[0], state.xy[1], state.bri);
  }

  if (state.colormode === 'hs') {
    return hueToRgb(state.hue || 0, state.sat || 0, state.bri);
  }

  const brightness = Math.round((state.bri / 254) * 255);
  return { r: brightness, g: brightness, b: brightness };
}

function stateChanged(prev, curr) {
  if (!prev) {
    return true;
  }

  const xyChanged = prev.xy?.[0] !== curr.xy?.[0] || prev.xy?.[1] !== curr.xy?.[1];

  return prev.on !== curr.on ||
    prev.bri !== curr.bri ||
    prev.hue !== curr.hue ||
    prev.sat !== curr.sat ||
    prev.ct !== curr.ct ||
    prev.colormode !== curr.colormode ||
    xyChanged;
}

function mapBrightness(hueBrightness, minBri = DEFAULT_MIN_BRIGHTNESS, maxBri = DEFAULT_MAX_BRIGHTNESS) {
  const huePercent = hueBrightness / 254;
  return Math.round(minBri + huePercent * (maxBri - minBri));
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
