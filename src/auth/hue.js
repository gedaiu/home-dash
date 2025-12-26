const { api } = require('node-hue-api');

const APP_NAME = 'hue-nanoleaf-sync';
const DEVICE_NAME = 'cli-scanner';

async function authenticate(ipAddress, maxRetries = 3) {
  const unauthenticatedApi = await api.createLocal(ipAddress).connect();

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const createdUser = await unauthenticatedApi.users.createUser(APP_NAME, DEVICE_NAME);
      return { success: true, username: createdUser.username };
    } catch (err) {
      const isLinkButtonError = err.getHueErrorType && err.getHueErrorType() === 101;

      if (isLinkButtonError) {
        if (attempt >= maxRetries) {
          return { success: false, error: 'Link button not pressed', retriesExhausted: true };
        }
      } else {
        return { success: false, error: err.message };
      }
    }
  }

  return { success: false, error: 'Max retries reached' };
}

module.exports = {
  authenticate,
  APP_NAME,
  DEVICE_NAME
};
