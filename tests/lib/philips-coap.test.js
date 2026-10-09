let philips;

beforeAll(async () => {
  philips = await import('../../src/lib/philips-coap');
});

function reportedStatus(reported) {
  return philips.parseStatus({ state: { reported } });
}

function desiredCommand(fields) {
  return {
    state: {
      desired: { CommandType: 'app', DeviceId: '', EnduserId: '', ...fields }
    }
  };
}

describe('philips-coap', () => {
  describe('SECRET_KEY', () => {
    it('equals JiangPan', () => {
      expect(philips.SECRET_KEY).toBe('JiangPan');
    });
  });

  describe('deriveKeyIv', () => {
    it('returns a 16 byte key buffer for salt 12345678', () => {
      const { key } = philips.deriveKeyIv('12345678');

      expect([key instanceof Buffer, key.length]).toEqual([true, 16]);
    });

    it('returns a 16 byte iv buffer for salt 12345678', () => {
      const { iv: initVector } = philips.deriveKeyIv('12345678');

      expect([initVector instanceof Buffer, initVector.length]).toEqual([true, 16]);
    });

    it('returns different keys for salts AAAAAAAA and BBBBBBBB', () => {
      const first = philips.deriveKeyIv('AAAAAAAA');
      const second = philips.deriveKeyIv('BBBBBBBB');

      expect(first.key.equals(second.key)).toBe(false);
    });

    it('returns different ivs for salts AAAAAAAA and BBBBBBBB', () => {
      const first = philips.deriveKeyIv('AAAAAAAA');
      const second = philips.deriveKeyIv('BBBBBBBB');

      expect(first.iv.equals(second.iv)).toBe(false);
    });

    it('returns equal keys for salt DEADBEEF twice', () => {
      const first = philips.deriveKeyIv('DEADBEEF');
      const second = philips.deriveKeyIv('DEADBEEF');

      expect(first.key.equals(second.key)).toBe(true);
    });

    it('returns equal ivs for salt DEADBEEF twice', () => {
      const first = philips.deriveKeyIv('DEADBEEF');
      const second = philips.deriveKeyIv('DEADBEEF');

      expect(first.iv.equals(second.iv)).toBe(true);
    });
  });

  describe('incrementCounter', () => {
    it.each([
      ['00000000', '00000001'],
      ['00000001', '00000002'],
      ['000000FF', '00000100'],
      ['0000FFFF', '00010000'],
      ['0000000a', '0000000B'],
      ['FFFFFFFF', '00000000']
    ])('increments %s to %s', (counter, expected) => {
      expect(philips.incrementCounter(counter)).toBe(expected);
    });
  });

  describe('buildCommand', () => {
    it('builds the power on command for pwr 1', () => {
      expect(philips.buildCommand('pwr', '1')).toEqual(desiredCommand({ pwr: '1' }));
    });

    it('builds the mode command for mode AG', () => {
      expect(philips.buildCommand('mode', 'AG')).toEqual(desiredCommand({ mode: 'AG' }));
    });

    it('builds the fan speed command for om 2', () => {
      expect(philips.buildCommand('om', '2')).toEqual(desiredCommand({ 'om': '2' }));
    });

    it('builds the child lock command for cl true', () => {
      const locked = true;

      expect(philips.buildCommand('cl', locked)).toEqual(desiredCommand({ 'cl': true }));
    });
  });

  describe('encrypt and decrypt', () => {
    it('round-trips the pwr 1 desired state with counter DEADBEEF', () => {
      const original = { state: { desired: { pwr: '1' } } };

      expect(philips.decrypt(philips.encrypt(original, 'DEADBEEF'))).toEqual(original);
    });

    it('starts the encrypted payload for counter 12345678 with that counter', () => {
      expect(philips.encrypt({ test: 'value' }, '12345678').slice(0, 8)).toBe('12345678');
    });

    it('ends the encrypted payload with a 64 character uppercase hex digest', () => {
      expect(philips.encrypt({ test: 'value' }, '12345678').slice(-64)).toMatch(/^[0-9A-F]{64}$/);
    });

    it('produces an encrypted payload longer than 72 characters', () => {
      expect(philips.encrypt({ test: 'value' }, '12345678').length).toBeGreaterThan(72);
    });

    it('round-trips the mode AG command with counter ABCD1234', () => {
      const command = philips.buildCommand('mode', 'AG');

      expect(philips.decrypt(philips.encrypt(command, 'ABCD1234'))).toEqual(command);
    });
  });

  describe('decrypt', () => {
    it('returns null for a null payload', () => {
      expect(philips.decrypt(null)).toBeNull();
    });

    it('returns null for an empty string', () => {
      expect(philips.decrypt('')).toBeNull();
    });

    it('returns null for a payload shorter than 72 characters', () => {
      expect(philips.decrypt('ABCD1234' + '0'.repeat(60))).toBeNull();
    });

    it('returns null for a payload with salt and digest but no ciphertext', () => {
      expect(philips.decrypt('ABCD1234' + '0'.repeat(64))).toBeNull();
    });
  });

  describe('parseStatus', () => {
    it.each([
      ['pwr', { pwr: '1' }, { pwr: '1' }],
      ['mode', { mode: 'AG' }, { mode: 'AG' }],
      ['om (fan speed)', { 'om': '2' }, { 'om': '2' }],
      ['pm25', { pm25: 15 }, { pm25: 15 }],
      ['iaql (air quality index)', { iaql: 3 }, { iaql: 3 }],
      ['tvoc', { tvoc: 2 }, { tvoc: 2 }],
      ['aqil (light brightness)', { aqil: 50 }, { aqil: 50 }],
      ['uil (button light)', { uil: '1' }, { uil: '1' }],
      ['cl (child lock)', { 'cl': true }, { 'cl': true }],
      ['err', { err: 5 }, { err: 5 }],
      ['Runtime as runtime', { Runtime: 123456 }, { runtime: 123456 }],
      ['name and modelid as model', { name: 'Living Room', modelid: 'AC2939/10' }, { name: 'Living Room', model: 'AC2939/10' }]
    ])('parses the %s field', (label, reported, expected) => {
      expect(reportedStatus(reported)).toMatchObject(expected);
    });

    it('parses the filter status fields', () => {
      const filters = { fltsts0: 100, flttotal0: 720, fltsts1: 3000, flttotal1: 4800, fltsts2: 500, flttotal2: 2400 };

      expect(reportedStatus(filters)).toMatchObject(filters);
    });

    it('parses a payload without the state.reported wrapper', () => {
      expect(philips.parseStatus({ pwr: '1', mode: 'M', pm25: 10 })).toMatchObject({ pwr: '1', mode: 'M', pm25: 10 });
    });

    it('returns null name, model, pm25 and tvoc for an empty report', () => {
      expect(reportedStatus({})).toMatchObject({ name: null, model: null, pm25: null, tvoc: null });
    });

    it('returns the default capabilities for an empty report', () => {
      expect(reportedStatus({}).capabilities).toEqual(philips.MODEL_CAPABILITIES['default']);
    });
  });
});
