const fs = require('node:fs');
const path = require('node:path');
const {
  zigzagEncode,
  zigzagDecode,
  encodeHistory,
  decodeHistory,
  getMidnightMs,
  logLightChange
} = require('../../src/services/storage');

const LOGS_DIR = path.join(__dirname, '../../data/logs');

describe('zigzagEncode', () => {
  it('encodes 0 as 0', () => {
    expect(zigzagEncode(0)).toBe(0);
  });

  it('encodes -1 as 1', () => {
    expect(zigzagEncode(-1)).toBe(1);
  });

  it('encodes 1 as 2', () => {
    expect(zigzagEncode(1)).toBe(2);
  });

  it('encodes -2 as 3', () => {
    expect(zigzagEncode(-2)).toBe(3);
  });

  it('encodes 2 as 4', () => {
    expect(zigzagEncode(2)).toBe(4);
  });

  it('encodes positive numbers as even values', () => {
    expect(zigzagEncode(100)).toBe(200);
    expect(zigzagEncode(1000)).toBe(2000);
  });

  it('encodes negative numbers as odd values', () => {
    expect(zigzagEncode(-100)).toBe(199);
    expect(zigzagEncode(-1000)).toBe(1999);
  });
});

describe('zigzagDecode', () => {
  it('decodes 0 as 0', () => {
    expect(zigzagDecode(0)).toBe(0);
  });

  it('decodes 1 as -1', () => {
    expect(zigzagDecode(1)).toBe(-1);
  });

  it('decodes 2 as 1', () => {
    expect(zigzagDecode(2)).toBe(1);
  });

  it('decodes 3 as -2', () => {
    expect(zigzagDecode(3)).toBe(-2);
  });

  it('decodes 4 as 2', () => {
    expect(zigzagDecode(4)).toBe(2);
  });

  it('round-trips positive numbers', () => {
    for (const n of [0, 1, 10, 100, 1000, 10000]) {
      expect(zigzagDecode(zigzagEncode(n))).toBe(n);
    }
  });

  it('round-trips negative numbers', () => {
    for (const n of [-1, -10, -100, -1000, -10000]) {
      expect(zigzagDecode(zigzagEncode(n))).toBe(n);
    }
  });
});

describe('getMidnightMs', () => {
  it('returns midnight timestamp for date string', () => {
    const result = getMidnightMs('2025-12-26');
    const date = new Date(result);

    expect(date.getFullYear()).toBe(2025);
    expect(date.getMonth()).toBe(11);
    expect(date.getDate()).toBe(26);
    expect(date.getHours()).toBe(0);
    expect(date.getMinutes()).toBe(0);
    expect(date.getSeconds()).toBe(0);
    expect(date.getMilliseconds()).toBe(0);
  });
});

describe('encodeHistory', () => {
  const dateStr = '2025-12-26';
  const midnightMs = getMidnightMs(dateStr);

  it('returns empty array for null entries', () => {
    expect(encodeHistory(null, dateStr)).toEqual([]);
  });

  it('returns empty array for empty entries', () => {
    expect(encodeHistory([], dateStr)).toEqual([]);
  });

  it('encodes single entry with time and value', () => {
    const entries = [{ t: midnightMs + 3600 * 1000, v: 24.07 }];
    const encoded = encodeHistory(entries, dateStr);

    expect(encoded.length).toBe(2);
    expect(zigzagDecode(encoded[0])).toBe(3600);
    expect(zigzagDecode(encoded[1])).toBe(2407);
  });

  it('encodes multiple entries as deltas', () => {
    const entries = [
      { t: midnightMs + 3600 * 1000, v: 24.07 },
      { t: midnightMs + 3900 * 1000, v: 23.96 }
    ];
    const encoded = encodeHistory(entries, dateStr);

    expect(encoded.length).toBe(4);
    expect(zigzagDecode(encoded[0])).toBe(3600);
    expect(zigzagDecode(encoded[1])).toBe(2407);
    expect(zigzagDecode(encoded[2])).toBe(300);
    expect(zigzagDecode(encoded[3])).toBe(-11);
  });

  it('skips duplicate values', () => {
    const entries = [
      { t: midnightMs + 3600 * 1000, v: 24.07 },
      { t: midnightMs + 3700 * 1000, v: 24.07 },
      { t: midnightMs + 3800 * 1000, v: 24.07 },
      { t: midnightMs + 3900 * 1000, v: 23.96 }
    ];
    const encoded = encodeHistory(entries, dateStr);

    expect(encoded.length).toBe(4);
  });
});

