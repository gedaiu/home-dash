const SIGN_SHIFT = 31;
const VALUE_SCALE = 100;
const MS_PER_SECOND = 1000;
const PAIR_STRIDE = 2;
const TIME_KEY = 't';
const VALUE_KEY = 'v';

function encodeHistory(entries, dateStr) {
  if (!entries || entries.length === 0) {
    return [];
  }

  const midnightMs = getMidnightMs(dateStr);
  const encoded = [];
  const previous = { time: 0, value: null };

  for (const entry of entries) {
    if (previous.value === null || entry.v !== previous.value) {
      const [timeCode, valueCode, secSinceMidnight] = encodeChange(entry, previous, midnightMs);
      encoded.push(timeCode, valueCode);
      previous.time = secSinceMidnight;
      previous.value = entry.v;
    }
  }

  return encoded;
}

function encodeChange(entry, previous, midnightMs) {
  const secSinceMidnight = Math.floor((entry.t - midnightMs) / MS_PER_SECOND);
  const timeDelta = previous.time === 0 ? secSinceMidnight : secSinceMidnight - previous.time;
  const valueDelta = previous.value === null ? entry.v : entry.v - previous.value;

  return [
    zigzagEncode(timeDelta),
    zigzagEncode(Math.round(valueDelta * VALUE_SCALE)),
    secSinceMidnight
  ];
}

function zigzagEncode(value) {
  return (value << 1) ^ (value >> SIGN_SHIFT);
}

function decodeHistory(encoded, dateStr) {
  if (!encoded || encoded.length === 0) {
    return [];
  }

  const midnightMs = getMidnightMs(dateStr);
  const entries = [];
  let currentTime = 0;
  let currentValue = 0;

  for (let index = 0; index < encoded.length; index += PAIR_STRIDE) {
    const valueDelta = zigzagDecode(encoded[index + 1]) / VALUE_SCALE;
    currentTime += zigzagDecode(encoded[index]);
    currentValue = entries.length === 0 ? valueDelta : currentValue + valueDelta;
    entries.push({ [TIME_KEY]: midnightMs + currentTime * MS_PER_SECOND, [VALUE_KEY]: currentValue });
  }

  return entries;
}

function zigzagDecode(value) {
  return (value >>> 1) ^ -(value & 1);
}

function getMidnightMs(date) {
  const midnight = new Date(date);
  midnight.setHours(0, 0, 0, 0);

  return midnight.getTime();
}

module.exports = { zigzagEncode, zigzagDecode, encodeHistory, decodeHistory, getMidnightMs };
