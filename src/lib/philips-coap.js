const crypto = require('crypto');
const aesjs = require('aes-js');

const SECRET_KEY = 'JiangPan';

function deriveKeyIv(salt) {
  const hash = crypto.createHash('md5')
    .update(Buffer.from(SECRET_KEY + salt, 'utf-8'))
    .digest('hex')
    .toUpperCase();

  const key = Buffer.from(hash.substring(0, 16), 'utf-8');
  const iv = Buffer.from(hash.substring(16), 'utf-8');

  return { key, iv };
}

function decrypt(hexPayload) {
  if (!hexPayload || hexPayload.length < 72) {
    return null;
  }

  const salt = hexPayload.slice(0, 8);
  const ciphertextHex = hexPayload.slice(8, -64);
  const digestHex = hexPayload.slice(-64);

  if (!ciphertextHex || ciphertextHex.length === 0) {
    return null;
  }

  const computedDigest = crypto.createHash('sha256')
    .update(salt + ciphertextHex)
    .digest('hex')
    .toUpperCase();

  if (computedDigest !== digestHex.toUpperCase()) {
    console.warn('[philips-coap] Digest mismatch in received payload');
  }

  const { key, iv } = deriveKeyIv(salt);
  const ciphertext = Buffer.from(ciphertextHex, 'hex');
  const aesCbc = new aesjs.ModeOfOperation.cbc(key, iv);
  const decrypted = aesCbc.decrypt(ciphertext);

  const plaintext = aesjs.utils.utf8.fromBytes(decrypted);
  const cleaned = plaintext.replace(/[\u0000-\u001f]+/g, '');

  return JSON.parse(cleaned);
}

function encrypt(data, counter) {
  const jsonStr = JSON.stringify(data);
  const jsonBytes = Buffer.from(jsonStr, 'utf-8');

  const blockSize = 16;
  const padLength = blockSize - (jsonBytes.length % blockSize);
  const padded = Buffer.concat([jsonBytes, Buffer.alloc(padLength, padLength)]);

  const { key, iv } = deriveKeyIv(counter);
  const aesCbc = new aesjs.ModeOfOperation.cbc(key, iv);
  const encrypted = aesCbc.encrypt(padded);

  const ciphertextHex = Buffer.from(encrypted).toString('hex').toUpperCase();
  const digest = crypto.createHash('sha256')
    .update(counter + ciphertextHex)
    .digest('hex')
    .toUpperCase();

  return counter + ciphertextHex + digest;
}

function incrementCounter(counter) {
  const buf = Buffer.from(counter, 'hex');
  const value = (buf.readUInt32BE(0) + 1) >>> 0;
  const outBuf = Buffer.allocUnsafe(4);
  outBuf.writeUInt32BE(value, 0);
  return outBuf.toString('hex').toUpperCase();
}

function buildCommand(key, value) {
  return {
    state: {
      desired: {
        CommandType: 'app',
        DeviceId: '',
        EnduserId: '',
        [key]: value
      }
    }
  };
}

function parseStatus(data) {
  const reported = data?.state?.reported || data;

  return {
    name: reported.name || null,
    model: reported.modelid || null,
    pwr: reported.pwr,
    mode: reported.mode || null,
    om: reported.om || null,
    pm25: reported.pm25 ?? null,
    iaql: reported.iaql ?? null,
    tvoc: reported.tvoc ?? null,
    aqil: reported.aqil ?? null,
    uil: reported.uil,
    cl: reported.cl,
    fltsts0: reported.fltsts0 ?? null,
    flttotal0: reported.flttotal0 ?? null,
    fltsts1: reported.fltsts1 ?? null,
    flttotal1: reported.flttotal1 ?? null,
    fltsts2: reported.fltsts2 ?? null,
    flttotal2: reported.flttotal2 ?? null,
    runtime: reported.Runtime ?? null,
    err: reported.err ?? null
  };
}

module.exports = {
  SECRET_KEY,
  deriveKeyIv,
  decrypt,
  encrypt,
  incrementCounter,
  buildCommand,
  parseStatus
};
