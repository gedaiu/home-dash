const BLID_TIMEOUT_MS = 5000;
const PASSWORD_TIMEOUT_MS = 10000;

async function authenticate(host, log = console.log) {
  try {
    log('Step 1/2: Getting robot BLID...');
    const blid = await getBlid(host, BLID_TIMEOUT_MS, log);

    log('Step 2/2: Getting robot password...');
    const password = await getPassword(host, PASSWORD_TIMEOUT_MS, log);

    log('Authentication complete!');

    return { success: true, blid, password };
  } catch (err) {
    log(`Authentication failed: ${err.message}`);

    return { success: false, error: err.message };
  }
}

const DEFAULT_TIMEOUT_MS = 10000;
const dorita980 = require('dorita980');

async function getBlid(host, timeout = DEFAULT_TIMEOUT_MS, log = () => {}) {
  log(`Connecting to Roomba at ${host} to get BLID (UDP port 5678)...`);
  log('Note: Roomba must be awake and broadcasting. Try pressing CLEAN button once.');

  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      log('Timeout waiting for robot info.');
      log('The Roomba may be asleep or not broadcasting.');
      reject(new Error('Timeout getting robot info - Roomba not responding on UDP 5678'));
    }, timeout);

    dorita980.getRobotPublicInfo(host, (err, robotInfo) => {
      clearTimeout(timeoutId);

      if (err) {
        log(`Error getting robot info: ${err.message}`);
        reject(err);

        return;
      }

      log(`Got robot info - Name: ${robotInfo.robotname || 'unknown'}, BLID: ${robotInfo.blid}`);
      resolve(robotInfo.blid);
    });
  });
}

const TLS_PORT = 8883;

async function getPassword(host, timeout = DEFAULT_TIMEOUT_MS, log = () => {}) {
  log(`Connecting to Roomba at ${host}:${TLS_PORT} via TLS to get password...`);

  return new Promise((resolve, reject) => {
    const client = openCredentialSocket({ host, timeout, log });

    client.on('data', createPasswordReader({ client, log, resolve, reject }));

    client.on('error', (err) => {
      log(`TLS connection error: ${err.message}`);
      reject(err);
    });

    client.on('timeout', () => {
      log('TLS connection timed out');
      client.end();
      reject(new Error('Connection timed out'));
    });

    client.setEncoding('utf-8');
  });
}

const tls = require('node:tls');
const CREDENTIAL_REQUEST_PACKET = 'f005efcc3b2900';

function openCredentialSocket({ host, timeout, log }) {
  const client = tls.connect(TLS_PORT, host, {
    timeout,
    rejectUnauthorized: false,
    ciphers: 'AES128-SHA256',
    secureOptions: require('node:crypto').constants.SSL_OP_LEGACY_SERVER_CONNECT
  }, () => {
    log('TLS connection established, sending credential request...');
    client.write(Buffer.from(CREDENTIAL_REQUEST_PACKET, 'hex'));
  });

  return client;
}

const ACKNOWLEDGEMENT_LENGTH = 2;
const MAX_INVALID_RESPONSE_LENGTH = 7;
const PASSWORD_OFFSET = 13;
const PASSWORD_OFFSET_AFTER_ACKNOWLEDGEMENT = 9;

function createPasswordReader({ client, log, resolve, reject }) {
  let sliceFrom = PASSWORD_OFFSET;

  return (chunk) => {
    log(`Received data: ${chunk.length} bytes`);

    if (chunk.length === ACKNOWLEDGEMENT_LENGTH) {
      log('Received acknowledgement, waiting for password...');
      sliceFrom = PASSWORD_OFFSET_AFTER_ACKNOWLEDGEMENT;

      return;
    }

    if (chunk.length <= MAX_INVALID_RESPONSE_LENGTH) {
      log('Received invalid response (too short). Roomba may not be in pairing mode.');
      client.end();
      reject(new Error('Could not get password. Make sure you followed the instructions.'));

      return;
    }

    const password = Buffer.from(chunk).slice(sliceFrom).toString();
    log(`Password received successfully (${password.length} characters)`);
    client.end();
    resolve(password);
  };
}

module.exports = {
  authenticate,
  getBlid,
  getPassword
};
