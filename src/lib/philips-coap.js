const crypto = require('node:crypto');
const dgram = require('node:dgram');

const SECRET_KEY = 'JiangPan';
const COAP_PORT = 5683;

// CoAP message types
const COAP_TYPE_CON = 0;  // Confirmable
const COAP_TYPE_NON = 1;  // Non-confirmable
const COAP_TYPE_ACK = 2;  // Acknowledgment
const COAP_TYPE_RST = 3;  // Reset

// CoAP method codes
const COAP_GET = 0x01;
const COAP_POST = 0x02;

// CoAP option numbers
const COAP_OPT_URI_PATH = 11;

function hexToBytes(hex) {
  const bytes = [];
  for (let i = 0; i < hex.length; i += 2) {
    bytes.push(parseInt(hex.substr(i, 2), 16));
  }
  return Buffer.from(bytes);
}

function aesEncrypt(data, key, iv) {
  const cipher = crypto.createCipheriv('aes-128-cbc', key, iv);
  cipher.setAutoPadding(true);
  return Buffer.concat([cipher.update(data), cipher.final()]);
}

function aesDecrypt(data, key, iv) {
  const decipher = crypto.createDecipheriv('aes-128-cbc', key, iv);
  decipher.setAutoPadding(true);
  return Buffer.concat([decipher.update(data), decipher.final()]);
}

function deriveKeyIv(counter) {
  // Counter to 4-byte little-endian buffer
  const counterBuf = Buffer.alloc(4);
  counterBuf.writeUInt32LE(counter, 0);
  
  // MD5(SECRET_KEY + counterBytes)
  const hash = crypto.createHash('md5')
    .update(SECRET_KEY)
    .update(counterBuf)
    .digest();
  
  return { key: hash, iv: hash };
}

function encryptPayload(data, counter) {
  const { key, iv } = deriveKeyIv(counter);
  const jsonStr = JSON.stringify(data);
  const encrypted = aesEncrypt(Buffer.from(jsonStr, 'utf-8'), key, iv);
  
  // Counter as 4-byte hex (little-endian stored as big-endian string)
  const counterHex = counter.toString(16).padStart(8, '0');
  
  // SHA256 of encrypted data
  const digest = crypto.createHash('sha256').update(encrypted).digest('hex');
  
  return counterHex + encrypted.toString('hex') + digest;
}

function decryptPayload(payload) {
  try {
    // Payload format: [8 hex counter][encrypted hex][64 hex sha256]
    if (payload.length < 72) {
      return { data: null, counter: 0 };
    }
    
    const counterHex = payload.slice(0, 8);
    const encryptedHex = payload.slice(8, -64);
    
    // Parse counter (stored as little-endian in hex)
    const counter = parseInt(counterHex, 16);
    
    if (!encryptedHex || encryptedHex.length === 0) {
      return { data: null, counter };
    }
    
    const encrypted = hexToBytes(encryptedHex);
    const { key, iv } = deriveKeyIv(counter);
    const decrypted = aesDecrypt(encrypted, key, iv);
    const jsonStr = decrypted.toString('utf-8').replace(/\0+$/, '');
    
    return { data: JSON.parse(jsonStr), counter };
  } catch (err) {
    console.error('[philips-coap] Decrypt error:', err.message);
    return { data: null, counter: 0 };
  }
}

function createCoapPacket(type, code, messageId, token, options, payload) {
  const tokenLen = token ? token.length : 0;
  const header = Buffer.alloc(4);
  header[0] = (1 << 6) | (type << 4) | tokenLen;
  header[1] = code;
  header[2] = (messageId >> 8) & 0xff;
  header[3] = messageId & 0xff;

  const parts = [header];

  if (token && tokenLen > 0) {
    parts.push(token);
  }

  // Encode options
  let lastOptNum = 0;
  for (const opt of options) {
    const delta = opt.number - lastOptNum;
    lastOptNum = opt.number;
    const value = Buffer.isBuffer(opt.value) ? opt.value : Buffer.from(opt.value, 'utf-8');
    
    let deltaExt = null;
    let lenExt = null;
    let deltaNibble = delta;
    let lenNibble = value.length;
    
    if (delta >= 269) {
      deltaNibble = 14;
      deltaExt = Buffer.alloc(2);
      deltaExt.writeUInt16BE(delta - 269, 0);
    } else if (delta >= 13) {
      deltaNibble = 13;
      deltaExt = Buffer.from([delta - 13]);
    }
    
    if (value.length >= 269) {
      lenNibble = 14;
      lenExt = Buffer.alloc(2);
      lenExt.writeUInt16BE(value.length - 269, 0);
    } else if (value.length >= 13) {
      lenNibble = 13;
      lenExt = Buffer.from([value.length - 13]);
    }
    
    parts.push(Buffer.from([(deltaNibble << 4) | lenNibble]));
    if (deltaExt) parts.push(deltaExt);
    if (lenExt) parts.push(lenExt);
    parts.push(value);
  }

  if (payload && payload.length > 0) {
    parts.push(Buffer.from([0xff]));
    parts.push(Buffer.isBuffer(payload) ? payload : Buffer.from(payload, 'utf-8'));
  }

  return Buffer.concat(parts);
}

