const { DEFAULT_PORT } = require('../../src/discovery/nanoleaf');

describe('nanoleaf discovery', () => {
  describe('DEFAULT_PORT', () => {
    it('is 16021', () => {
      expect(DEFAULT_PORT).toBe(16021);
    });
  });
});
