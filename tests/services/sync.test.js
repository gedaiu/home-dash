let syncService;

beforeAll(async () => {
  ({ default: syncService } = await import('../../src/services/sync'));
});

describe('sync service', () => {
  describe('constants', () => {
    it('POLL_INTERVAL_SLOW_MS is 5 seconds', () => {
      expect(syncService.POLL_INTERVAL_SLOW_MS).toBe(5000);
    });

    it('POLL_INTERVAL_FAST_MS is 1 second', () => {
      expect(syncService.POLL_INTERVAL_FAST_MS).toBe(1000);
    });

    it('FAST_POLL_DURATION_MS is 10 seconds', () => {
      expect(syncService.FAST_POLL_DURATION_MS).toBe(10000);
    });
  });

  describe('getStatus', () => {
    it('returns stopped status without sync time, error or color before start', () => {
      expect(syncService.getStatus()).toEqual({
        running: false,
        lastSync: null,
        lastError: null,
        currentColor: null
      });
    });
  });
});
