const {
  getDeviceCategory,
  getSensorCategory
} = require('../../src/services/hue');

describe('getDeviceCategory', () => {
  it('returns motion for motion sensor', () => {
    expect(getDeviceCategory('ZLLMotion')).toBe('motion');
  });

  it('returns motion for presence sensor', () => {
    expect(getDeviceCategory('ZLLPresence')).toBe('motion');
  });

  it('returns temperature for temperature sensor', () => {
    expect(getDeviceCategory('ZLLTemperature')).toBe('temperature');
  });

  it('returns daylight for daylight sensor', () => {
    expect(getDeviceCategory('Daylight')).toBe('daylight');
  });

  it('returns switch for switch device', () => {
    expect(getDeviceCategory('ZLLSwitch')).toBe('switch');
  });

  it('returns switch for button device', () => {
    expect(getDeviceCategory('ZGPButton')).toBe('switch');
  });

  it('returns switch for dimmer', () => {
    expect(getDeviceCategory('Dimmer Switch')).toBe('switch');
  });

  it('returns switch for tap device', () => {
    expect(getDeviceCategory('ZGPTap')).toBe('switch');
  });

  it('returns plug for smart plug', () => {
    expect(getDeviceCategory('Smart plug')).toBe('plug');
  });

  it('returns strip for light strip', () => {
    expect(getDeviceCategory('Lightstrip Plus')).toBe('strip');
  });

  it('returns candle for candle bulb', () => {
    expect(getDeviceCategory('Hue candle')).toBe('candle');
  });

  it('returns spot for spot light', () => {
    expect(getDeviceCategory('Hue spot')).toBe('spot');
  });

  it('returns spot for recessed light', () => {
    expect(getDeviceCategory('Recessed light')).toBe('spot');
  });

  it('returns ceiling for pendant light', () => {
    expect(getDeviceCategory('Pendant light')).toBe('ceiling');
  });

  it('returns ceiling for ceiling light', () => {
    expect(getDeviceCategory('Ceiling light')).toBe('ceiling');
  });

  it('returns lamp for floor lamp', () => {
    expect(getDeviceCategory('Floor lamp')).toBe('lamp');
  });

  it('returns lamp for table lamp', () => {
    expect(getDeviceCategory('Table lamp')).toBe('lamp');
  });

  it('returns bulb for generic light', () => {
    expect(getDeviceCategory('Extended color light')).toBe('bulb');
  });

  it('returns bulb for bulb type', () => {
    expect(getDeviceCategory('Color bulb')).toBe('bulb');
  });

  it('returns device for unknown type', () => {
    expect(getDeviceCategory('Unknown device')).toBe('device');
  });

  it('handles null type', () => {
    expect(getDeviceCategory(null)).toBe('device');
  });

  it('handles undefined type', () => {
    expect(getDeviceCategory(undefined)).toBe('device');
  });

  it('handles empty string', () => {
    expect(getDeviceCategory('')).toBe('device');
  });
});

describe('getSensorCategory', () => {
  it('returns motion for presence sensor', () => {
    expect(getSensorCategory('ZLLPresence')).toBe('motion');
  });

  it('returns motion for motion sensor', () => {
    expect(getSensorCategory('ZLLMotion')).toBe('motion');
  });

  it('returns temperature for temperature sensor', () => {
    expect(getSensorCategory('ZLLTemperature')).toBe('temperature');
  });

  it('returns lightlevel for lightlevel sensor', () => {
    expect(getSensorCategory('ZLLLightLevel')).toBe('lightlevel');
  });

  it('returns lightlevel for ambient sensor', () => {
    expect(getSensorCategory('Ambient light')).toBe('lightlevel');
  });

  it('returns daylight for daylight sensor', () => {
    expect(getSensorCategory('Daylight')).toBe('daylight');
  });

  it('returns switch for switch sensor', () => {
    expect(getSensorCategory('ZLLSwitch')).toBe('switch');
  });

  it('returns switch for button sensor', () => {
    expect(getSensorCategory('ZGPButton')).toBe('switch');
  });

  it('returns switch for rotary sensor', () => {
    expect(getSensorCategory('ZLLRotary')).toBe('switch');
  });

  it('returns switch for tap sensor', () => {
    expect(getSensorCategory('ZGPTap')).toBe('switch');
  });

  it('returns sensor for unknown type', () => {
    expect(getSensorCategory('CLIPGenericStatus')).toBe('sensor');
  });

  it('handles null type', () => {
    expect(getSensorCategory(null)).toBe('sensor');
  });

  it('handles undefined type', () => {
    expect(getSensorCategory(undefined)).toBe('sensor');
  });

  it('handles empty string', () => {
    expect(getSensorCategory('')).toBe('sensor');
  });
});
