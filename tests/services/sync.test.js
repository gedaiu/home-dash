const {
  getStatus,
  POLL_INTERVAL_SLOW_MS,
  POLL_INTERVAL_FAST_MS,
  FAST_POLL_DURATION_MS
} = require('../../src/services/sync');

describe('sync service', () => {
  describe('constants', () => {
    it('POLL_INTERVAL_SLOW_MS is 5 seconds', () => {
      expect(POLL_INTERVAL_SLOW_MS).toBe(5000);
    });

    it('POLL_INTERVAL_FAST_MS is 1 second', () => {
      expect(POLL_INTERVAL_FAST_MS).toBe(1000);
    });

    it('FAST_POLL_DURATION_MS is 10 seconds', () => {
      expect(FAST_POLL_DURATION_MS).toBe(10000);
    });
  });

  describe('getStatus', () => {
    it('returns status object', () => {
      const status = getStatus();
      expect(status).toHaveProperty('running');
      expect(status).toHaveProperty('lastSync');
      expect(status).toHaveProperty('lastError');
      expect(status).toHaveProperty('currentColor');
    });

    it('initially running is false', () => {
      const status = getStatus();
      expect(status.running).toBe(false);
    });

    it('initially lastSync is null', () => {
      const status = getStatus();
      expect(status.lastSync).toBeNull();
    });

    it('initially lastError is null', () => {
      const status = getStatus();
      expect(status.lastError).toBeNull();
    });

    it('initially currentColor is null', () => {
      const status = getStatus();
      expect(status.currentColor).toBeNull();
    });
  });
});
