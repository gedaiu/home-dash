let colors;

beforeAll(async () => {
  colors = await import('../../src/lib/color');
});

describe('hueToRgb', () => {
  it('returns {255,0,0} for hue 0 at full saturation and brightness', () => {
    expect(colors.hueToRgb(0, 254, 254)).toEqual({ 'r': 255, 'g': 0, 'b': 0 });
  });

  it('returns {0,255,0} for hue 21845 at full saturation and brightness', () => {
    expect(colors.hueToRgb(21845, 254, 254)).toEqual({ 'r': 0, 'g': 255, 'b': 0 });
  });

  it('returns {0,0,255} for hue 43690 at full saturation and brightness', () => {
    expect(colors.hueToRgb(43690, 254, 254)).toEqual({ 'r': 0, 'g': 0, 'b': 255 });
  });

  it('returns {0,0,0} for hue 0 at zero brightness', () => {
    expect(colors.hueToRgb(0, 254, 0)).toEqual({ 'r': 0, 'g': 0, 'b': 0 });
  });

  it('returns {255,255,255} for hue 0 at zero saturation', () => {
    expect(colors.hueToRgb(0, 0, 254)).toEqual({ 'r': 255, 'g': 255, 'b': 255 });
  });
});

describe('ctToRgb', () => {
  it('returns {255,137,14} for 500 mireds at full brightness', () => {
    expect(colors.ctToRgb(500, 254)).toEqual({ 'r': 255, 'g': 137, 'b': 14 });
  });

  it('returns {255,255,251} for 153 mireds at full brightness', () => {
    expect(colors.ctToRgb(153, 254)).toEqual({ 'r': 255, 'g': 255, 'b': 251 });
  });

  it('returns {255,188,131} for 300 mireds at full brightness', () => {
    expect(colors.ctToRgb(300, 254)).toEqual({ 'r': 255, 'g': 188, 'b': 131 });
  });

  it('returns {128,94,66} for 300 mireds at half brightness', () => {
    expect(colors.ctToRgb(300, 127)).toEqual({ 'r': 128, 'g': 94, 'b': 66 });
  });
});

describe('xyToRgb', () => {
  it('returns {225,229,255} for xy 0.3,0.3 at full brightness', () => {
    expect(colors.xyToRgb(0.3, 0.3, 254)).toEqual({ 'r': 225, 'g': 229, 'b': 255 });
  });

  it('returns {120,122,137} for xy 0.3,0.3 at brightness 50', () => {
    expect(colors.xyToRgb(0.3, 0.3, 50)).toEqual({ 'r': 120, 'g': 122, 'b': 137 });
  });
});

describe('rgbToHsl', () => {
  it('returns hue 0 and saturation 100 for red 255,0,0', () => {
    expect(colors.rgbToHsl(255, 0, 0)).toEqual({ 'h': 0, 's': 100, 'l': 50 });
  });

  it('returns hue 120 and saturation 100 for green 0,255,0', () => {
    expect(colors.rgbToHsl(0, 255, 0)).toEqual({ 'h': 120, 's': 100, 'l': 50 });
  });

  it('returns hue 240 and saturation 100 for blue 0,0,255', () => {
    expect(colors.rgbToHsl(0, 0, 255)).toEqual({ 'h': 240, 's': 100, 'l': 50 });
  });

  it('returns hue 0 and saturation 0 for gray 128,128,128', () => {
    expect(colors.rgbToHsl(128, 128, 128)).toMatchObject({ 'h': 0, 's': 0 });
  });
});

describe('isCloseToWhite', () => {
  it('returns true for colormode ct', () => {
    expect(colors.isCloseToWhite({ colormode: 'ct' })).toBe(true);
  });

  it('returns true for colormode hs with saturation 50', () => {
    expect(colors.isCloseToWhite({ colormode: 'hs', sat: 50 })).toBe(true);
  });

  it('returns false for colormode hs with saturation 200', () => {
    expect(colors.isCloseToWhite({ colormode: 'hs', sat: 200 })).toBe(false);
  });

  it('returns true for colormode xy with saturation 50', () => {
    expect(colors.isCloseToWhite({ colormode: 'xy', sat: 50 })).toBe(true);
  });

  it('returns true for an unknown colormode', () => {
    expect(colors.isCloseToWhite({ colormode: 'other', sat: 254 })).toBe(true);
  });
});

