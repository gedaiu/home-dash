const DEFAULT_TIMEOUT_MS = 5000;

const dorita980 = require('dorita980');

async function discoverDevice(timeout = DEFAULT_TIMEOUT_MS) {
  return new Promise((resolve) => {
    const timeoutId = setTimeout(() => {
      resolve(null);
    }, timeout);

    dorita980.getRobotIP((err, address) => {
      clearTimeout(timeoutId);
      resolve(err ? null : address);
    });
  });
}

module.exports = {
  discoverDevice
};
