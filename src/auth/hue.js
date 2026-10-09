const { api } = require('node-hue-api');

const APP_NAME = 'hue-nanoleaf-sync';
const DEVICE_NAME = 'cli-scanner';
const LINK_BUTTON_ERROR_TYPE = 101;

async function authenticate(ipAddress, maxRetries = 3) {
  const unauthenticatedApi = await api.createLocal(ipAddress).connect();

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const outcome = await tryCreateUser(unauthenticatedApi, { attempt, maxRetries });

    if (outcome) {
      return outcome;
    }
  }

  return { success: false, error: 'Max retries reached' };
}

async function tryCreateUser(unauthenticatedApi, { attempt, maxRetries }) {
  try {
    const createdUser = await unauthenticatedApi.users.createUser(APP_NAME, DEVICE_NAME);

    return { success: true, username: createdUser.username };
  } catch (err) {
    return failureOutcome(err, { attempt, maxRetries });
  }
}

function failureOutcome(err, { attempt, maxRetries }) {
  if (!isLinkButtonError(err)) {
    return { success: false, error: err.message };
  }

  const hasRetriesLeft = attempt < maxRetries;

  return hasRetriesLeft ? null : { success: false, error: 'Link button not pressed', retriesExhausted: true };
}

function isLinkButtonError(err) {
  return Boolean(err.getHueErrorType) && err.getHueErrorType() === LINK_BUTTON_ERROR_TYPE;
}

module.exports = {
  authenticate,
  APP_NAME,
  DEVICE_NAME
};
