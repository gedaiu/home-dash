const {
  parseOperationState,
  parseDoorState,
  parseProgramName
} = require('../../src/services/homeconnect');

describe('homeconnect service', () => {
  describe('parseOperationState', () => {
    it('parses Inactive state', () => {
      expect(parseOperationState('BSH.Common.EnumType.OperationState.Inactive')).toBe('inactive');
    });

    it('parses Ready state', () => {
      expect(parseOperationState('BSH.Common.EnumType.OperationState.Ready')).toBe('ready');
    });

    it('parses DelayedStart state', () => {
      expect(parseOperationState('BSH.Common.EnumType.OperationState.DelayedStart')).toBe('delayed');
    });

    it('parses Run state', () => {
      expect(parseOperationState('BSH.Common.EnumType.OperationState.Run')).toBe('running');
    });

    it('parses Pause state', () => {
      expect(parseOperationState('BSH.Common.EnumType.OperationState.Pause')).toBe('paused');
    });

    it('parses ActionRequired state', () => {
      expect(parseOperationState('BSH.Common.EnumType.OperationState.ActionRequired')).toBe('action_required');
    });

    it('parses Finished state', () => {
      expect(parseOperationState('BSH.Common.EnumType.OperationState.Finished')).toBe('finished');
    });

    it('parses Error state', () => {
      expect(parseOperationState('BSH.Common.EnumType.OperationState.Error')).toBe('error');
    });

    it('parses Aborting state', () => {
      expect(parseOperationState('BSH.Common.EnumType.OperationState.Aborting')).toBe('aborting');
    });

    it('returns unknown state as-is', () => {
      expect(parseOperationState('Unknown.State')).toBe('Unknown.State');
    });

    it('handles undefined', () => {
      expect(parseOperationState(undefined)).toBe(undefined);
    });
  });

  describe('parseDoorState', () => {
    it('parses Open state', () => {
      expect(parseDoorState('BSH.Common.EnumType.DoorState.Open')).toBe('open');
    });

    it('parses Closed state', () => {
      expect(parseDoorState('BSH.Common.EnumType.DoorState.Closed')).toBe('closed');
    });

    it('parses Locked state', () => {
      expect(parseDoorState('BSH.Common.EnumType.DoorState.Locked')).toBe('locked');
    });

    it('returns unknown state as-is', () => {
      expect(parseDoorState('Unknown.DoorState')).toBe('Unknown.DoorState');
    });

    it('handles undefined', () => {
      expect(parseDoorState(undefined)).toBe(undefined);
    });
  });

  describe('parseProgramName', () => {
    it('returns null for null input', () => {
      expect(parseProgramName(null)).toBeNull();
    });

    it('returns null for undefined input', () => {
      expect(parseProgramName(undefined)).toBeNull();
    });

    it('returns null for empty string', () => {
      expect(parseProgramName('')).toBeNull();
    });

    it('extracts and formats program name from key', () => {
      expect(parseProgramName('Dishcare.Dishwasher.Program.Auto1')).toBe('Auto1');
    });

    it('formats camelCase names with spaces', () => {
      expect(parseProgramName('Dishcare.Dishwasher.Program.IntensivePower')).toBe('Intensive Power');
    });

    it('formats complex camelCase names', () => {
      expect(parseProgramName('Dishcare.Dishwasher.Program.Eco50DegreesCelsius')).toBe('Eco50 Degrees Celsius');
    });

    it('handles simple program names', () => {
      expect(parseProgramName('Dishcare.Dishwasher.Program.Quick')).toBe('Quick');
    });

    it('returns key as-is when no dot pattern match', () => {
      expect(parseProgramName('SomeProgram')).toBe('SomeProgram');
    });

    it('handles single word at end', () => {
      expect(parseProgramName('BSH.Common.Program.Eco')).toBe('Eco');
    });
  });
});
