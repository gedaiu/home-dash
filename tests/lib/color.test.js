const {
  hueToRgb,
  ctToRgb,
  xyToRgb,
  rgbToHsl,
  isCloseToWhite,
  getLightRgb,
  stateChanged,
  mapBrightness
} = require('../../src/lib/color');

describe('hueToRgb', () => {
  test('returns red for hue 0 at full saturation and brightness', () => {
    const result = hueToRgb(0, 254, 254);
    expect(result.r).toBeGreaterThan(250);
    expect(result.g).toBeLessThan(10);
    expect(result.b).toBeLessThan(10);
  });

  test('returns green for hue at 1/3 of range', () => {
    const result = hueToRgb(21845, 254, 254);
    expect(result.g).toBeGreaterThan(200);
  });

  test('returns blue for hue at 2/3 of range', () => {
    const result = hueToRgb(43690, 254, 254);
    expect(result.b).toBeGreaterThan(200);
  });

  test('returns low values for zero brightness', () => {
    const result = hueToRgb(0, 254, 0);
    expect(result).toEqual({ r: 0, g: 0, b: 0 });
  });

  test('returns white-ish for zero saturation', () => {
    const result = hueToRgb(0, 0, 254);
    expect(result.r).toEqual(result.g);
    expect(result.g).toEqual(result.b);
  });
});

describe('ctToRgb', () => {
  test('returns warm color for low color temperature', () => {
    const result = ctToRgb(500, 254);
    expect(result.r).toBeGreaterThan(result.b);
  });

  test('returns cool color for high color temperature', () => {
    const result = ctToRgb(153, 254);
    expect(result.b).toBeGreaterThanOrEqual(result.r - 50);
  });

  test('returns darker values for lower brightness', () => {
    const bright = ctToRgb(300, 254);
    const dim = ctToRgb(300, 127);
    expect(bright.r).toBeGreaterThan(dim.r);
    expect(bright.g).toBeGreaterThan(dim.g);
    expect(bright.b).toBeGreaterThan(dim.b);
  });
});

describe('xyToRgb', () => {
  test('returns valid RGB values for typical xy coordinates', () => {
    const result = xyToRgb(0.3, 0.3, 254);
    expect(result.r).toBeGreaterThanOrEqual(0);
    expect(result.r).toBeLessThanOrEqual(255);
    expect(result.g).toBeGreaterThanOrEqual(0);
    expect(result.g).toBeLessThanOrEqual(255);
    expect(result.b).toBeGreaterThanOrEqual(0);
    expect(result.b).toBeLessThanOrEqual(255);
  });

  test('returns darker values for lower brightness', () => {
    const bright = xyToRgb(0.3, 0.3, 254);
    const dim = xyToRgb(0.3, 0.3, 50);
    expect(bright.r + bright.g + bright.b).toBeGreaterThan(dim.r + dim.g + dim.b);
  });
});

describe('rgbToHsl', () => {
  test('returns hue 0 for red', () => {
    const result = rgbToHsl(255, 0, 0);
    expect(result.h).toBe(0);
    expect(result.s).toBe(100);
  });

  test('returns hue 120 for green', () => {
    const result = rgbToHsl(0, 255, 0);
    expect(result.h).toBe(120);
    expect(result.s).toBe(100);
  });

  test('returns hue 240 for blue', () => {
    const result = rgbToHsl(0, 0, 255);
    expect(result.h).toBe(240);
    expect(result.s).toBe(100);
  });

  test('returns saturation 0 for grayscale', () => {
    const result = rgbToHsl(128, 128, 128);
    expect(result.s).toBe(0);
  });
});

describe('isCloseToWhite', () => {
  test('returns true for ct colormode', () => {
    expect(isCloseToWhite({ colormode: 'ct' })).toBe(true);
  });

  test('returns true for low saturation in hs mode', () => {
    expect(isCloseToWhite({ colormode: 'hs', sat: 50 })).toBe(true);
  });

  test('returns false for high saturation in hs mode', () => {
    expect(isCloseToWhite({ colormode: 'hs', sat: 200 })).toBe(false);
  });

  test('returns true for low saturation in xy mode', () => {
    expect(isCloseToWhite({ colormode: 'xy', sat: 50 })).toBe(true);
  });
});

describe('getLightRgb', () => {
  test('returns black when light is off', () => {
    expect(getLightRgb({ on: false })).toEqual({ r: 0, g: 0, b: 0 });
  });

  test('uses ctToRgb for ct colormode', () => {
    const result = getLightRgb({ on: true, colormode: 'ct', ct: 300, bri: 254 });
    expect(result.r).toBeGreaterThan(0);
  });

  test('uses xyToRgb for xy colormode', () => {
    const result = getLightRgb({ on: true, colormode: 'xy', xy: [0.3, 0.3], bri: 254 });
    expect(result.r).toBeGreaterThan(0);
  });

  test('uses hueToRgb for hs colormode', () => {
    const result = getLightRgb({ on: true, colormode: 'hs', hue: 0, sat: 254, bri: 254 });
    expect(result.r).toBeGreaterThan(200);
  });

  test('returns grayscale when no colormode specified', () => {
    const result = getLightRgb({ on: true, bri: 127 });
    expect(result.r).toBe(result.g);
    expect(result.g).toBe(result.b);
    expect(result.r).toBeGreaterThan(100);
    expect(result.r).toBeLessThan(140);
  });
});

describe('stateChanged', () => {
  test('returns true when previous state is null', () => {
    expect(stateChanged(null, { on: true })).toBe(true);
  });

  test('returns true when on state differs', () => {
    expect(stateChanged({ on: true }, { on: false })).toBe(true);
  });

  test('returns true when brightness differs', () => {
    expect(stateChanged({ on: true, bri: 100 }, { on: true, bri: 200 })).toBe(true);
  });

  test('returns true when hue differs', () => {
    expect(stateChanged({ on: true, hue: 100 }, { on: true, hue: 200 })).toBe(true);
  });

  test('returns true when xy differs', () => {
    expect(stateChanged(
      { on: true, xy: [0.3, 0.3] },
      { on: true, xy: [0.4, 0.4] }
    )).toBe(true);
  });

  test('returns false when states are equal', () => {
    const state = { on: true, bri: 100, hue: 0, sat: 254, ct: 200, colormode: 'hs' };
    expect(stateChanged(state, { ...state })).toBe(false);
  });
});

describe('mapBrightness', () => {
  test('maps 0 brightness to min', () => {
    expect(mapBrightness(0, 20, 100)).toBe(20);
  });

  test('maps max brightness to max', () => {
    expect(mapBrightness(254, 20, 100)).toBe(100);
  });

  test('maps mid brightness to mid range', () => {
    const result = mapBrightness(127, 0, 100);
    expect(result).toBeGreaterThan(40);
    expect(result).toBeLessThan(60);
  });

  test('uses default values when not provided', () => {
    const result = mapBrightness(127);
    expect(result).toBeGreaterThan(40);
    expect(result).toBeLessThan(60);
  });
});