function parseCoapPacket(buffer) {
  if (buffer.length < 4) return null;

  const version = (buffer[0] >> 6) & 0x03;
  const type = (buffer[0] >> 4) & 0x03;
  const tokenLength = buffer[0] & 0x0f;
  const code = buffer[1];
  const messageId = (buffer[2] << 8) | buffer[3];

  let offset = 4;
  const token = buffer.slice(offset, offset + tokenLength);
  offset += tokenLength;

  const options = [];
  let optionNumber = 0;

  while (offset < buffer.length && buffer[offset] !== 0xff) {
    const optByte = buffer[offset++];
    let delta = (optByte >> 4) & 0x0f;
    let length = optByte & 0x0f;

    if (delta === 13) {
      delta = buffer[offset++] + 13;
    } else if (delta === 14) {
      delta = ((buffer[offset] << 8) | buffer[offset + 1]) + 269;
      offset += 2;
    } else if (delta === 15) {
      break;
    }

    if (length === 13) {
      length = buffer[offset++] + 13;
    } else if (length === 14) {
      length = ((buffer[offset] << 8) | buffer[offset + 1]) + 269;
      offset += 2;
    } else if (length === 15) {
      break;
    }

    optionNumber += delta;
    options.push({ number: optionNumber, value: buffer.slice(offset, offset + length) });
    offset += length;
  }

  let payload = null;
  if (offset < buffer.length && buffer[offset] === 0xff) {
    payload = buffer.slice(offset + 1);
  }

  return { version, type, code, messageId, token, options, payload };
}

class PhilipsCoapClient {
  constructor(ip, timeout = 15000, verbose = false) {
    this.ip = ip;
    this.timeout = timeout;
    this.messageId = Math.floor(Math.random() * 65535);
    this.counter = 0;
    this.synced = false;
    this.verbose = verbose;
  }

  log(...args) {
    if (this.verbose) {
      console.log('[philips-coap]', ...args);
    }
  }

  async sendCoap(path, method, payload = null, expectResponse = true) {
    return new Promise((resolve, reject) => {
      const socket = dgram.createSocket('udp4');
      const token = crypto.randomBytes(4);
      const msgId = this.messageId++ & 0xffff;

      this.log('Sending', method, path, 'to', this.ip);

      const timer = setTimeout(() => {
        socket.close();
        this.log('Timeout waiting for response');
        reject(new Error('CoAP timeout'));
      }, this.timeout);

      socket.on('message', (msg) => {
        clearTimeout(timer);

        const response = parseCoapPacket(msg);
        if (!response) {
          socket.close();
          reject(new Error('Invalid CoAP response'));
          return;
        }

        this.log('Response type:', response.type, 'code:', response.code);

        socket.close();

        if (response.payload) {
          const payloadStr = response.payload.toString('utf-8');
          this.log('Payload length:', payloadStr.length, 'preview:', payloadStr.slice(0, 50));

          // Check if encrypted (hex string with counter + data + digest)
          if (payloadStr.length >= 72 && /^[0-9a-f]+$/i.test(payloadStr)) {
            const { data, counter } = decryptPayload(payloadStr);
            if (data) {
              this.counter = counter;
              this.synced = true;
              this.log('Decrypted successfully, counter:', counter);
              resolve(data);
            } else {
              this.log('Decryption failed');
              reject(new Error('Failed to decrypt'));
            }
          } else {
            // Plain JSON or text
            try {
              resolve(JSON.parse(payloadStr));
            } catch {
              resolve(payloadStr);
            }
          }
        } else {
          this.log('No payload in response');
          resolve(null);
        }
      });

      socket.on('error', (err) => {
        clearTimeout(timer);
        socket.close();
        this.log('Socket error:', err.message);
        reject(err);
      });

      // Build options
      const pathParts = path.split('/').filter(p => p);
      const options = pathParts.map(part => ({
        number: COAP_OPT_URI_PATH,
        value: part
      }));

      const code = method === 'POST' ? COAP_POST : COAP_GET;
      const packet = createCoapPacket(COAP_TYPE_CON, code, msgId, token, options, payload);

      socket.send(packet, COAP_PORT, this.ip, (err) => {
        if (err) {
          clearTimeout(timer);
          socket.close();
          this.log('Send error:', err.message);
          reject(err);
        }
      });
    });
  }

