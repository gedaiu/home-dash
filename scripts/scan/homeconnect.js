const readline = require('readline-sync');
const storage = require('../../src/services/storage');

const INSTRUCTION_LINES = [
  '\n=== Home Connect Configuration ===',
  'Home Connect requires cloud API access from Bosch/Siemens.',
  '',
  'To get started:',
  '1. Go to https://developer.home-connect.com',
  '2. Create an account and register a new application',
  '3. Select "Authorization Code Grant Flow" as OAuth Flow',
  '4. Set Redirect URI to: http://localhost:3000/api/homeconnect/auth/callback',
  ''
];

function configureHomeConnect() {
  INSTRUCTION_LINES.forEach(line => console.log(line));

  const clientId = readline.question('Enter your Client ID (or press Enter to skip): ');

  if (!clientId) {
    return skipHomeConnect();
  }

  const clientSecret = readline.question('Enter your Client Secret: ');

  if (!clientSecret) {
    return skipHomeConnect();
  }

  storage.setHomeConnect({ clientId, clientSecret, tokens: null });

  console.log('Home Connect credentials saved.');
  console.log('After starting the server, complete authentication via the web UI.');

  return true;
}

function skipHomeConnect() {
  console.log('Skipping Home Connect configuration.');

  return false;
}

module.exports = { configureHomeConnect };
