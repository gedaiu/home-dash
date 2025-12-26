#!/usr/bin/env node

const crypto = require('node:crypto');
const https = require('node:https');
const http = require('node:http');
const readline = require('node:readline');
const storage = require('./src/services/storage');

// Cloud API endpoints
const ENDPOINTS = {
  login: 'https://www.ecdinterface.philips.com/DevicePortalICPRequestHandler/RequestHandler.ashx',
  provision: 'https://kps.dc1.philips.com/KpsRequestHandler/index.ashx',
  pairing: 'http://ps.dc1.philips.com/PSRequestHandler/index.ashx',
  events: 'https://ep.dcs.dc1.philips.com/DCS.EventPublisherService/Services/External/json'
};

// Hardcoded credentials from py-air-control
const INITIAL_CLIENT_ID = '000000fff0000019';
const INITIAL_CLIENT_KEY = 'QR3FiHoEQcSZ9S5XxsZwXQ==';
const PAIRING_SECRET = 'ad388b4036986421';

class CloudSetup {
  constructor() {
    this.clientId = null;
    this.clientKey = null;
    this.ssoKey = null;
    this.deviceId = null;
    this.deviceIp = null;
  }

  async prompt(question) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    return new Promise((resolve) => {
      rl.question(question, (answer) => {
        rl.close();
        resolve(answer.trim());
      });
    });
  }

  async waitForEnter(message) {
    await this.prompt(message + ' Press Enter to continue...');
  }

  generateNonce() {
    return crypto.randomBytes(16).toString('hex');
  }

  generateHmac(key, data) {
    return crypto.createHmac('sha1', Buffer.from(key, 'base64'))
      .update(data)
      .digest('base64');
  }

  async httpRequest(url, method, body, headers = {}) {
    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      const isHttps = urlObj.protocol === 'https:';
      const lib = isHttps ? https : http;

      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port || (isHttps ? 443 : 80),
        path: urlObj.pathname + urlObj.search,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers
        }
      };

      const req = lib.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(data) });
          } catch {
            resolve({ status: res.statusCode, data });
          }
        });
      });

      req.on('error', reject);
      req.setTimeout(30000, () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      if (body) {
        const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
        req.write(bodyStr);
      }
      req.end();
    });
  }

  async createCloudAccount() {
    console.log('\n=== Step 2: Creating Cloud Account ===\n');
    console.log('Creating a cloud account to communicate with your device...');

    // First login to get SSO credentials
    const nonce = this.generateNonce();
    const loginRequest = {
      DevicePortalICPRequest: {
        Header: {
          Application: 'Air',
          ClientId: INITIAL_CLIENT_ID,
          Version: '1.0'
        },
        LoginByICP: {
          DeviceType: 'A'
        }
      }
    };

    const signature = this.generateHmac(INITIAL_CLIENT_KEY, JSON.stringify(loginRequest));
    const authHeader = `CBAuth client_id="${INITIAL_CLIENT_ID}",nonce="${nonce}",signature="${signature}",type="HMACSHA1"`;

    try {
      const loginResponse = await this.httpRequest(ENDPOINTS.login, 'POST', loginRequest, {
        'Authorization': authHeader
      });

      if (loginResponse.data?.DevicePortalICPResponse?.LoginByICP) {
        const loginData = loginResponse.data.DevicePortalICPResponse.LoginByICP;
        this.ssoKey = loginData.SSOKey;
        console.log('SSO login successful');

        // Now provision new client credentials
        await this.provisionAccount();
        return true;
      }

      console.error('Login failed:', loginResponse.data);
      return false;
    } catch (err) {
      console.error('Error creating cloud account:', err.message);
      return false;
    }
  }

  async provisionAccount() {
    const nonce = this.generateNonce();
    const provisionRequest = {
      KPSProvisionRequest: {
        Header: {
          Application: 'Air',
          Version: '1.0'
        },
        ProvisionRequest: {}
      }
    };

    const signature = this.generateHmac(this.ssoKey, JSON.stringify(provisionRequest));
    const authHeader = `SSO sso_key="${this.ssoKey}",nonce="${nonce}",signature="${signature}",type="HMACSHA1"`;

    try {
      const response = await this.httpRequest(ENDPOINTS.provision, 'POST', provisionRequest, {
        'Authorization': authHeader
      });

      if (response.data?.KPSProvisionResponse?.ProvisionResponse) {
        const provision = response.data.KPSProvisionResponse.ProvisionResponse;
        this.clientId = provision.ClientId;
        this.clientKey = provision.ClientKey;
        console.log('Account provisioned successfully');
        console.log('Client ID:', this.clientId);
        return true;
      }

      console.error('Provisioning failed:', response.data);
      return false;
    } catch (err) {
      console.error('Error provisioning account:', err.message);
      return false;
    }
  }

  async getDeviceInfo() {
    console.log(`\nRetrieving device information from ${this.deviceIp}...`);

    // Try to get WiFi info which contains the device ID
    try {
      const response = await this.httpRequest(`http://${this.deviceIp}/di/v1/products/1/wifi`, 'GET');

      if (response.data) {
        this.deviceId = response.data.DeviceId || response.data.deviceid;
        console.log('Device ID:', this.deviceId);
        return true;
      }
    } catch {
      // Device might use encrypted communication
    }

    // Try security endpoint for DH key exchange
    try {
      const response = await this.httpRequest(`http://${this.deviceIp}/di/v1/products/1/security`, 'GET');
      console.log('Device supports HTTP with encryption');
    } catch {
      console.log('Device does not respond to HTTP on port 80');
    }

    return false;
  }

  async pairDevice() {
    console.log('\n=== Step 4: Pairing Device with Cloud Account ===\n');

    if (!this.deviceId) {
      console.error('Device ID not available. Please ensure the device is in pairing mode.');
      return false;
    }

    const nonce = this.generateNonce();
    const pairingRequest = {
      PSRequest: {
        Header: {
          Application: 'Air',
          ClientId: this.clientId,
          Version: '1.0'
        },
        AddRelationshipRequest: {
          Trustor: this.clientId,
          Trustee: this.deviceId,
          TrusteeType: 'ProductArray',
          Secret: PAIRING_SECRET
        }
      }
    };

    const signature = this.generateHmac(this.clientKey, JSON.stringify(pairingRequest));
    const authHeader = `CBAuth client_id="${this.clientId}",nonce="${nonce}",signature="${signature}",type="HMACSHA1"`;

    try {
      const response = await this.httpRequest(ENDPOINTS.pairing, 'POST', pairingRequest, {
        'Authorization': authHeader
      });

      if (response.data?.PSResponse?.AddRelationshipResponse?.Result === 'Success') {
        console.log('Device paired successfully!');
        return true;
      }

      console.log('Pairing response:', JSON.stringify(response.data, null, 2));
      return false;
    } catch (err) {
      console.error('Error pairing device:', err.message);
      return false;
    }
  }

  saveCredentials() {
    const purifierConfig = {
      id: 'purifier-' + this.deviceIp.replace(/\./g, '-'),
      ip: this.deviceIp,
      protocol: 'cloud',
      name: 'Air Purifier (' + this.deviceIp + ')',
      deviceId: this.deviceId,
      cloud: {
        clientId: this.clientId,
        clientKey: this.clientKey,
        pairedAt: new Date().toISOString()
      }
    };

    storage.addAirPurifier(purifierConfig);
    console.log('\nCredentials saved to network-config.json');
  }

  getExistingPurifiers() {
    return storage.getAirPurifiers() || [];
  }

  getExistingByIp(ip) {
    const purifiers = this.getExistingPurifiers();
    return purifiers.find(p => p.ip === ip);
  }

  printPairingInstructions() {
    console.log(`
================================================================================
              PHILIPS AIR PURIFIER - PAIRING MODE INSTRUCTIONS
================================================================================

Before we begin, you need to put your air purifier into PAIRING MODE.

The method varies by model. Try these common methods:

--------------------------------------------------------------------------------
METHOD 1: For most 3000i series (AC3033, AC3036, AC3039, etc.)
--------------------------------------------------------------------------------
   1. Make sure the air purifier is powered ON
   2. Touch and hold the WIFI button and POWER button simultaneously
   3. Hold for 3 seconds until you hear a BEEP
   4. The Wi-Fi indicator will start BLINKING ORANGE

--------------------------------------------------------------------------------
METHOD 2: For AC2729 and similar models
--------------------------------------------------------------------------------
   1. Make sure the air purifier is powered ON
   2. Hold the POWER button and CHILD LOCK button together
   3. Hold for 3 seconds until you hear a BEEP
   4. The device will create a "PHILIPS Setup" WiFi network

--------------------------------------------------------------------------------
METHOD 3: For 600i/800i series
--------------------------------------------------------------------------------
   1. Make sure the air purifier is powered ON
   2. Touch and hold the Wi-Fi button for 3 seconds
   3. The Wi-Fi indicator will start BLINKING ORANGE

--------------------------------------------------------------------------------
METHOD 4: Factory Reset (if other methods don't work)
--------------------------------------------------------------------------------
   1. Press and hold POWER ON + MODE buttons together
   2. Hold for 10 seconds until you hear a BEEP
   3. This will reset all WiFi settings
   4. The Wi-Fi indicator will start BLINKING ORANGE

--------------------------------------------------------------------------------
Wi-Fi INDICATOR STATUS:
--------------------------------------------------------------------------------
   - BLINKING ORANGE = Pairing mode (ready to connect)
   - SOLID ORANGE    = Connecting...
   - BLINKING WHITE  = Connected but configuring
   - SOLID WHITE     = Successfully connected!
   - OFF             = WiFi disabled

================================================================================
IMPORTANT NOTES:
================================================================================
   - Your phone/computer must be on the SAME WiFi network as the purifier
   - The purifier only supports 2.4GHz WiFi (NOT 5GHz)
   - Disable mobile data on your phone during setup
   - If you see "PHILIPS Setup" WiFi network, that's for app-based setup

`);
  }

  async run() {
    console.log(`
================================================================================
            PHILIPS AIR PURIFIER - CLOUD SETUP WIZARD
================================================================================

This script will help you set up your Philips air purifier for cloud control.

The setup process:
  1. Put your device in pairing mode
  2. Create a cloud account
  3. Retrieve device information
  4. Pair the device with your cloud account

================================================================================
`);

    // Check for existing credentials
    if (this.loadCredentials()) {
      console.log('Found existing credentials:');
      console.log('  Device ID:', this.deviceId);
      console.log('  Device IP:', this.deviceIp);
      console.log('  Client ID:', this.clientId);

      const reuse = await this.prompt('\nUse existing credentials? (y/n): ');
      if (reuse.toLowerCase() === 'y') {
        console.log('\nUsing existing credentials.');
        return;
      }
    }

    // Step 1: Show pairing instructions
    console.log('\n=== Step 1: Enter Pairing Mode ===');
    this.printPairingInstructions();

    await this.waitForEnter('\nOnce your purifier is in pairing mode (Wi-Fi light blinking orange),');

    // Get device IP
    this.deviceIp = await this.prompt('\nEnter your air purifier\'s IP address: ');

    if (!this.deviceIp) {
      console.error('IP address is required.');
      process.exit(1);
    }

    // Step 2: Create cloud account
    const accountCreated = await this.createCloudAccount();
    if (!accountCreated) {
      console.error('\nFailed to create cloud account. Please try again.');
      process.exit(1);
    }

    // Step 3: Get device info
    console.log('\n=== Step 3: Retrieving Device Information ===');

    const gotDeviceInfo = await this.getDeviceInfo();
    if (!gotDeviceInfo) {
      console.log('\nCould not automatically retrieve device ID.');
      console.log('This may happen if your device uses encrypted CoAP communication.');

      this.deviceId = await this.prompt('\nEnter your device ID (or press Enter to skip cloud pairing): ');

      if (!this.deviceId) {
        console.log('\nSkipping cloud pairing. Your device may only support local CoAP control.');
        console.log('The sync-based local control has already been attempted.');
        this.saveCredentials();
        return;
      }
    }

    // Step 4: Pair device
    const paired = await this.pairDevice();

    if (paired) {
      this.saveCredentials();
      console.log(`
================================================================================
                        SETUP COMPLETE!
================================================================================

Your air purifier has been paired successfully!

Device ID: ${this.deviceId}
Client ID: ${this.clientId}

You can now control your device through the cloud API.

================================================================================
`);
    } else {
      console.log(`
================================================================================
                        PAIRING INCOMPLETE
================================================================================

Cloud pairing was not successful. This could mean:

1. Your device model doesn't support cloud control
2. The device is not in pairing mode
3. Network connectivity issues

Your device may still work with LOCAL CoAP control.
Try using the local probe feature instead.

================================================================================
`);
      this.saveCredentials();
    }
  }
}

