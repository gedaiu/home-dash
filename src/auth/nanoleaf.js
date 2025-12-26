const axios = require('axios');

async function authenticate(ip, port, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await axios.post(`http://${ip}:${port}/api/v1/new`, {}, { timeout: 5000 });
      const authToken = response.data.auth_token;

      if (!authToken) {
        return { success: false, error: 'Invalid response: missing auth_token' };
      }

      return { success: true, authToken };
    } catch (err) {
      if (err.response?.status === 403) {
        if (attempt >= maxRetries) {
          return { success: false, error: 'Not in pairing mode', retriesExhausted: true };
        }
      } else if (err.code === 'ECONNREFUSED') {
        return { success: false, error: `Cannot connect to ${ip}:${port}` };
      } else {
        return { success: false, error: err.message };
      }
    }
  }

  return { success: false, error: 'Max retries reached' };
}

module.exports = {
  authenticate
};
