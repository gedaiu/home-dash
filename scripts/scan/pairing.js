const readline = require('readline-sync');

const MAX_PAIRING_ATTEMPTS = 3;

async function pairWithRetries(pairing) {
  for (let attempt = 1; attempt <= MAX_PAIRING_ATTEMPTS; attempt++) {
    readline.question(pairing.prompt);

    const result = await pairing.authenticate();

    if (result.success) {
      console.log(pairing.successMessage);
      pairing.saveCredentials(result);

      return true;
    }

    if (!result.retriesExhausted) {
      console.log('Authentication failed: ' + result.error);

      return false;
    }

    reportPending(pairing, attempt);
  }

  console.log(pairing.exhaustedMessage);

  return false;
}

function reportPending(pairing, attempt) {
  console.log(`${pairing.pendingMessage} (attempt ${attempt}/${MAX_PAIRING_ATTEMPTS})`);

  if (attempt < MAX_PAIRING_ATTEMPTS) {
    console.log(pairing.retryMessage);
  }
}

module.exports = { pairWithRetries };
