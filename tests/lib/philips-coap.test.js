const {
  SECRET_KEY,
  deriveKeyIv,
  decrypt,
  encrypt,
  incrementCounter,
  buildCommand,
  parseStatus
} = require('../../src/lib/philips-coap');

describe('philips-coap', () => {
  describe('SECRET_KEY', () => {
    it('equals JiangPan', () => {
      expect(SECRET_KEY).toBe('JiangPan');
    });
  });

  describe('deriveKeyIv', () => {
    it('returns key and iv buffers of 16 bytes each', () => {
      const { key, iv } = deriveKeyIv('12345678');
      expect(key).toBeInstanceOf(Buffer);
      expect(iv).toBeInstanceOf(Buffer);
      expect(key.length).toBe(16);
      expect(iv.length).toBe(16);
    });

    it('returns different results for different salts', () => {
      const result1 = deriveKeyIv('AAAAAAAA');
      const result2 = deriveKeyIv('BBBBBBBB');
      expect(result1.key.equals(result2.key)).toBe(false);
      expect(result1.iv.equals(result2.iv)).toBe(false);
    });

    it('returns consistent results for same salt', () => {
      const result1 = deriveKeyIv('DEADBEEF');
      const result2 = deriveKeyIv('DEADBEEF');
      expect(result1.key.equals(result2.key)).toBe(true);
      expect(result1.iv.equals(result2.iv)).toBe(true);
    });
  });

  describe('incrementCounter', () => {
    it('increments 00000000 to 00000001', () => {
      expect(incrementCounter('00000000')).toBe('00000001');
    });

    it('increments 00000001 to 00000002', () => {
      expect(incrementCounter('00000001')).toBe('00000002');
    });

    it('increments 000000FF to 00000100', () => {
      expect(incrementCounter('000000FF')).toBe('00000100');
    });

    it('increments 0000FFFF to 00010000', () => {
      expect(incrementCounter('0000FFFF')).toBe('00010000');
    });

    it('handles lowercase input and returns uppercase', () => {
      expect(incrementCounter('0000000a')).toBe('0000000B');
    });

    it('wraps around at FFFFFFFF to 00000000', () => {
      expect(incrementCounter('FFFFFFFF')).toBe('00000000');
    });
  });

  describe('buildCommand', () => {
    it('builds power on command', () => {
      const cmd = buildCommand('pwr', '1');
      expect(cmd).toEqual({
        state: {
          desired: {
            CommandType: 'app',
            DeviceId: '',
            EnduserId: '',
            pwr: '1'
          }
        }
      });
    });

    it('builds mode command', () => {
      const cmd = buildCommand('mode', 'AG');
      expect(cmd.state.desired.mode).toBe('AG');
    });

    it('builds fan speed command', () => {
      const cmd = buildCommand('om', '2');
      expect(cmd.state.desired.om).toBe('2');
    });

    it('builds child lock command', () => {
      const cmd = buildCommand('cl', true);
      expect(cmd.state.desired.cl).toBe(true);
    });
  });

  describe('encrypt and decrypt', () => {
    it('round-trips simple JSON data', () => {
      const original = { state: { desired: { pwr: '1' } } };
      const counter = 'DEADBEEF';
      const encrypted = encrypt(original, counter);
      const decrypted = decrypt(encrypted);
      expect(decrypted).toEqual(original);
    });

    it('encrypted payload has correct format', () => {
      const data = { test: 'value' };
      const counter = '12345678';
      const encrypted = encrypt(data, counter);

      expect(encrypted.slice(0, 8)).toBe('12345678');
      expect(encrypted.length).toBeGreaterThan(72);
      expect(encrypted.slice(-64)).toMatch(/^[0-9A-F]{64}$/);
    });

    it('round-trips command with various fields', () => {
      const cmd = buildCommand('mode', 'AG');
      const counter = 'ABCD1234';
      const encrypted = encrypt(cmd, counter);
      const decrypted = decrypt(encrypted);
      expect(decrypted).toEqual(cmd);
    });
  });

  describe('decrypt', () => {
    it('returns null for null payload', () => {
      expect(decrypt(null)).toBeNull();
    });

    it('returns null for empty string', () => {
      expect(decrypt('')).toBeNull();
    });

    it('returns null for payload shorter than 72 chars', () => {
      expect(decrypt('ABCD1234' + '0'.repeat(60))).toBeNull();
    });
  });

  describe('parseStatus', () => {
    it('parses pwr field', () => {
      const data = { state: { reported: { pwr: '1' } } };
      const status = parseStatus(data);
      expect(status.pwr).toBe('1');
    });

    it('parses mode field', () => {
      const data = { state: { reported: { mode: 'AG' } } };
      const status = parseStatus(data);
      expect(status.mode).toBe('AG');
    });

    it('parses om (fan speed) field', () => {
      const data = { state: { reported: { om: '2' } } };
      const status = parseStatus(data);
      expect(status.om).toBe('2');
    });

    it('parses pm25 field', () => {
      const data = { state: { reported: { pm25: 15 } } };
      const status = parseStatus(data);
      expect(status.pm25).toBe(15);
    });

    it('parses iaql (air quality index) field', () => {
      const data = { state: { reported: { iaql: 3 } } };
      const status = parseStatus(data);
      expect(status.iaql).toBe(3);
    });

    it('parses tvoc field', () => {
      const data = { state: { reported: { tvoc: 2 } } };
      const status = parseStatus(data);
      expect(status.tvoc).toBe(2);
    });

    it('parses aqil (light brightness) field', () => {
      const data = { state: { reported: { aqil: 50 } } };
      const status = parseStatus(data);
      expect(status.aqil).toBe(50);
    });

    it('parses uil (button light) field', () => {
      const data = { state: { reported: { uil: '1' } } };
      const status = parseStatus(data);
      expect(status.uil).toBe('1');
    });

    it('parses cl (child lock) field', () => {
      const data = { state: { reported: { cl: true } } };
      const status = parseStatus(data);
      expect(status.cl).toBe(true);
    });

    it('parses filter status fields', () => {
      const data = {
        state: {
          reported: {
            fltsts0: 100,
            flttotal0: 720,
            fltsts1: 3000,
            flttotal1: 4800,
            fltsts2: 500,
            flttotal2: 2400
          }
        }
      };
      const status = parseStatus(data);
      expect(status).toMatchObject({
        fltsts0: 100,
        flttotal0: 720,
        fltsts1: 3000,
        flttotal1: 4800,
        fltsts2: 500,
        flttotal2: 2400
      });
    });

    it('parses device info', () => {
      const data = { state: { reported: { name: 'Living Room', modelid: 'AC2939/10' } } };
      const status = parseStatus(data);
      expect(status.name).toBe('Living Room');
      expect(status.model).toBe('AC2939/10');
    });

    it('parses err field', () => {
      const data = { state: { reported: { err: 5 } } };
      const status = parseStatus(data);
      expect(status.err).toBe(5);
    });

    it('parses runtime field', () => {
      const data = { state: { reported: { Runtime: 123456 } } };
      const status = parseStatus(data);
      expect(status.runtime).toBe(123456);
    });

    it('handles data without state.reported wrapper', () => {
      const data = { pwr: '1', mode: 'M', pm25: 10 };
      const status = parseStatus(data);
      expect(status.pwr).toBe('1');
      expect(status.mode).toBe('M');
      expect(status.pm25).toBe(10);
    });

    it('returns null for missing fields', () => {
      const data = { state: { reported: {} } };
      const status = parseStatus(data);
      expect(status.name).toBeNull();
      expect(status.model).toBeNull();
      expect(status.pm25).toBeNull();
      expect(status.tvoc).toBeNull();
    });
  });
});
