const IPV4_OCTET_COUNT = 4;
const LOOPBACK_FIRST_OCTET = 127;
const CLASS_A_PRIVATE_FIRST_OCTET = 10;
const CLASS_B_PRIVATE_FIRST_OCTET = 172;
const CLASS_B_PRIVATE_SECOND_MIN = 16;
const CLASS_B_PRIVATE_SECOND_MAX = 31;
const CLASS_C_PRIVATE_FIRST_OCTET = 192;
const CLASS_C_PRIVATE_SECOND_OCTET = 168;

function isPrivateIP(address) {
  const octets = address.split('.').map(Number);

  if (octets.length !== IPV4_OCTET_COUNT) {
    return false;
  }

  const [first, second] = octets;

  return first === CLASS_A_PRIVATE_FIRST_OCTET
    || first === LOOPBACK_FIRST_OCTET
    || isClassBPrivate(first, second)
    || isClassCPrivate(first, second);
}

function isClassBPrivate(first, second) {
  return first === CLASS_B_PRIVATE_FIRST_OCTET
    && second >= CLASS_B_PRIVATE_SECOND_MIN
    && second <= CLASS_B_PRIVATE_SECOND_MAX;
}

function isClassCPrivate(first, second) {
  return first === CLASS_C_PRIVATE_FIRST_OCTET && second === CLASS_C_PRIVATE_SECOND_OCTET;
}

module.exports = { isPrivateIP };
