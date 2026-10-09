let nanoleafDiscovery;

beforeAll(async () => {
  nanoleafDiscovery = await import('../../src/discovery/nanoleaf');
});

describe('nanoleaf discovery', () => {
  describe('DEFAULT_PORT', () => {
    it('is 16021', () => {
      expect(nanoleafDiscovery.DEFAULT_PORT).toBe(16021);
    });
  });
});
