let zigzagEncode;
let zigzagDecode;
let encodeHistory;
let decodeHistory;
let getMidnightMs;

beforeAll(async () => {
  ({ zigzagEncode, zigzagDecode, encodeHistory, decodeHistory, getMidnightMs } = await import('../../src/services/storage'));
});

const DATE_STRING = '2025-12-26';
const MS_PER_SECOND = 1000;

function entryAt(secondsSinceMidnight, value) {
  return { 't': getMidnightMs(DATE_STRING) + secondsSinceMidnight * MS_PER_SECOND, 'v': value };
}

describe('zigzagEncode', () => {
  it.each([
    [0, 0],
    [-1, 1],
    [1, 2],
    [-2, 3],
    [2, 4],
    [100, 200],
    [1000, 2000],
    [-100, 199],
    [-1000, 1999]
  ])('encodes %i as %i', (input, expected) => {
    expect(zigzagEncode(input)).toBe(expected);
  });
});

describe('zigzagDecode', () => {
  it.each([
    [0, 0],
    [1, -1],
    [2, 1],
    [3, -2],
    [4, 2]
  ])('decodes %i as %i', (input, expected) => {
    expect(zigzagDecode(input)).toBe(expected);
  });

  it.each([0, 1, 10, 100, 1000, 10000, -1, -10, -100, -1000, -10000])(
    'round-trips %i through encode and decode',
    (value) => {
      expect(zigzagDecode(zigzagEncode(value))).toBe(value);
    }
  );
});

describe('getMidnightMs', () => {
  it('returns local midnight for 2025-12-26', () => {
    const midnight = new Date(getMidnightMs(DATE_STRING));

    expect({
      year: midnight.getFullYear(),
      month: midnight.getMonth(),
      day: midnight.getDate(),
      hours: midnight.getHours(),
      minutes: midnight.getMinutes(),
      seconds: midnight.getSeconds(),
      milliseconds: midnight.getMilliseconds()
    }).toEqual({ year: 2025, month: 11, day: 26, hours: 0, minutes: 0, seconds: 0, milliseconds: 0 });
  });
});

describe('encodeHistory', () => {
  it('returns empty array for null entries', () => {
    expect(encodeHistory(null, DATE_STRING)).toEqual([]);
  });

  it('returns empty array for empty entries', () => {
    expect(encodeHistory([], DATE_STRING)).toEqual([]);
  });

  it('encodes single entry at 3600s with value 24.07 as time and value deltas', () => {
    const encoded = encodeHistory([entryAt(3600, 24.07)], DATE_STRING);

    expect(encoded.map(zigzagDecode)).toEqual([3600, 2407]);
  });

  it('encodes entries at 3600s and 3900s as deltas of 300s and -0.11', () => {
    const entries = [entryAt(3600, 24.07), entryAt(3900, 23.96)];

    expect(encodeHistory(entries, DATE_STRING).map(zigzagDecode)).toEqual([3600, 2407, 300, -11]);
  });

  it('skips repeated value 24.07 between changes', () => {
    const entries = [
      entryAt(3600, 24.07),
      entryAt(3700, 24.07),
      entryAt(3800, 24.07),
      entryAt(3900, 23.96)
    ];

    expect(encodeHistory(entries, DATE_STRING).map(zigzagDecode)).toEqual([3600, 2407, 300, -11]);
  });
});

describe('decodeHistory', () => {
  it('returns empty array for null encoded', () => {
    expect(decodeHistory(null, DATE_STRING)).toEqual([]);
  });

  it('returns empty array for empty encoded', () => {
    expect(decodeHistory([], DATE_STRING)).toEqual([]);
  });

  it('decodes single pair 3600s and 24.07 into one entry', () => {
    const encoded = [zigzagEncode(3600), zigzagEncode(2407)];

    expect(decodeHistory(encoded, DATE_STRING)).toEqual([entryAt(3600, 24.07)]);
  });

  it('decodes two pairs with deltas into two entries', () => {
    const encoded = [3600, 2407, 300, -11].map(zigzagEncode);

    expect(decodeHistory(encoded, DATE_STRING)).toEqual([entryAt(3600, 24.07), entryAt(3900, 23.96)]);
  });
});

describe('encodeHistory then decodeHistory', () => {
  it.each([
    { name: 'temperature data', entries: [[3600, 24.07], [3900, 23.96], [4200, 24.12], [4500, 24]] },
    { name: 'motion sensor data of 0 and 1', entries: [[1000, 0], [1100, 1], [1200, 0], [1500, 1]] },
    { name: 'light level data', entries: [[28800, 15000], [32400, 25000], [36000, 30000]] },
    { name: 'falling values', entries: [[1000, 25], [2000, 20], [3000, 15]] }
  ])('round-trips $name', ({ entries: points }) => {
    const entries = points.map(([seconds, value]) => entryAt(seconds, value));
    const decoded = decodeHistory(encodeHistory(entries, DATE_STRING), DATE_STRING);

    expect(decoded).toEqual(entries);
  });
});
