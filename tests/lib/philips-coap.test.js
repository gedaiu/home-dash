const {
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
} = require('../../src/lib/philips-coap');

describe('philips-coap', () => {
  describe('constants', () => {
    it('COAP_PORT is 5683', () => {
      expect(COAP_PORT).toBe(5683);
    });

    it('COAP_TYPE_CON is 0', () => {
      expect(COAP_TYPE_CON).toBe(0);
    });

    it('COAP_TYPE_ACK is 2', () => {
      expect(COAP_TYPE_ACK).toBe(2);
    });

    it('COAP_GET is 0x01', () => {
      expect(COAP_GET).toBe(0x01);
    });

    it('COAP_POST is 0x02', () => {
      expect(COAP_POST).toBe(0x02);
    });
  });

  describe('hexToBytes', () => {
    it('converts empty string to empty buffer', () => {
      expect(hexToBytes('')).toEqual(Buffer.from([]));
    });

    it('converts single byte', () => {
      expect(hexToBytes('ff')).toEqual(Buffer.from([255]));
    });

    it('converts multiple bytes', () => {
      expect(hexToBytes('0102ff')).toEqual(Buffer.from([1, 2, 255]));
    });

    it('handles lowercase hex', () => {
      expect(hexToBytes('abcd')).toEqual(Buffer.from([0xab, 0xcd]));
    });

    it('handles uppercase hex', () => {
      expect(hexToBytes('ABCD')).toEqual(Buffer.from([0xab, 0xcd]));
    });

    it('converts known pattern', () => {
      expect(hexToBytes('48656c6c6f')).toEqual(Buffer.from('Hello'));
    });
  });

  describe('deriveKeyIv', () => {
    it('returns object with key and iv', () => {
      const result = deriveKeyIv(0);
      expect(result).toHaveProperty('key');
      expect(result).toHaveProperty('iv');
    });

    it('key and iv are 16 bytes each', () => {
      const result = deriveKeyIv(0);
      expect(result.key.length).toBe(16);
      expect(result.iv.length).toBe(16);
    });

    it('key equals iv', () => {
      const result = deriveKeyIv(0);
      expect(result.key).toEqual(result.iv);
    });

    it('different counters produce different keys', () => {
      const result0 = deriveKeyIv(0);
      const result1 = deriveKeyIv(1);
      expect(result0.key).not.toEqual(result1.key);
    });

    it('same counter produces same key', () => {
      const result1 = deriveKeyIv(42);
      const result2 = deriveKeyIv(42);
      expect(result1.key).toEqual(result2.key);
    });

    it('handles large counter values', () => {
      const result = deriveKeyIv(0xffffffff);
      expect(result.key.length).toBe(16);
    });
  });

  describe('encryptPayload and decryptPayload', () => {
    it('roundtrip encrypts and decrypts simple object', () => {
      const original = { test: 'value' };
      const counter = 1;
      const encrypted = encryptPayload(original, counter);
      const { data, counter: decryptedCounter } = decryptPayload(encrypted);

      expect(data).toEqual(original);
      expect(decryptedCounter).toBe(counter);
    });

    it('roundtrip with complex object', () => {
      const original = { pwr: '1', mode: 'auto', om: 2, nested: { a: 1 } };
      const counter = 100;
      const encrypted = encryptPayload(original, counter);
      const { data } = decryptPayload(encrypted);

      expect(data).toEqual(original);
    });

    it('encrypted payload has correct format', () => {
      const encrypted = encryptPayload({ test: 1 }, 1);
      expect(encrypted.length).toBeGreaterThanOrEqual(72);
      expect(/^[0-9a-f]+$/i.test(encrypted)).toBe(true);
    });

    it('encrypted payload starts with 8-char counter hex', () => {
      const encrypted = encryptPayload({ test: 1 }, 255);
      expect(encrypted.slice(0, 8)).toBe('000000ff');
    });

    it('encrypted payload ends with 64-char SHA256', () => {
      const encrypted = encryptPayload({ test: 1 }, 1);
      expect(encrypted.slice(-64).length).toBe(64);
    });

    it('decryptPayload returns null for payload too short', () => {
      const result = decryptPayload('abc');
      expect(result.data).toBeNull();
      expect(result.counter).toBe(0);
    });

    it('decryptPayload returns null for empty encrypted data', () => {
      const shortPayload = '00000001' + '0'.repeat(64);
      const result = decryptPayload(shortPayload);
      expect(result.data).toBeNull();
    });

    it('decryptPayload handles invalid encrypted data gracefully', () => {
      const invalidPayload = '00000001' + 'invalid' + '0'.repeat(64);
      const result = decryptPayload(invalidPayload);
      expect(result.data).toBeNull();
    });
  });

  describe('createCoapPacket', () => {
    it('creates packet with version 1', () => {
      const packet = createCoapPacket(COAP_TYPE_CON, COAP_GET, 1, null, [], null);
      expect((packet[0] >> 6) & 0x03).toBe(1);
    });

    it('includes message type in header', () => {
      const packet = createCoapPacket(COAP_TYPE_CON, COAP_GET, 1, null, [], null);
      expect((packet[0] >> 4) & 0x03).toBe(COAP_TYPE_CON);
    });

    it('includes code in header', () => {
      const packet = createCoapPacket(COAP_TYPE_CON, COAP_GET, 1, null, [], null);
      expect(packet[1]).toBe(COAP_GET);
    });

    it('includes message ID in header', () => {
      const packet = createCoapPacket(COAP_TYPE_CON, COAP_GET, 0x1234, null, [], null);
      expect(packet[2]).toBe(0x12);
      expect(packet[3]).toBe(0x34);
    });

    it('includes token when provided', () => {
      const token = Buffer.from([0xaa, 0xbb]);
      const packet = createCoapPacket(COAP_TYPE_CON, COAP_GET, 1, token, [], null);
      expect(packet[0] & 0x0f).toBe(2);
      expect(packet[4]).toBe(0xaa);
      expect(packet[5]).toBe(0xbb);
    });

    it('encodes URI path option', () => {
      const options = [{ number: 11, value: 'sys' }];
      const packet = createCoapPacket(COAP_TYPE_CON, COAP_GET, 1, null, options, null);
      expect(packet.length).toBeGreaterThan(4);
    });

    it('includes payload marker and payload', () => {
      const packet = createCoapPacket(COAP_TYPE_CON, COAP_POST, 1, null, [], 'test');
      expect(packet.includes(0xff)).toBe(true);
      expect(packet.toString().includes('test')).toBe(true);
    });

    it('handles buffer payload', () => {
      const payload = Buffer.from('hello');
      const packet = createCoapPacket(COAP_TYPE_CON, COAP_POST, 1, null, [], payload);
      expect(packet.includes(0xff)).toBe(true);
    });
  });

  describe('parseCoapPacket', () => {
    it('returns null for buffer too short', () => {
      expect(parseCoapPacket(Buffer.from([0, 0, 0]))).toBeNull();
    });

    it('parses version from header', () => {
      const packet = createCoapPacket(COAP_TYPE_CON, COAP_GET, 1, null, [], null);
      const parsed = parseCoapPacket(packet);
      expect(parsed.version).toBe(1);
    });

    it('parses type from header', () => {
      const packet = createCoapPacket(COAP_TYPE_ACK, COAP_GET, 1, null, [], null);
      const parsed = parseCoapPacket(packet);
      expect(parsed.type).toBe(COAP_TYPE_ACK);
    });

    it('parses code from header', () => {
      const packet = createCoapPacket(COAP_TYPE_CON, COAP_POST, 1, null, [], null);
      const parsed = parseCoapPacket(packet);
      expect(parsed.code).toBe(COAP_POST);
    });

    it('parses message ID from header', () => {
      const packet = createCoapPacket(COAP_TYPE_CON, COAP_GET, 0xabcd, null, [], null);
      const parsed = parseCoapPacket(packet);
      expect(parsed.messageId).toBe(0xabcd);
    });

    it('parses token', () => {
      const token = Buffer.from([0x11, 0x22, 0x33]);
      const packet = createCoapPacket(COAP_TYPE_CON, COAP_GET, 1, token, [], null);
      const parsed = parseCoapPacket(packet);
      expect(parsed.token).toEqual(token);
    });

    it('parses options', () => {
      const options = [{ number: 11, value: 'test' }];
      const packet = createCoapPacket(COAP_TYPE_CON, COAP_GET, 1, null, options, null);
      const parsed = parseCoapPacket(packet);
      expect(parsed.options.length).toBe(1);
      expect(parsed.options[0].number).toBe(11);
    });

    it('parses payload', () => {
      const packet = createCoapPacket(COAP_TYPE_CON, COAP_POST, 1, null, [], 'hello');
      const parsed = parseCoapPacket(packet);
      expect(parsed.payload.toString()).toBe('hello');
    });

    it('returns null payload when no payload marker', () => {
      const packet = createCoapPacket(COAP_TYPE_CON, COAP_GET, 1, null, [], null);
      const parsed = parseCoapPacket(packet);
      expect(parsed.payload).toBeNull();
    });

    it('roundtrip create and parse', () => {
      const token = Buffer.from([0xde, 0xad, 0xbe, 0xef]);
      const options = [
        { number: 11, value: 'sys' },
        { number: 11, value: 'dev' },
        { number: 11, value: 'status' }
      ];
      const payload = 'test payload';
      const packet = createCoapPacket(COAP_TYPE_CON, COAP_GET, 12345, token, options, payload);
      const parsed = parseCoapPacket(packet);

      expect(parsed.version).toBe(1);
      expect(parsed.type).toBe(COAP_TYPE_CON);
      expect(parsed.code).toBe(COAP_GET);
      expect(parsed.messageId).toBe(12345);
      expect(parsed.token).toEqual(token);
      expect(parsed.options.length).toBe(3);
      expect(parsed.payload.toString()).toBe(payload);
    });
  });
});