  async syncOnce() {
    const syncToken = crypto.randomBytes(16).toString('hex');

    return new Promise((resolve) => {
      const socket = dgram.createSocket('udp4');
      const token = crypto.randomBytes(4);
      const msgId = this.messageId++ & 0xffff;

      this.log('Attempting sync with token:', syncToken.slice(0, 16) + '...');

      const timer = setTimeout(() => {
        socket.close();
        this.log('Sync timeout');
        resolve(false);
      }, this.timeout);

      socket.on('message', (msg) => {
        clearTimeout(timer);
        socket.close();

        const response = parseCoapPacket(msg);
        if (!response) {
          this.log('Invalid sync response');
          resolve(false);
          return;
        }

        this.log('Sync response code:', response.code, 'payload:', response.payload?.toString('utf-8'));

        if (response.payload) {
          const payloadStr = response.payload.toString('utf-8');

          // Sync response is typically just the counter in hex: "443D7EC2"
          if (/^[0-9a-fA-F]{8}$/.test(payloadStr)) {
            this.counter = parseInt(payloadStr, 16);
            this.synced = true;
            this.log('Sync successful, counter:', this.counter);
            resolve(true);
            return;
          }

          // Could also be encrypted format
          if (payloadStr.length >= 72 && /^[0-9a-f]+$/i.test(payloadStr)) {
            const { counter } = decryptPayload(payloadStr);
            if (counter > 0) {
              this.counter = counter;
              this.synced = true;
              this.log('Sync successful (encrypted), counter:', this.counter);
              resolve(true);
              return;
            }
          }
        }

        this.log('Sync response did not contain valid counter');
        resolve(false);
      });

      socket.on('error', (err) => {
        clearTimeout(timer);
        socket.close();
        this.log('Sync error:', err.message);
        resolve(false);
      });

      const pathParts = ['sys', 'dev', 'sync'];
      const options = pathParts.map(part => ({
        number: COAP_OPT_URI_PATH,
        value: part
      }));

      const packet = createCoapPacket(COAP_TYPE_CON, COAP_POST, msgId, token, options, syncToken);

      socket.send(packet, COAP_PORT, this.ip, (err) => {
        if (err) {
          clearTimeout(timer);
          socket.close();
          this.log('Sync send error:', err.message);
          resolve(false);
        }
      });
    });
  }

  async wakeUp() {
    // Send rapid burst of packets to wake up device from sleep
    this.log('Sending wake-up burst...');

    const wakePromises = [];
    for (let i = 0; i < 3; i++) {
      wakePromises.push(new Promise((resolve) => {
        const socket = dgram.createSocket('udp4');
        const token = crypto.randomBytes(4);
        const msgId = this.messageId++ & 0xffff;
        const syncToken = crypto.randomBytes(16).toString('hex');

        const timer = setTimeout(() => {
          try { socket.close(); } catch {}
          resolve(false);
        }, 2000);

        socket.on('message', () => {
          clearTimeout(timer);
          try { socket.close(); } catch {}
          resolve(true);
        });

        socket.on('error', () => {
          clearTimeout(timer);
          try { socket.close(); } catch {}
          resolve(false);
        });

        const options = [
          { number: COAP_OPT_URI_PATH, value: 'sys' },
          { number: COAP_OPT_URI_PATH, value: 'dev' },
          { number: COAP_OPT_URI_PATH, value: 'sync' }
        ];

        const packet = createCoapPacket(COAP_TYPE_CON, COAP_POST, msgId, token, options, syncToken);
        socket.send(packet, COAP_PORT, this.ip);
      }));

      // Stagger the packets slightly
      await new Promise(r => setTimeout(r, 100));
    }

    const results = await Promise.all(wakePromises);
    return results.some(r => r);
  }

