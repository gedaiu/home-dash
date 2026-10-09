const OCTET_COUNT = 4;
const OCTET_MAX = 255;

const RESERVED_RANGES = [
  { label: '10.0.0.0/8', firstMin: 10, firstMax: 10, secondMin: 0, secondMax: OCTET_MAX },
  { label: '172.16.0.0/12', firstMin: 172, firstMax: 172, secondMin: 16, secondMax: 31 },
  { label: '192.168.0.0/16', firstMin: 192, firstMax: 192, secondMin: 168, secondMax: 168 },
  { label: '169.254.0.0/16', firstMin: 169, firstMax: 169, secondMin: 254, secondMax: 254 },
  { label: '127.0.0.0/8', firstMin: 127, firstMax: 127, secondMin: 0, secondMax: OCTET_MAX },
  { label: '224.0.0.0/4', firstMin: 224, firstMax: 239, secondMin: 0, secondMax: OCTET_MAX },
  { label: '255.0.0.0/8', firstMin: 255, firstMax: 255, secondMin: 0, secondMax: OCTET_MAX },
  { label: '0.0.0.0/8', firstMin: 0, firstMax: 0, secondMin: 0, secondMax: OCTET_MAX }
];

function isPrivateOrReserved(address) {
  const octets = parseOctets(address);

  return octets === null || RESERVED_RANGES.some((range) => isInRange(octets, range));
}

function parseOctets(address) {
  if (!address || typeof address !== 'string') {
    return null;
  }

  const parts = address.split('.').map(Number);
  const isValid = parts.length === OCTET_COUNT && parts.every(isValidOctet);

  return isValid ? parts : null;
}

function isValidOctet(part) {
  return !isNaN(part) && part >= 0 && part <= OCTET_MAX;
}

function isInRange([first, second], range) {
  const isFirstInRange = first >= range.firstMin && first <= range.firstMax;

  return isFirstInRange && second >= range.secondMin && second <= range.secondMax;
}

module.exports = { isPrivateOrReserved };
