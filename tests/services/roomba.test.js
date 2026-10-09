const {
  getCachedStatus,
  parseMission,
  parseBattery,
  parseBin,
  parseLifetimeStats,
  parseSettings,
  parseLastCommand,
  parseDeviceInfo
} = require('../../src/services/roomba');

describe('roomba service', () => {
  describe('parseMission', () => {
    it('returns unknown phase for null mission', () => {
      expect(parseMission(null)).toEqual({ phase: 'unknown', cycle: 'none' });
    });

    it('returns unknown phase for undefined mission', () => {
      expect(parseMission(undefined)).toEqual({ phase: 'unknown', cycle: 'none' });
    });

    it('parses charge phase', () => {
      const result = parseMission({ phase: 'charge' });
      expect(result.phase).toBe('charging');
    });

    it('parses run phase', () => {
      const result = parseMission({ phase: 'run' });
      expect(result.phase).toBe('cleaning');
    });

    it('parses stuck phase', () => {
      const result = parseMission({ phase: 'stuck' });
      expect(result.phase).toBe('stuck');
    });

    it('parses stop phase', () => {
      const result = parseMission({ phase: 'stop' });
      expect(result.phase).toBe('stopped');
    });

    it('parses pause phase', () => {
      const result = parseMission({ phase: 'pause' });
      expect(result.phase).toBe('paused');
    });

    it('parses hmMidMsn phase', () => {
      const result = parseMission({ phase: 'hmMidMsn' });
      expect(result.phase).toBe('returning');
    });

    it('parses hmPostMsn phase', () => {
      const result = parseMission({ phase: 'hmPostMsn' });
      expect(result.phase).toBe('returning');
    });

    it('parses hmUsrDock phase', () => {
      const result = parseMission({ phase: 'hmUsrDock' });
      expect(result.phase).toBe('docking');
    });

    it('parses evac phase', () => {
      const result = parseMission({ phase: 'evac' });
      expect(result.phase).toBe('emptying');
    });

    it('parses chargingerror phase', () => {
      const result = parseMission({ phase: 'chargingerror' });
      expect(result.phase).toBe('error');
    });

    it('parses cancelled phase', () => {
      const result = parseMission({ phase: 'cancelled' });
      expect(result.phase).toBe('cancelled');
    });

    it('returns unknown phase as-is', () => {
      const result = parseMission({ phase: 'newphase' });
      expect(result.phase).toBe('newphase');
    });

    it('includes cycle from mission', () => {
      const result = parseMission({ phase: 'run', cycle: 'clean' });
      expect(result.cycle).toBe('clean');
    });

    it('includes error from mission', () => {
      const result = parseMission({ phase: 'stuck', error: 8 });
      expect(result.error).toBe(8);
    });

    it('includes notReady from mission', () => {
      const result = parseMission({ phase: 'charge', notReady: 16 });
      expect(result.notReady).toBe(16);
    });

    it('includes sqft from mission', () => {
      const result = parseMission({ phase: 'run', sqft: 450 });
      expect(result.sqft).toBe(450);
    });
  });

  describe('parseBattery', () => {
    it('returns unknown for null batPct', () => {
      expect(parseBattery(null)).toEqual({ percent: null, level: 'unknown' });
    });

    it('returns unknown for undefined batPct', () => {
      expect(parseBattery(undefined)).toEqual({ percent: null, level: 'unknown' });
    });

    it('returns full for 100%', () => {
      expect(parseBattery(100)).toEqual({ percent: 100, level: 'full' });
    });

    it('returns full for 80%', () => {
      expect(parseBattery(80)).toEqual({ percent: 80, level: 'full' });
    });

    it('returns medium for 79%', () => {
      expect(parseBattery(79)).toEqual({ percent: 79, level: 'medium' });
    });

    it('returns medium for 40%', () => {
      expect(parseBattery(40)).toEqual({ percent: 40, level: 'medium' });
    });

    it('returns low for 39%', () => {
      expect(parseBattery(39)).toEqual({ percent: 39, level: 'low' });
    });

    it('returns low for 0%', () => {
      expect(parseBattery(0)).toEqual({ percent: 0, level: 'low' });
    });
  });

  describe('parseBin', () => {
    it('returns not present for null bin', () => {
      expect(parseBin(null)).toEqual({ present: false, full: false });
    });

    it('returns not present for undefined bin', () => {
      expect(parseBin(undefined)).toEqual({ present: false, full: false });
    });

    it('returns present and not full by default', () => {
      expect(parseBin({})).toEqual({ present: true, full: false });
    });

    it('returns present=false when explicitly false', () => {
      expect(parseBin({ present: false })).toEqual({ present: false, full: false });
    });

    it('returns full=true when true', () => {
      expect(parseBin({ present: true, full: true })).toEqual({ present: true, full: true });
    });

    it('handles string values for full', () => {
      expect(parseBin({ full: 'true' })).toEqual({ present: true, full: false });
    });
  });

  describe('parseLifetimeStats', () => {
    it('returns null when both bbrun and bbmssn are missing', () => {
      expect(parseLifetimeStats(null, null)).toBeNull();
    });

    it('returns null when both bbrun and bbmssn are undefined', () => {
      expect(parseLifetimeStats(undefined, undefined)).toBeNull();
    });

    it('calculates stats from bbrun and bbmssn', () => {
      const bbrun = { hr: 100, min: 30 };
      const bbmssn = { nMssn: 50, nMssnOk: 45, nMssnF: 5, aMssnM: 45 };
      const result = parseLifetimeStats(bbrun, bbmssn);

      expect(result).toEqual({
        totalHours: 100,
        totalMinutes: 30,
        totalMissions: 50,
        successfulMissions: 45,
        failedMissions: 5,
        successRate: 90,
        avgMissionMinutes: 45
      });
    });

    it('handles missing bbmssn', () => {
      const bbrun = { hr: 50, min: 15 };
      const result = parseLifetimeStats(bbrun, null);

      expect(result).toEqual({
        totalHours: 50,
        totalMinutes: 15,
        totalMissions: 0,
        successfulMissions: 0,
        failedMissions: 0,
        successRate: 0,
        avgMissionMinutes: 0
      });
    });

    it('handles missing bbrun', () => {
      const bbmssn = { nMssn: 10, nMssnOk: 8 };
      const result = parseLifetimeStats(null, bbmssn);

      expect(result).toEqual({
        totalHours: 0,
        totalMinutes: 0,
        totalMissions: 10,
        successfulMissions: 8,
        failedMissions: 0,
        successRate: 80,
        avgMissionMinutes: 0
      });
    });

    it('calculates 0% success rate when no missions', () => {
      const result = parseLifetimeStats({ hr: 0 }, { nMssn: 0 });
      expect(result.successRate).toBe(0);
    });
  });

  describe('parseSettings', () => {
    it('returns all false for empty state', () => {
      expect(parseSettings({})).toEqual({
        carpetBoost: false,
        vacHigh: false,
        twoPass: false,
        binPause: false,
        ecoCharge: false,
        schedHold: false
      });
    });

    it('parses carpetBoost', () => {
      expect(parseSettings({ carpetBoost: true }).carpetBoost).toBe(true);
    });

    it('parses vacHigh', () => {
      expect(parseSettings({ vacHigh: true }).vacHigh).toBe(true);
    });

    it('parses twoPass', () => {
      expect(parseSettings({ twoPass: true }).twoPass).toBe(true);
    });

    it('parses binPause', () => {
      expect(parseSettings({ binPause: true }).binPause).toBe(true);
    });

    it('parses ecoCharge', () => {
      expect(parseSettings({ ecoCharge: true }).ecoCharge).toBe(true);
    });

    it('parses schedHold', () => {
      expect(parseSettings({ schedHold: true }).schedHold).toBe(true);
    });
  });

  describe('parseLastCommand', () => {
    it('returns null for null lastCommand', () => {
      expect(parseLastCommand(null)).toBeNull();
    });

    it('returns null for undefined lastCommand', () => {
      expect(parseLastCommand(undefined)).toBeNull();
    });

    it('parses command and initiator', () => {
      const result = parseLastCommand({ command: 'start', initiator: 'localApp' });
      expect(result.command).toBe('start');
      expect(result.initiator).toBe('localApp');
    });

    it('converts unix timestamp to ISO string', () => {
      const timestamp = 1703500800;
      const result = parseLastCommand({ time: timestamp });
      expect(result.time).toBe(new Date(timestamp * 1000).toISOString());
    });

    it('handles missing time', () => {
      const result = parseLastCommand({ command: 'dock' });
      expect(result.time).toBeNull();
    });
  });

  describe('parseDeviceInfo', () => {
    it('returns nulls for empty state', () => {
      expect(parseDeviceInfo({})).toEqual({
        sku: null,
        softwareVer: null,
        batteryType: null,
        country: null,
        timezone: null
      });
    });

    it('parses sku', () => {
      expect(parseDeviceInfo({ sku: 'i7' }).sku).toBe('i7');
    });

    it('parses softwareVer', () => {
      expect(parseDeviceInfo({ softwareVer: '3.12.8' }).softwareVer).toBe('3.12.8');
    });

    it('parses batteryType', () => {
      expect(parseDeviceInfo({ batteryType: 'lith' }).batteryType).toBe('lith');
    });

    it('parses country', () => {
      expect(parseDeviceInfo({ country: 'US' }).country).toBe('US');
    });

    it('parses timezone', () => {
      expect(parseDeviceInfo({ timezone: 'America/New_York' }).timezone).toBe('America/New_York');
    });
  });
});

describe('getCachedStatus', () => {
  it('returns null before the robot reported any state', () => {
    expect(getCachedStatus()).toBeNull();
  });
});