// CLI entry point
async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Philips Air Purifier Cloud Setup

Usage: node setup-purifier.js [options]

Options:
  --help, -h     Show this help message
  --status       Show current configuration status
  --reset        Clear saved credentials

This script guides you through setting up your Philips air purifier
for cloud control.
`);
    return;
  }

  if (args.includes('--status')) {
    const purifiers = storage.getAirPurifiers();
    if (purifiers && purifiers.length > 0) {
      console.log('Configured air purifiers:');
      for (const purifier of purifiers) {
        console.log(`\n  ${purifier.name || purifier.id}:`);
        console.log(`    IP: ${purifier.ip}`);
        console.log(`    Protocol: ${purifier.protocol}`);
        if (purifier.deviceId) {
          console.log(`    Device ID: ${purifier.deviceId}`);
        }
        if (purifier.cloud) {
          console.log(`    Cloud Client ID: ${purifier.cloud.clientId}`);
          console.log(`    Paired: ${purifier.cloud.pairedAt}`);
        }
      }
    } else {
      console.log('No air purifiers configured. Run setup first.');
    }
    return;
  }

  if (args.includes('--reset')) {
    const purifiers = storage.getAirPurifiers();
    if (purifiers && purifiers.length > 0) {
      for (const purifier of purifiers) {
        storage.removeAirPurifier(purifier.id);
      }
      console.log('Air purifier credentials cleared from network-config.json');
    } else {
      console.log('No air purifier credentials to clear.');
    }
    return;
  }

  const setup = new CloudSetup();
  await setup.run();
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
