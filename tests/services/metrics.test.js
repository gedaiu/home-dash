let formatMetrics;

beforeAll(async () => {
  ({ formatMetrics } = await import('../../src/services/metrics.js'));
});

const emptySnapshot = {
  version: '2.0.0',
  uptimeSeconds: 42,
  integrations: { hue: false, roomba: false },
  syncRunning: false,
  hueSensors: [],
  roomba: null,
  airPurifiers: [],
  weather: null,
  appliances: [],
  openwrtAgents: [],
  openwrtDeviceCount: 0
};

function samplesOf(text, metric) {
  return text.split('\n').filter(line => line.startsWith(`${metric}{`) || line.startsWith(`${metric} `));
}

describe('formatMetrics', () => {
  it('reports version 2.0.0 for an unconfigured dashboard', () => {
    const text = formatMetrics(emptySnapshot);

    expect(samplesOf(text, 'home_dash_info')).toEqual(['home_dash_info{version="2.0.0"} 1']);
  });

  it('reports 42 seconds of uptime for an unconfigured dashboard', () => {
    const text = formatMetrics(emptySnapshot);

    expect(samplesOf(text, 'home_dash_uptime_seconds')).toEqual(['home_dash_uptime_seconds 42']);
  });

  it('reports unconfigured integrations as 0', () => {
    const text = formatMetrics(emptySnapshot);

    expect(samplesOf(text, 'home_integration_configured')).toEqual([
      'home_integration_configured{integration="hue"} 0',
      'home_integration_configured{integration="roomba"} 0'
    ]);
  });

  it('omits the roomba, weather and air purifier metric families when nothing reported data', () => {
    const text = formatMetrics(emptySnapshot);

    expect(text).not.toMatch(/home_roomba_|home_weather_|home_airpurifier_/);
  });

  it('writes HELP and TYPE gauge headers before the samples', () => {
    const text = formatMetrics(emptySnapshot);

    expect(text).toMatch(/# HELP home_sync_running .+\n# TYPE home_sync_running gauge\nhome_sync_running 0/);
  });

  it('labels a 21.5 C living room temperature sensor with its name and category', () => {
    const text = formatMetrics({
      ...emptySnapshot,
      hueSensors: [{ id: '0017880103a1b2c3', name: 'Living room', category: 'temperature', value: 21.5 }]
    });

    expect(samplesOf(text, 'home_hue_sensor_value')).toEqual([
      'home_hue_sensor_value{id="0017880103a1b2c3",name="Living room",category="temperature"} 21.5'
    ]);
  });

  it('reports a charging roomba at 87 percent with a full bin', () => {
    const text = formatMetrics({
      ...emptySnapshot,
      roomba: { name: 'Roomba', batteryPercent: 87, phase: 'charging', binFull: true }
    });

    expect([
      ...samplesOf(text, 'home_roomba_battery_percent'),
      ...samplesOf(text, 'home_roomba_bin_full'),
      ...samplesOf(text, 'home_roomba_phase')
    ]).toEqual([
      'home_roomba_battery_percent{name="Roomba"} 87',
      'home_roomba_bin_full{name="Roomba"} 1',
      'home_roomba_phase{name="Roomba",phase="charging"} 1'
    ]);
  });

  it('skips the pm25 sample of an air purifier that has not reported pm25 yet', () => {
    const text = formatMetrics({
      ...emptySnapshot,
      airPurifiers: [{ name: 'Bedroom', connected: true, power: true, pm25: null, iaql: 3, tvoc: null }]
    });

    expect(samplesOf(text, 'home_airpurifier_pm25')).toEqual([]);
  });

  it('reports the iaql sample of an air purifier that has not reported pm25 yet', () => {
    const text = formatMetrics({
      ...emptySnapshot,
      airPurifiers: [{ name: 'Bedroom', connected: true, power: true, pm25: null, iaql: 3, tvoc: null }]
    });

    expect(samplesOf(text, 'home_airpurifier_iaql')).toEqual(['home_airpurifier_iaql{name="Bedroom"} 3']);
  });

  const dishwasherSnapshot = {
    ...emptySnapshot,
    appliances: [{
      name: 'Dishwasher', type: 'Dishwasher', connected: true, operationState: 'run',
      remainingSeconds: 3600, warnings: ['salt_empty', 'rinse_aid_low']
    }]
  };

  it('reports one sample per warning of a dishwasher with empty salt and low rinse aid', () => {
    const text = formatMetrics(dishwasherSnapshot);

    expect(samplesOf(text, 'home_appliance_warning')).toEqual([
      'home_appliance_warning{name="Dishwasher",warning="salt_empty"} 1',
      'home_appliance_warning{name="Dishwasher",warning="rinse_aid_low"} 1'
    ]);
  });

  it('reports 3600 remaining seconds of a running dishwasher', () => {
    const text = formatMetrics(dishwasherSnapshot);

    expect(samplesOf(text, 'home_appliance_remaining_seconds')).toEqual([
      'home_appliance_remaining_seconds{name="Dishwasher"} 3600'
    ]);
  });

  it('escapes quotes and backslashes in label values', () => {
    const text = formatMetrics({
      ...emptySnapshot,
      hueSensors: [{ id: 'x', name: 'Bob\'s "lab" \\ room', category: 'motion', value: 1 }]
    });

    expect(samplesOf(text, 'home_hue_sensor_value')).toEqual([
      'home_hue_sensor_value{id="x",name="Bob\'s \\"lab\\" \\\\ room",category="motion"} 1'
    ]);
  });

  it('ends the exposition with a newline', () => {
    expect(formatMetrics(emptySnapshot).endsWith('\n')).toBe(true);
  });
});
