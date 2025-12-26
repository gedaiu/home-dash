const dorita980 = require('dorita980');

async function discoverDevice(timeout = 5000) {
  return new Promise((resolve) => {
    const timeoutId = setTimeout(() => {
      resolve(null);
    }, timeout);

    dorita980.getRobotIP((err, ip) => {
      clearTimeout(timeoutId);

      if (err) {
        resolve(null);
      } else {
        resolve(ip);
      }
    });
  });
}

module.exports = {
  discoverDevice
};
