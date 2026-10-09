const crypto = require('crypto');
const aesjs = require('aes-js');

const SECRET_KEY = 'JiangPan';
const DEFAULT_DEVICE_IP = '192.168.1.237';
const COAP_PORT = 5683;
const SALT_HEX_LENGTH = 8;
const DIGEST_HEX_LENGTH = 64;
const SYNC_TOKEN_BYTES = 32;

function resolveDeviceIp() {
  return process.argv[2] || DEFAULT_DEVICE_IP;
}

function createBaseUrl(deviceIp) {
  return `coap://${deviceIp}:${COAP_PORT}`;
}

function createSyncToken() {
  return Buffer.from(crypto.randomBytes(SYNC_TOKEN_BYTES).toString('hex').toUpperCase(), 'utf-8');
}

function createObserveOptions() {
  return { keepAlive: true, confirmable: false, retransmit: true };
}

function createConfirmedOptions() {
  return { keepAlive: true, confirmable: true, retransmit: true };
}

function splitPayload(hexPayload) {
  return {
    saltHex: hexPayload.slice(0, SALT_HEX_LENGTH),
    ciphertextHex: hexPayload.slice(SALT_HEX_LENGTH, -DIGEST_HEX_LENGTH),
    digestHex: hexPayload.slice(-DIGEST_HEX_LENGTH)
  };
}

function computeDigest(saltHex, ciphertextHex) {
  return crypto.createHash('sha256').update(saltHex + ciphertextHex).digest('hex').toUpperCase();
}

function deriveKeyIv(saltHex) {
  const hash = crypto.createHash('md5')
    .update(Buffer.from(SECRET_KEY + saltHex, 'utf-8'))
    .digest('hex')
    .toUpperCase();
  const halfLength = hash.length / 2;

  return {
    key: Buffer.from(hash.substring(0, halfLength), 'utf-8'),
    initVector: Buffer.from(hash.substring(halfLength), 'utf-8')
  };
}

function decryptToText(saltHex, ciphertextHex) {
  const { key, initVector } = deriveKeyIv(saltHex);
  const aesCbc = new aesjs.ModeOfOperation.cbc(key, initVector);
  const decrypted = aesCbc.decrypt(Buffer.from(ciphertextHex, 'hex'));

  const { utf8 } = aesjs.utils;

  return utf8.fromBytes(decrypted);
}

function decryptPayload(hexPayload) {
  const { saltHex, ciphertextHex } = splitPayload(hexPayload);
  const plaintext = decryptToText(saltHex, ciphertextHex);

  return JSON.parse(plaintext.replace(/[\u0000-\u001f]+/g, ''));
}

function delay(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

module.exports = {
  resolveDeviceIp,
  createBaseUrl,
  createSyncToken,
  createObserveOptions,
  createConfirmedOptions,
  splitPayload,
  computeDigest,
  deriveKeyIv,
  decryptToText,
  decryptPayload,
  delay
};
