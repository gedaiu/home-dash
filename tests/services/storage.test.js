const fs = require('node:fs');
let logLightChange;
let load;
let save;
let getHue;
let setHue;
let getNanoleaf;
let setNanoleaf;
let getSync;
let setSync;
let getRoomba;
let setRoomba;

beforeAll(async () => {
  ({
    logLightChange, load, save, getHue, setHue, getNanoleaf, setNanoleaf, getSync, setSync, getRoomba, setRoomba
  } = await import('../../src/services/storage'));
});

const path = require('node:path');

const LOGS_DIR = path.join(__dirname, '../../data/logs');
const TEST_CONFIG_FILE = path.join(__dirname, '../../data/test-config.json');
const FAKE_NOW = new Date('2025-12-26T10:15:30.123Z');
const LOG_FILE = path.join(LOGS_DIR, '2025-12-26_lights.log');
const EMPTY_CONFIG = { hue: null, nanoleaf: null, sync: null };

function removeIfExists(filePath) {
  fs.rmSync(filePath, { force: true });
}

function readLogLines() {
  return fs.readFileSync(LOG_FILE, 'utf-8').trim().split('\n');
}

describe('logLightChange', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(FAKE_NOW);
    removeIfExists(LOG_FILE);
  });

  afterEach(() => {
    jest.useRealTimers();
    removeIfExists(LOG_FILE);
  });

  it('writes Living Room animation entry with RGB(255,128,64) and bri:200', () => {
    logLightChange('Living Room', { 'r': 255, 'g': 128, 'b': 64 }, 'animation', { 'on': true, bri: 200 });

    expect(readLogLines()).toEqual(['10:15:30.123 [Living Room] RGB(255,128,64) animation bri:200']);
  });

  it('writes Bedroom static entry with bri:150', () => {
    logLightChange('Bedroom', { 'r': 255, 'g': 255, 'b': 200 }, 'static', { 'on': true, bri: 150 });

    expect(readLogLines()).toEqual(['10:15:30.123 [Bedroom] RGB(255,255,200) static bri:150']);
  });

  it('writes Kitchen off entry with OFF state', () => {
    logLightChange('Kitchen', { 'r': 0, 'g': 0, 'b': 0 }, 'off', { 'on': false });

    expect(readLogLines()).toEqual(['10:15:30.123 [Kitchen] RGB(0,0,0) off OFF']);
  });

  it('appends Light1 and Light2 entries to the same file in order', () => {
    logLightChange('Light1', { 'r': 100, 'g': 100, 'b': 100 }, 'static', { 'on': true, bri: 100 });
    logLightChange('Light2', { 'r': 200, 'g': 200, 'b': 200 }, 'animation', { 'on': true, bri: 200 });

    expect(readLogLines()).toEqual([
      '10:15:30.123 [Light1] RGB(100,100,100) static bri:100',
      '10:15:30.123 [Light2] RGB(200,200,200) animation bri:200'
    ]);
  });
});

describe('storage CRUD operations', () => {
  beforeEach(() => {
    removeIfExists(TEST_CONFIG_FILE);
  });

  afterAll(() => {
    removeIfExists(TEST_CONFIG_FILE);
  });

  describe('load and save', () => {
    it('load returns null hue, nanoleaf and sync when file does not exist', () => {
      expect(load()).toEqual(EMPTY_CONFIG);
    });

    it('save then load returns the saved hue, nanoleaf and sync config', () => {
      const testConfig = {
        hue: { 'ip': '1.2.3.4', username: 'test' },
        nanoleaf: { 'ip': '5.6.7.8', authToken: 'token' },
        sync: { hueDeviceId: 1 }
      };
      save(testConfig);

      expect(load()).toMatchObject(testConfig);
    });
  });

  describe.each([
    { name: 'Hue', getter: 'getHue', setter: 'setHue', sample: { 'ip': '192.168.1.100', username: 'hue-user' } },
    { name: 'Nanoleaf', getter: 'getNanoleaf', setter: 'setNanoleaf', sample: { 'ip': '192.168.1.101', port: 16021, authToken: 'auth-token' } },
    { name: 'Sync', getter: 'getSync', setter: 'setSync', sample: { hueDeviceId: 5, hueDeviceName: 'Test Light' } },
    { name: 'Roomba', getter: 'getRoomba', setter: 'setRoomba', sample: { 'ip': '192.168.1.102', blid: 'blid123', password: 'pass' } }
  ])('$name config', ({ name, getter, setter, sample }) => {
    const accessors = () => ({ getHue, setHue, getNanoleaf, setNanoleaf, getSync, setSync, getRoomba, setRoomba });
    const getConfig = () => accessors()[getter]();
    const setConfig = (value) => accessors()[setter](value);

    it(`get${name} returns null when not set`, () => {
      save(EMPTY_CONFIG);

      expect(getConfig()).toBeNull();
    });

    it(`set${name} stores config`, () => {
      setConfig(sample);

      expect(getConfig()).toEqual(sample);
    });
  });
});
