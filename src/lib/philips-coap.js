const crypto = require('crypto');
const aesjs = require('aes-js');

const SECRET_KEY = 'JiangPan';

const KEY_LENGTH = 16;

function deriveKeyIv(salt) {
  const hash = crypto.createHash('md5')
    .update(Buffer.from(SECRET_KEY + salt, 'utf-8'))
    .digest('hex')
    .toUpperCase();

  const key = Buffer.from(hash.substring(0, KEY_LENGTH), 'utf-8');
  const initVector = Buffer.from(hash.substring(KEY_LENGTH), 'utf-8');

  return { key, 'iv': initVector };
}

const SALT_LENGTH = 8;
const DIGEST_LENGTH = 64;
const MIN_PAYLOAD_LENGTH = SALT_LENGTH + DIGEST_LENGTH;

function decrypt(hexPayload) {
  if (!hexPayload || hexPayload.length < MIN_PAYLOAD_LENGTH) {
    return null;
  }

  const salt = hexPayload.slice(0, SALT_LENGTH);
  const ciphertextHex = hexPayload.slice(SALT_LENGTH, -DIGEST_LENGTH);

  if (!ciphertextHex) {
    return null;
  }

  warnOnDigestMismatch({ salt, ciphertextHex, digestHex: hexPayload.slice(-DIGEST_LENGTH) });

  return JSON.parse(decryptCiphertext(salt, ciphertextHex));
}

function warnOnDigestMismatch({ salt, ciphertextHex, digestHex }) {
  const computedDigest = sha256Upper(salt + ciphertextHex);

  if (computedDigest !== digestHex.toUpperCase()) {
    console.warn('[philips-coap] Digest mismatch in received payload');
  }
}

function sha256Upper(text) {
  return crypto.createHash('sha256').update(text).digest('hex').toUpperCase();
}

function decryptCiphertext(salt, ciphertextHex) {
  const { key, iv: initVector } = deriveKeyIv(salt);
  const aesCbc = new aesjs.ModeOfOperation.cbc(key, initVector);
  const decrypted = aesCbc.decrypt(Buffer.from(ciphertextHex, 'hex'));
  const { utf8 } = aesjs.utils;

  return utf8.fromBytes(decrypted).replace(/[\u0000-\u001f]+/g, '');
}

const AES_BLOCK_SIZE = 16;

function encrypt(payload, counter) {
  const jsonBytes = Buffer.from(JSON.stringify(payload), 'utf-8');
  const padLength = AES_BLOCK_SIZE - (jsonBytes.length % AES_BLOCK_SIZE);
  const padded = Buffer.concat([jsonBytes, Buffer.alloc(padLength, padLength)]);

  const { key, iv: initVector } = deriveKeyIv(counter);
  const aesCbc = new aesjs.ModeOfOperation.cbc(key, initVector);
  const ciphertextHex = Buffer.from(aesCbc.encrypt(padded)).toString('hex').toUpperCase();

  return counter + ciphertextHex + sha256Upper(counter + ciphertextHex);
}

const COUNTER_BYTES = 4;

function incrementCounter(counter) {
  const buf = Buffer.from(counter, 'hex');
  const value = (buf.readUInt32BE(0) + 1) >>> 0;
  const outBuf = Buffer.allocUnsafe(COUNTER_BYTES);
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

const MODE_LABELS = {
  'P': 'AUTO',
  'AG': 'ALLERGEN',
  'GT': 'GENTLE',
  'S': 'SLEEP',
  'M': 'MANUAL',
  'T': 'TURBO'
};

const SPEEDS_THREE_STEPS = ['s', '1', '2', '3', 't'];
const SPEEDS_TWO_STEPS = ['s', '1', '2', 't'];

function capabilities({ modeValues, speeds, hasManualMode = false }) {
  return {
    modes: modeValues.map(value => ({ value, label: MODE_LABELS[value] })),
    speeds: [...speeds],
    hasManualMode
  };
}

const MODEL_CAPABILITIES = {
  'default': capabilities({ modeValues: ['P', 'S', 'T'], speeds: SPEEDS_TWO_STEPS }),
  'AC2729': capabilities({ modeValues: ['P', 'AG', 'S', 'M', 'T'], speeds: SPEEDS_THREE_STEPS, hasManualMode: true }),
  'AC2889': capabilities({ modeValues: ['P', 'AG', 'S', 'T'], speeds: SPEEDS_TWO_STEPS }),
  'AC3829': capabilities({ modeValues: ['P', 'S', 'T'], speeds: SPEEDS_TWO_STEPS }),
  'AC2939': capabilities({ modeValues: ['P', 'GT', 'S', 'T'], speeds: SPEEDS_THREE_STEPS })
};

function getModelCapabilities(modelId) {
  if (!modelId) {
    return MODEL_CAPABILITIES['default'];
  }

  const modelKey = Object.keys(MODEL_CAPABILITIES).find(key =>
    key !== 'default' && modelId.toUpperCase().includes(key.toUpperCase())
  );

  return MODEL_CAPABILITIES[modelKey] || MODEL_CAPABILITIES['default'];
}

function parseStatus(payload) {
  const reported = payload?.state?.reported || payload;
  const modelId = falsyToNull(reported.modelid);

  return {
    name: falsyToNull(reported.name),
    model: modelId,
    pwr: reported.pwr,
    mode: falsyToNull(reported.mode),
    'om': falsyToNull(reported.om),
    pm25: undefinedToNull(reported.pm25),
    iaql: undefinedToNull(reported.iaql),
    tvoc: undefinedToNull(reported.tvoc),
    aqil: undefinedToNull(reported.aqil),
    uil: reported.uil,
    'cl': reported.cl,
    fltsts0: undefinedToNull(reported.fltsts0),
    flttotal0: undefinedToNull(reported.flttotal0),
    fltsts1: undefinedToNull(reported.fltsts1),
    flttotal1: undefinedToNull(reported.flttotal1),
    fltsts2: undefinedToNull(reported.fltsts2),
    flttotal2: undefinedToNull(reported.flttotal2),
    runtime: undefinedToNull(reported.Runtime),
    err: undefinedToNull(reported.err),
    capabilities: getModelCapabilities(modelId)
  };
}

function falsyToNull(value) {
  return value || null;
}

function undefinedToNull(value) {
  return value ?? null;
}

module.exports = {
  SECRET_KEY,
  deriveKeyIv,
  decrypt,
  encrypt,
  incrementCounter,
  buildCommand,
  parseStatus,
  getModelCapabilities,
  MODEL_CAPABILITIES
};