  async sync() {
    // First, try to wake up the device with rapid burst
    const woke = await this.wakeUp();
    if (woke) {
      this.log('Device responded to wake-up');
    }

    // Now try actual sync
    for (let attempt = 1; attempt <= 5; attempt++) {
      this.log('Sync attempt', attempt, 'of 5');

      const success = await this.syncOnce();
      if (success) {
        return true;
      }

      // Short delay between attempts
      if (attempt < 5) {
        await new Promise(r => setTimeout(r, 300));
      }
    }

    return false;
  }

  async getStatusWithObserve() {
    // Use CoAP observe option (option 6) like py-air-control does
    return new Promise((resolve, reject) => {
      const socket = dgram.createSocket('udp4');
      const token = crypto.randomBytes(4);
      const msgId = this.messageId++ & 0xffff;

      this.log('Sending GET /sys/dev/status with observe option');

      const timer = setTimeout(() => {
        socket.close();
        this.log('Status observe timeout');
        reject(new Error('CoAP timeout'));
      }, this.timeout);

      socket.on('message', (msg) => {
        clearTimeout(timer);
        socket.close();

        const response = parseCoapPacket(msg);
        if (!response) {
          reject(new Error('Invalid CoAP response'));
          return;
        }

        this.log('Status response code:', response.code);

        if (response.payload) {
          const payloadStr = response.payload.toString('utf-8');
          this.log('Payload length:', payloadStr.length);

          // Check if encrypted (hex string with counter + data + digest)
          if (payloadStr.length >= 72 && /^[0-9a-f]+$/i.test(payloadStr)) {
            const { data, counter } = decryptPayload(payloadStr);
            if (data) {
              this.counter = counter;
              this.log('Decrypted status, counter:', counter);

              // Extract the actual status from state.reported if present
              if (data.state && data.state.reported) {
                resolve(data.state.reported);
              } else {
                resolve(data);
              }
              return;
            }
          }
        }

        this.log('No valid payload in status response');
        reject(new Error('No valid status payload'));
      });

      socket.on('error', (err) => {
        clearTimeout(timer);
        socket.close();
        this.log('Status socket error:', err.message);
        reject(err);
      });

      // Build options with observe=0 (option 6)
      const options = [
        { number: 6, value: Buffer.from([0]) },  // Observe option = 0
        { number: COAP_OPT_URI_PATH, value: 'sys' },
        { number: COAP_OPT_URI_PATH, value: 'dev' },
        { number: COAP_OPT_URI_PATH, value: 'status' }
      ];

      const packet = createCoapPacket(COAP_TYPE_CON, COAP_GET, msgId, token, options, null);

      socket.send(packet, COAP_PORT, this.ip, (err) => {
        if (err) {
          clearTimeout(timer);
          socket.close();
          this.log('Status send error:', err.message);
          reject(err);
        }
      });
    });
  }

  async getStatus() {
    // Try sync first if not synced
    if (!this.synced) {
      const synced = await this.sync();
      if (!synced) {
        throw new Error('Failed to sync with device');
      }
    }

    // Try status with observe option (like py-air-control)
    try {
      this.log('Trying status with observe option');
      return await this.getStatusWithObserve();
    } catch (err) {
      this.log('Status with observe failed:', err.message);
    }

    // Try plain GET without observe
    try {
      this.log('Trying plain GET status');
      return await this.sendCoap('/sys/dev/status', 'GET');
    } catch (err) {
      this.log('Plain GET status failed:', err.message);
    }

    // If all approaches fail, this device may only support cloud control
    throw new Error('Device does not respond to local status requests - may require cloud control');
  }

  async setValues(values) {
    if (!this.synced) {
      await this.sync();
    }

    this.counter++;
    const encrypted = encryptPayload(values, this.counter);
    return await this.sendCoap('/sys/dev/control', 'POST', encrypted);
  }
}

// Plain CoAP client (no encryption)
class PlainCoapClient {
  constructor(ip, timeout = 5000, verbose = false) {
    this.ip = ip;
    this.timeout = timeout;
    this.messageId = Math.floor(Math.random() * 65535);
    this.verbose = verbose;
  }

