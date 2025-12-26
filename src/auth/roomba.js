const tls = require('node:tls');
const dorita980 = require('dorita980');

async function getBlid(ip, timeout = 10000, log = () => {}) {
  log(`Connecting to Roomba at ${ip} to get BLID (UDP port 5678)...`);
  log('Note: Roomba must be awake and broadcasting. Try pressing CLEAN button once.');

  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      log('Timeout waiting for robot info.');
      log('The Roomba may be asleep or not broadcasting.');
      reject(new Error('Timeout getting robot info - Roomba not responding on UDP 5678'));
    }, timeout);

    dorita980.getRobotPublicInfo(ip, (err, data) => {
      clearTimeout(timeoutId);
      if (err) {
        log(`Error getting robot info: ${err.message}`);
        reject(err);
      } else {
        log(`Got robot info - Name: ${data.robotname || 'unknown'}, BLID: ${data.blid}`);
        resolve(data.blid);
      }
    });
  });
}

async function getPassword(ip, timeout = 10000, log = () => {}) {
  log(`Connecting to Roomba at ${ip}:8883 via TLS to get password...`);

  return new Promise((resolve, reject) => {
    let sliceFrom = 13;
    const packet = 'f005efcc3b2900';

    const client = tls.connect(8883, ip, {
      timeout,
      rejectUnauthorized: false,
      ciphers: 'AES128-SHA256',
      secureOptions: require('node:crypto').constants.SSL_OP_LEGACY_SERVER_CONNECT
    }, () => {
      log('TLS connection established, sending credential request...');
      client.write(Buffer.from(packet, 'hex'));
    });

    client.on('data', (data) => {
      log(`Received data: ${data.length} bytes`);

      if (data.length === 2) {
        log('Received acknowledgement, waiting for password...');
        sliceFrom = 9;
        return;
      }

      if (data.length <= 7) {
        log('Received invalid response (too short). Roomba may not be in pairing mode.');
        client.end();
        reject(new Error('Could not get password. Make sure you followed the instructions.'));
      } else {
        const password = Buffer.from(data).slice(sliceFrom).toString();
        log(`Password received successfully (${password.length} characters)`);
        client.end();
        resolve(password);
      }
    });

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

async function authenticate(ip, log = console.log) {
  try {
    log('Step 1/2: Getting robot BLID...');
    const blid = await getBlid(ip, 5000, log);

    log('Step 2/2: Getting robot password...');
    const password = await getPassword(ip, 10000, log);

    log('Authentication complete!');
    return { success: true, blid, password };
  } catch (err) {
    log(`Authentication failed: ${err.message}`);
    return { success: false, error: err.message };
  }
}

module.exports = {
  authenticate,
  getBlid,
  getPassword
};