describe('getLightRgb', () => {
  it('returns {0,0,0} when the light is off', () => {
    expect(colors.getLightRgb({ 'on': false })).toEqual({ 'r': 0, 'g': 0, 'b': 0 });
  });

  it('returns the ct color for colormode ct with ct 300', () => {
    expect(colors.getLightRgb({ 'on': true, colormode: 'ct', 'ct': 300, bri: 254 })).toEqual({ 'r': 255, 'g': 188, 'b': 131 });
  });

  it('returns the xy color for colormode xy with xy 0.3,0.3', () => {
    expect(colors.getLightRgb({ 'on': true, colormode: 'xy', 'xy': [0.3, 0.3], bri: 254 })).toEqual({ 'r': 225, 'g': 229, 'b': 255 });
  });

  it('returns red for colormode hs with hue 0 and saturation 254', () => {
    expect(colors.getLightRgb({ 'on': true, colormode: 'hs', hue: 0, sat: 254, bri: 254 })).toEqual({ 'r': 255, 'g': 0, 'b': 0 });
  });

  it('returns {0,0,0} for colormode hs with brightness 0 and no hue or saturation', () => {
    expect(colors.getLightRgb({ 'on': true, colormode: 'hs', bri: 0 })).toEqual({ 'r': 0, 'g': 0, 'b': 0 });
  });

  it('returns gray {128,128,128} for brightness 127 without colormode', () => {
    expect(colors.getLightRgb({ 'on': true, bri: 127 })).toEqual({ 'r': 128, 'g': 128, 'b': 128 });
  });

  it('returns gray {128,128,128} for colormode xy without xy coordinates', () => {
    expect(colors.getLightRgb({ 'on': true, colormode: 'xy', bri: 127 })).toEqual({ 'r': 128, 'g': 128, 'b': 128 });
  });
});

describe('stateChanged', () => {
  it('returns true when previous state is null', () => {
    expect(colors.stateChanged(null, { 'on': true })).toBe(true);
  });

  it('returns true when on differs', () => {
    expect(colors.stateChanged({ 'on': true }, { 'on': false })).toBe(true);
  });

  it('returns true when brightness differs', () => {
    expect(colors.stateChanged({ 'on': true, bri: 100 }, { 'on': true, bri: 200 })).toBe(true);
  });

  it('returns true when hue differs', () => {
    expect(colors.stateChanged({ 'on': true, hue: 100 }, { 'on': true, hue: 200 })).toBe(true);
  });

  it('returns true when xy differs', () => {
    expect(colors.stateChanged({ 'on': true, 'xy': [0.3, 0.3] }, { 'on': true, 'xy': [0.4, 0.4] })).toBe(true);
  });

  it('returns true when only the second xy coordinate differs', () => {
    expect(colors.stateChanged({ 'on': true, 'xy': [0.3, 0.3] }, { 'on': true, 'xy': [0.3, 0.4] })).toBe(true);
  });

  it('returns false when states are equal', () => {
    const state = { 'on': true, bri: 100, hue: 0, sat: 254, 'ct': 200, colormode: 'hs' };

    expect(colors.stateChanged(state, { ...state })).toBe(false);
  });
});

describe('mapBrightness', () => {
  it('returns 20 for brightness 0 with range 20 to 100', () => {
    expect(colors.mapBrightness(0, 20, 100)).toBe(20);
  });

  it('returns 100 for brightness 254 with range 20 to 100', () => {
    expect(colors.mapBrightness(254, 20, 100)).toBe(100);
  });

  it('returns 50 for brightness 127 with range 0 to 100', () => {
    expect(colors.mapBrightness(127, 0, 100)).toBe(50);
  });

  it('returns 53 for brightness 127 with the default range', () => {
    expect(colors.mapBrightness(127)).toBe(53);
  });
});
