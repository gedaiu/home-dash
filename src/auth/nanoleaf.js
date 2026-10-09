const DEFAULT_MAX_RETRIES = 3;

async function authenticate(host, port, maxRetries = DEFAULT_MAX_RETRIES) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const outcome = await attemptAuthentication({ host, port, isLastAttempt: attempt >= maxRetries });

    if (outcome) {
      return outcome;
    }
  }

  return { success: false, error: 'Max retries reached' };
}

const axios = require('axios');
const REQUEST_TIMEOUT_MS = 5000;

async function attemptAuthentication({ host, port, isLastAttempt }) {
  try {
    const response = await axios.post(`http://${host}:${port}/api/v1/new`, {}, { timeout: REQUEST_TIMEOUT_MS });
    const authToken = response.data.auth_token;

    if (!authToken) {
      return { success: false, error: 'Invalid response: missing auth_token' };
    }

    return { success: true, authToken };
  } catch (error) {
    return failureForError(error, { host, port, isLastAttempt });
  }
}

const HTTP_FORBIDDEN = 403;

function failureForError(error, { host, port, isLastAttempt }) {
  if (error.response?.status === HTTP_FORBIDDEN) {
    return isLastAttempt ? { success: false, error: 'Not in pairing mode', retriesExhausted: true } : null;
  }

  if (error.code === 'ECONNREFUSED') {
    return { success: false, error: `Cannot connect to ${host}:${port}` };
  }

  return { success: false, error: error.message };
}

module.exports = {
  authenticate
};
