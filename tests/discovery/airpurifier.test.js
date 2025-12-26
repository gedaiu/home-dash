const { createConfig } = require('../../src/discovery/airpurifier');

describe('airpurifier discovery', () => {
  describe('createConfig', () => {
    it('returns null when connection failed', () => {
      const result = createConfig('192.168.1.100', { success: false });
      expect(result).toBeNull();
    });

    it('creates config with id based on IP', () => {
      const result = createConfig('192.168.1.100', {
        success: true,
        protocol: 'http',
        status: { name: 'Living Room Purifier' }
      });

      expect(result).toEqual({
        id: 'purifier-192-168-1-100',
        ip: '192.168.1.100',
        protocol: 'http',
        name: 'Living Room Purifier'
      });
    });

    it('uses default name when status has no name', () => {
      const result = createConfig('10.0.0.50', {
        success: true,
        protocol: 'coap',
        status: {}
      });

      expect(result).toEqual({
        id: 'purifier-10-0-0-50',
        ip: '10.0.0.50',
        protocol: 'coap',
        name: 'Air Purifier (10.0.0.50)'
      });
    });

    it('uses default name when status is undefined', () => {
      const result = createConfig('192.168.0.1', {
        success: true,
        protocol: 'plain-coap'
      });

      expect(result).toEqual({
        id: 'purifier-192-168-0-1',
        ip: '192.168.0.1',
        protocol: 'plain-coap',
        name: 'Air Purifier (192.168.0.1)'
      });
    });
  });
});