  log(...args) {
    if (this.verbose) {
      console.log('[plain-coap]', ...args);
    }
  }

  async sendCoap(path, method, payload = null) {
    return new Promise((resolve, reject) => {
      const socket = dgram.createSocket('udp4');
      const token = crypto.randomBytes(4);
      const msgId = this.messageId++ & 0xffff;

      this.log('Sending', method, path, 'to', this.ip);

      const timer = setTimeout(() => {
        socket.close();
        this.log('Timeout waiting for response');
        reject(new Error('CoAP timeout'));
      }, this.timeout);

      socket.on('message', (msg) => {
        clearTimeout(timer);
        socket.close();

        const response = parseCoapPacket(msg);
        if (!response || !response.payload) {
          this.log('No payload in response');
          resolve(null);
          return;
        }

        this.log('Received response with payload');
        try {
          resolve(JSON.parse(response.payload.toString('utf-8')));
        } catch {
          resolve(response.payload.toString('utf-8'));
        }
      });

      socket.on('error', (err) => {
        clearTimeout(timer);
        socket.close();
        this.log('Socket error:', err.message);
        reject(err);
      });

      const pathParts = path.split('/').filter(p => p);
      const options = pathParts.map(part => ({
        number: COAP_OPT_URI_PATH,
        value: part
      }));

      const code = method === 'POST' ? COAP_POST : COAP_GET;
      const coapPayload = payload ? (typeof payload === 'string' ? payload : JSON.stringify(payload)) : null;
      const packet = createCoapPacket(COAP_TYPE_CON, code, msgId, token, options, coapPayload);

      socket.send(packet, COAP_PORT, this.ip, (err) => {
        if (err) {
          clearTimeout(timer);
          socket.close();
          this.log('Send error:', err.message);
          reject(err);
        }
      });
    });
  }

  async getStatus() {
    return this.sendCoap('/sys/dev/status', 'GET');
  }

  async setValues(values) {
    return this.sendCoap('/sys/dev/control', 'POST', values);
  }
}

// Diffie-Hellman parameters from OpenHAB binding
const DH_G = 'AKTRy9XD/TQSZ2WkQu+5mQX4EE3SWKxQf9ZAbP8UJm0xJm/qHlxBVkt3fmkPVQTyExYCF7SwG4hqXpFUf54nSfTX+9fTuaku4ZCdDSJj+Ap2pqJMCHoJH1MdvwoBabaiitZipNGOc6+jLXedWRjQi8iFj03O+XwqJIVebusis7Ll';
const DH_P = 'ALELj5aggOAd3pLeXq5dVOxSyZ+8+wajxppqncpS0jthYHPihnWiPRiYOO8eLuZSwBPstK6pBhEjJJdcPNSbg7+sy919kMS9cJhIjpwhmnNyTv/W+uVkRzj6oxpP9VvMwKFRr18NyLS9Rb833zZcGmXmjP2nbU2nCN8fsrwuSkNx';

// HTTP client with Diffie-Hellman key exchange for newer devices
class HttpClient {
  constructor(ip, timeout = 5000, verbose = false) {
    this.ip = ip;
    this.timeout = timeout;
    this.verbose = verbose;
    this.aesKey = null;
    this.diffie = null;
  }

  log(...args) {
    if (this.verbose) {
      console.log('[http]', ...args);
    }
  }