describe('decodeHistory', () => {
  const dateStr = '2025-12-26';
  const midnightMs = getMidnightMs(dateStr);

  it('returns empty array for null encoded', () => {
    expect(decodeHistory(null, dateStr)).toEqual([]);
  });

  it('returns empty array for empty encoded', () => {
    expect(decodeHistory([], dateStr)).toEqual([]);
  });

  it('decodes single entry', () => {
    const encoded = [zigzagEncode(3600), zigzagEncode(2407)];
    const decoded = decodeHistory(encoded, dateStr);

    expect(decoded).toEqual([
      { t: midnightMs + 3600 * 1000, v: 24.07 }
    ]);
  });

  it('decodes multiple entries with deltas', () => {
    const encoded = [
      zigzagEncode(3600), zigzagEncode(2407),
      zigzagEncode(300), zigzagEncode(-11)
    ];
    const decoded = decodeHistory(encoded, dateStr);

    expect(decoded).toEqual([
      { t: midnightMs + 3600 * 1000, v: 24.07 },
      { t: midnightMs + 3900 * 1000, v: 23.96 }
    ]);
  });
});

describe('encodeHistory and decodeHistory round-trip', () => {
  const dateStr = '2025-12-26';
  const midnightMs = getMidnightMs(dateStr);

  it('round-trips temperature data', () => {
    const entries = [
      { t: midnightMs + 3600 * 1000, v: 24.07 },
      { t: midnightMs + 3900 * 1000, v: 23.96 },
      { t: midnightMs + 4200 * 1000, v: 24.12 },
      { t: midnightMs + 4500 * 1000, v: 24.00 }
    ];

    const encoded = encodeHistory(entries, dateStr);
    const decoded = decodeHistory(encoded, dateStr);

    expect(decoded).toEqual(entries);
  });

  it('round-trips motion sensor data (0/1 values)', () => {
    const entries = [
      { t: midnightMs + 1000 * 1000, v: 0 },
      { t: midnightMs + 1100 * 1000, v: 1 },
      { t: midnightMs + 1200 * 1000, v: 0 },
      { t: midnightMs + 1500 * 1000, v: 1 }
    ];

    const encoded = encodeHistory(entries, dateStr);
    const decoded = decodeHistory(encoded, dateStr);

    expect(decoded).toEqual(entries);
  });

  it('round-trips light level data', () => {
    const entries = [
      { t: midnightMs + 28800 * 1000, v: 15000 },
      { t: midnightMs + 32400 * 1000, v: 25000 },
      { t: midnightMs + 36000 * 1000, v: 30000 }
    ];

    const encoded = encodeHistory(entries, dateStr);
    const decoded = decodeHistory(encoded, dateStr);

    expect(decoded).toEqual(entries);
  });

  it('handles negative value changes', () => {
    const entries = [
      { t: midnightMs + 1000 * 1000, v: 25.00 },
      { t: midnightMs + 2000 * 1000, v: 20.00 },
      { t: midnightMs + 3000 * 1000, v: 15.00 }
    ];

    const encoded = encodeHistory(entries, dateStr);
    const decoded = decodeHistory(encoded, dateStr);

    expect(decoded).toEqual(entries);
  });
});

describe('logLightChange', () => {
  const today = new Date().toISOString().split('T')[0];
  const logFile = path.join(LOGS_DIR, `${today}_lights.log`);

  beforeEach(() => {
    if (fs.existsSync(logFile)) {
      fs.unlinkSync(logFile);
    }
  });

  afterAll(() => {
    if (fs.existsSync(logFile)) {
      fs.unlinkSync(logFile);
    }
  });

  it('creates log file and writes animation mode entry', () => {
    logLightChange('Living Room', { r: 255, g: 128, b: 64 }, 'animation', { on: true, bri: 200 });

    const content = fs.readFileSync(logFile, 'utf-8');
    expect(content).toMatch(/\[Living Room\]/);
    expect(content).toMatch(/RGB\(255,128,64\)/);
    expect(content).toMatch(/animation/);
    expect(content).toMatch(/bri:200/);
  });

  it('writes static mode entry', () => {
    logLightChange('Bedroom', { r: 255, g: 255, b: 200 }, 'static', { on: true, bri: 150 });

    const content = fs.readFileSync(logFile, 'utf-8');
    expect(content).toMatch(/\[Bedroom\]/);
    expect(content).toMatch(/static/);
    expect(content).toMatch(/bri:150/);
  });

  it('writes off state entry', () => {
    logLightChange('Kitchen', { r: 0, g: 0, b: 0 }, 'off', { on: false });

    const content = fs.readFileSync(logFile, 'utf-8');
    expect(content).toMatch(/\[Kitchen\]/);
    expect(content).toMatch(/RGB\(0,0,0\)/);
    expect(content).toMatch(/off OFF/);
  });

  it('appends multiple entries to same file', () => {
    logLightChange('Light1', { r: 100, g: 100, b: 100 }, 'static', { on: true, bri: 100 });
    logLightChange('Light2', { r: 200, g: 200, b: 200 }, 'animation', { on: true, bri: 200 });

    const content = fs.readFileSync(logFile, 'utf-8');
    const lines = content.trim().split('\n');
    expect(lines.length).toBe(2);
    expect(lines[0]).toMatch(/\[Light1\]/);
    expect(lines[1]).toMatch(/\[Light2\]/);
  });
});
