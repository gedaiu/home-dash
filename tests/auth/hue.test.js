const { APP_NAME, DEVICE_NAME } = require('../../src/auth/hue');

describe('hue auth', () => {
  describe('constants', () => {
    it('APP_NAME is hue-nanoleaf-sync', () => {
      expect(APP_NAME).toBe('hue-nanoleaf-sync');
    });

    it('DEVICE_NAME is cli-scanner', () => {
      expect(DEVICE_NAME).toBe('cli-scanner');
    });
  });
});