  async request(path, method = 'GET', body = null, encrypted = true) {
    const http = require('node:http');

    this.log('Sending', method, path, 'to', this.ip, encrypted ? '(encrypted)' : '(plain)');

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.log('Timeout waiting for response');
        reject(new Error('HTTP timeout'));
      }, this.timeout);

      const options = {
        hostname: this.ip,
        port: 80,
        path,
        method,
        timeout: this.timeout,
        headers: { 'Content-Type': 'application/json' }
      };

      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          clearTimeout(timer);
          this.log('Received response, status:', res.statusCode);

          if (res.statusCode === 429) {
            reject(new Error('Rate limited (429)'));
            return;
          }

          if (!data) {
            resolve(null);
            return;
          }

          try {
            const json = JSON.parse(data);

            // If we have an AES key and data is encrypted, decrypt it
            if (encrypted && this.aesKey && typeof json === 'string') {
              const decrypted = this.decrypt(json);
              resolve(JSON.parse(decrypted));
            } else {
              resolve(json);
            }
          } catch {
            resolve(data);
          }
        });
      });

      req.on('error', (err) => {
        clearTimeout(timer);
        this.log('Request error:', err.message);
        reject(err);
      });

      req.on('timeout', () => {
        clearTimeout(timer);
        req.destroy();
        this.log('Request timed out');
        reject(new Error('HTTP timeout'));
      });

      if (body) {
        let bodyStr;
        if (encrypted && this.aesKey) {
          bodyStr = this.encrypt(JSON.stringify(body));
        } else {
          bodyStr = JSON.stringify(body);
        }
        req.write(bodyStr);
      }
      req.end();
    });
  }

  async initDiffieHellman() {
    this.log('Initializing Diffie-Hellman key exchange...');

    // Create DH instance
    const g = Buffer.from(DH_G, 'base64');
    const p = Buffer.from(DH_P, 'base64');

    this.diffie = crypto.createDiffieHellman(p, g);
    this.diffie.generateKeys();

    const aPow = this.diffie.getPublicKey('base64');
    this.log('Generated public key (A^pow)');

    // Send our public key to device
    const keyExchangeUrl = '/di/v1/products/1/security';
    const body = { diffie: aPow };

    try {
      const response = await this.request(keyExchangeUrl, 'PUT', body, false);

      if (response && response.key && response.hellman) {
        this.log('Received key exchange response');

        // Calculate shared secret
        const devicePublicKey = Buffer.from(response.hellman, 'base64');
        const sharedSecret = this.diffie.computeSecret(devicePublicKey);

        // Derive AES key: first 16 bytes of MD5(shared_secret)
        const secretKey = crypto.createHash('md5').update(sharedSecret).digest();

        // Decrypt the device's encrypted key
        const encryptedKey = Buffer.from(response.key, 'hex');
        const iv = Buffer.alloc(16, 0);
        const decipher = crypto.createDecipheriv('aes-128-cbc', secretKey, iv);

        let decryptedKey = decipher.update(encryptedKey);
        decryptedKey = Buffer.concat([decryptedKey, decipher.final()]);

        // The decrypted key starts with 'AA' padding
        const keyStr = decryptedKey.toString('utf-8');
        if (keyStr.startsWith('AA')) {
          this.aesKey = Buffer.from(keyStr.slice(2, 34), 'hex');
          this.log('AES key derived successfully');
          return true;
        }
      }
    } catch (err) {
      this.log('Key exchange failed:', err.message);
    }

    return false;
  }

  encrypt(data) {
    if (!this.aesKey) {
      return data;
    }

    const iv = Buffer.alloc(16, 0);
    const cipher = crypto.createCipheriv('aes-128-cbc', this.aesKey, iv);
    cipher.setAutoPadding(true);

    const padded = 'AA' + data;
    let encrypted = cipher.update(padded, 'utf-8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
  }

  decrypt(data) {
    if (!this.aesKey) {
      return data;
    }

    const iv = Buffer.alloc(16, 0);
    const decipher = crypto.createDecipheriv('aes-128-cbc', this.aesKey, iv);
    decipher.setAutoPadding(true);

    let decrypted = decipher.update(data, 'hex', 'utf-8');
    decrypted += decipher.final('utf-8');

    // Remove 'AA' padding
    if (decrypted.startsWith('AA')) {
      return decrypted.slice(2);
    }
    return decrypted;
  }

  async getStatus() {
    // Try to establish key exchange if not done
    if (!this.aesKey) {
      const success = await this.initDiffieHellman();
      if (!success) {
        // Fall back to plain request
        this.log('Key exchange failed, trying plain request');
      }
    }

    return this.request('/di/v1/products/1/air');
  }

  async setValues(values) {
    if (!this.aesKey) {
      await this.initDiffieHellman();
    }
    return this.request('/di/v1/products/1/air', 'PUT', values);
  }
}

module.exports = {
  PhilipsCoapClient,
  PlainCoapClient,
  HttpClient,
  // Export helpers for testing
  hexToBytes,
  deriveKeyIv,
  encryptPayload,
  decryptPayload,
  createCoapPacket,
  parseCoapPacket,
  COAP_PORT,
  COAP_TYPE_CON,
  COAP_TYPE_ACK,
  COAP_GET,
  COAP_POST
};
