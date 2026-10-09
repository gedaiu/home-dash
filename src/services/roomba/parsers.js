const PERCENT = 100;
const MS_PER_SECOND = 1000;
const BATTERY_FULL_PERCENT = 80;
const BATTERY_MEDIUM_PERCENT = 40;

const PHASE_LABELS = {
  'charge': 'charging',
  'run': 'cleaning',
  'stuck': 'stuck',
  'stop': 'stopped',
  'pause': 'paused',
  'hmMidMsn': 'returning',
  'hmPostMsn': 'returning',
  'hmUsrDock': 'docking',
  'evac': 'emptying',
  'chargingerror': 'error',
  'cancelled': 'cancelled'
};

const MISSION_PASSTHROUGH_KEYS = ['error', 'notReady', 'mssnM', 'sqft', 'expireM'];
const SETTING_KEYS = ['carpetBoost', 'vacHigh', 'twoPass', 'binPause', 'ecoCharge', 'schedHold'];

function parseMission(mission) {
  if (!mission) {
    return { phase: 'unknown', cycle: 'none' };
  }

  return {
    phase: PHASE_LABELS[mission.phase] || mission.phase || 'unknown',
    cycle: mission.cycle || 'none',
    ...Object.fromEntries(MISSION_PASSTHROUGH_KEYS.map((key) => [key, valueOrNull(mission[key])]))
  };
}

function parseBattery(batPct) {
  if (batPct === undefined || batPct === null) {
    return { percent: null, level: 'unknown' };
  }

  return { percent: batPct, level: batteryLevel(batPct) };
}

function batteryLevel(batPct) {
  if (batPct >= BATTERY_FULL_PERCENT) {
    return 'full';
  }

  return batPct >= BATTERY_MEDIUM_PERCENT ? 'medium' : 'low';
}

function parseBin(bin) {
  if (!bin) {
    return { present: false, full: false };
  }

  return {
    present: bin.present !== false,
    full: bin.full === true
  };
}

function parseLifetimeStats(bbrun, bbmssn) {
  if (!bbrun && !bbmssn) {
    return null;
  }

  const totalMissions = countOrZero(bbmssn, 'nMssn');
  const successfulMissions = countOrZero(bbmssn, 'nMssnOk');

  return {
    totalHours: countOrZero(bbrun, 'hr'),
    totalMinutes: countOrZero(bbrun, 'min'),
    totalMissions,
    successfulMissions,
    failedMissions: countOrZero(bbmssn, 'nMssnF'),
    successRate: toSuccessRate(successfulMissions, totalMissions),
    avgMissionMinutes: countOrZero(bbmssn, 'aMssnM')
  };
}

function toSuccessRate(successfulMissions, totalMissions) {
  return totalMissions > 0 ? Math.round((successfulMissions / totalMissions) * PERCENT) : 0;
}

function countOrZero(record, field) {
  return record?.[field] || 0;
}

function parseSettings(state) {
  return Object.fromEntries(SETTING_KEYS.map((key) => [key, state[key] || false]));
}

function parseLastCommand(lastCommand) {
  if (!lastCommand) {
    return null;
  }

  return {
    command: valueOrNull(lastCommand.command),
    initiator: valueOrNull(lastCommand.initiator),
    time: lastCommand.time ? new Date(lastCommand.time * MS_PER_SECOND).toISOString() : null
  };
}

function parseDeviceInfo(state) {
  return {
    sku: valueOrNull(state.sku),
    softwareVer: valueOrNull(state.softwareVer),
    batteryType: valueOrNull(state.batteryType),
    country: valueOrNull(state.country),
    timezone: valueOrNull(state.timezone)
  };
}

function valueOrNull(candidate) {
  return candidate || null;
}

module.exports = {
  MS_PER_SECOND,
  parseMission,
  parseBattery,
  parseBin,
  parseLifetimeStats,
  parseSettings,
  parseLastCommand,
  parseDeviceInfo
};
