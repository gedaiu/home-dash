const OPERATION_STATES = {
  'BSH.Common.EnumType.OperationState.Inactive': 'inactive',
  'BSH.Common.EnumType.OperationState.Ready': 'ready',
  'BSH.Common.EnumType.OperationState.DelayedStart': 'delayed',
  'BSH.Common.EnumType.OperationState.Run': 'running',
  'BSH.Common.EnumType.OperationState.Pause': 'paused',
  'BSH.Common.EnumType.OperationState.ActionRequired': 'action_required',
  'BSH.Common.EnumType.OperationState.Finished': 'finished',
  'BSH.Common.EnumType.OperationState.Error': 'error',
  'BSH.Common.EnumType.OperationState.Aborting': 'aborting'
};

const DOOR_STATES = {
  'BSH.Common.EnumType.DoorState.Open': 'open',
  'BSH.Common.EnumType.DoorState.Closed': 'closed',
  'BSH.Common.EnumType.DoorState.Locked': 'locked'
};

const PROGRAM_OPTION_FIELDS = new Map([
  ['BSH.Common.Option.RemainingProgramTime', 'remainingTime'],
  ['BSH.Common.Option.ProgramProgress', 'progress'],
  ['BSH.Common.Option.ElapsedProgramTime', 'elapsedTime'],
  ['BSH.Common.Option.StartInRelative', 'startInRelative'],
  ['BSH.Common.Option.EstimatedTotalProgramTime', 'estimatedTotalTime']
]);

const WARNING_BY_EVENT_KEY = new Map([
  ['Dishcare.Dishwasher.Event.SaltNearlyEmpty', 'salt_low'],
  ['Dishcare.Dishwasher.Event.SaltLack', 'salt_empty'],
  ['Dishcare.Dishwasher.Event.RinseAidNearlyEmpty', 'rinse_aid_low'],
  ['Dishcare.Dishwasher.Event.RinseAidLack', 'rinse_aid_empty']
]);

const EVENT_PRESENT = 'BSH.Common.EnumType.EventPresentState.Present';
const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 3600;
const PERCENT = 100;

function parseOperationState(state) {
  return OPERATION_STATES[state] || state;
}

function parseDoorState(state) {
  return DOOR_STATES[state] || state;
}

function parseProgramName(key) {
  if (!key) {
    return null;
  }

  const match = key.match(/\.(\w+)$/);

  if (!match) {
    return key;
  }

  const programName = match[1];

  return programName.replace(/([A-Z])/g, ' $1').trim();
}

function buildDishwasherStatus({ statusList, program, events }) {
  const status = statusListToObject(statusList);

  return {
    operationState: parseOperationState(status.OperationState),
    doorState: parseDoorState(status.DoorState),
    remoteControlActive: status.RemoteControlActive || false,
    remoteStartAllowed: status.RemoteControlStartAllowed || false,
    localControlActive: status.LocalControlActive || false,
    warnings: events.map(warningFromEvent).filter(Boolean),
    program: program ? { name: parseProgramName(program.key), ...readProgramOptions(program) } : null
  };
}

function statusListToObject(statusList) {
  return Object.fromEntries(statusList.map(entry => [lastKeySegment(entry.key), entry.value]));
}

function lastKeySegment(key) {
  return key.split('.').at(-1);
}

function readProgramOptions(program) {
  const options = program?.options || [];
  const values = {
    remainingTime: null,
    elapsedTime: null,
    progress: null,
    startInRelative: null,
    estimatedTotalTime: null
  };

  for (const option of options) {
    const field = PROGRAM_OPTION_FIELDS.get(option.key);

    if (field) {
      values[field] = option.value;
    }
  }

  return values;
}

function warningFromEvent(event) {
  const isPresent = event.value === EVENT_PRESENT;

  return isPresent ? WARNING_BY_EVENT_KEY.get(event.key) || null : null;
}

function advanceProgram(program, elapsedSeconds) {
  const timePatch = { ...remainingPatch(program, elapsedSeconds), ...elapsedPatch(program, elapsedSeconds) };
  const withTimes = { ...program, ...timePatch };
  const percentPatch = progressPatch(withTimes, elapsedSeconds);
  const changed = Object.keys(timePatch).length > 0 || percentPatch !== null;

  return { program: { ...withTimes, ...percentPatch }, changed };
}

function remainingPatch(program, elapsedSeconds) {
  const hasRemaining = program.remainingTime !== null && program.remainingTime > 0;

  return hasRemaining ? { remainingTime: Math.max(0, program.remainingTime - elapsedSeconds) } : null;
}

function elapsedPatch(program, elapsedSeconds) {
  return program.elapsedTime === null ? null : { elapsedTime: program.elapsedTime + elapsedSeconds };
}

function progressPatch(program, elapsedSeconds) {
  const total = program.estimatedTotalTime;

  if (!total || total <= 0) {
    return null;
  }

  const elapsed = program.elapsedTime || elapsedSeconds;

  return { progress: Math.min(PERCENT, Math.floor((elapsed / total) * PERCENT)) };
}

function formatTime(seconds) {
  if (seconds === null || seconds === undefined) {
    return '?';
  }

  const hours = Math.floor(seconds / SECONDS_PER_HOUR);
  const minutes = Math.floor((seconds % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE);

  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

module.exports = {
  parseOperationState,
  parseDoorState,
  parseProgramName,
  buildDishwasherStatus,
  statusListToObject,
  warningFromEvent,
  advanceProgram,
  formatTime
};
