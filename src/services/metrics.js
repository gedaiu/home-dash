const storage = require('./storage');
const hue = require('./hue');
const roomba = require('./roomba');
const airpurifier = require('./airpurifier');
const homeconnect = require('./homeconnect');
const weather = require('./weather');
const transport = require('./transport');
const sync = require('./sync');
const openwrt = require('./openwrt');
const { version } = require('../../package.json');

const ROOMBA_GAUGES = [
  {
    name: 'home_roomba_battery_percent', help: 'Roomba battery level',
    labels: roomba => ({ name: roomba.name }), value: roomba => roomba.batteryPercent
  },
  {
    name: 'home_roomba_bin_full', help: 'Whether the Roomba bin is full',
    labels: roomba => ({ name: roomba.name }), value: roomba => roomba.binFull
  },
  {
    name: 'home_roomba_phase', help: 'Current Roomba mission phase (always 1, phase in label)',
    labels: roomba => ({ name: roomba.name, phase: roomba.phase }), value: () => 1
  }
];

const AIR_PURIFIER_GAUGES = [
  ['home_airpurifier_connected', 'Whether the air purifier is reachable', 'connected'],
  ['home_airpurifier_power', 'Whether the air purifier is switched on', 'power'],
  ['home_airpurifier_pm25', 'PM2.5 concentration in ug/m3', 'pm25'],
  ['home_airpurifier_iaql', 'Indoor allergen index', 'iaql'],
  ['home_airpurifier_tvoc', 'Total volatile organic compounds index', 'tvoc']
].map(([name, help, field]) => ({
  name, help, labels: device => ({ name: device.name }), value: device => device[field]
}));

const WEATHER_GAUGES = [
  ['home_weather_temperature_celsius', 'Outdoor temperature', 'temp'],
  ['home_weather_feels_like_celsius', 'Outdoor feels-like temperature', 'feelsLike'],
  ['home_weather_humidity_percent', 'Outdoor relative humidity', 'humidity'],
  ['home_weather_wind_speed_mps', 'Outdoor wind speed', 'windSpeed']
].map(([name, help, field]) => ({
  name, help, labels: weather => ({ location: weather.location }), value: weather => weather[field]
}));

const APPLIANCE_GAUGES = [
  {
    name: 'home_appliance_connected', help: 'Whether a Home Connect appliance is online',
    labels: appliance => ({ name: appliance.name, type: appliance.type }), value: appliance => appliance.connected
  },
  {
    name: 'home_appliance_state', help: 'Appliance operation state (always 1, state in label)',
    labels: appliance => ({ name: appliance.name, state: appliance.operationState }), value: () => 1
  },
  {
    name: 'home_appliance_remaining_seconds', help: 'Remaining program time',
    labels: appliance => ({ name: appliance.name }), value: appliance => appliance.remainingSeconds
  }
];

const OPENWRT_AGENT_GAUGES = [
  {
    name: 'home_openwrt_agent_online', help: 'Whether an OpenWrt netmon agent is connected',
    labels: agent => ({ name: agent.name, role: agent.role }), value: agent => agent.online
  }
];

function formatMetrics(snapshot) {
  const lines = [
    ...coreGauges(snapshot),
    ...entityGauges(ROOMBA_GAUGES, snapshot.roomba ? [snapshot.roomba] : []),
    ...entityGauges(AIR_PURIFIER_GAUGES, snapshot.airPurifiers),
    ...entityGauges(WEATHER_GAUGES, snapshot.weather ? [snapshot.weather] : []),
    ...entityGauges(APPLIANCE_GAUGES, snapshot.appliances),
    ...applianceWarningGauges(snapshot.appliances),
    ...entityGauges(OPENWRT_AGENT_GAUGES, snapshot.openwrtAgents),
    ...gauge('home_openwrt_devices', 'Devices reported by OpenWrt netmon agents', [
      { value: snapshot.openwrtDeviceCount }
    ])
  ];

  return `${lines.join('\n')}\n`;
}

function coreGauges(snapshot) {
  return [
    ...gauge('home_dash_info', 'Home dashboard build information', [
      { labels: { version: snapshot.version }, value: 1 }
    ]),
    ...gauge('home_dash_uptime_seconds', 'Seconds since the dashboard process started', [
      { value: snapshot.uptimeSeconds }
    ]),
    ...gauge('home_integration_configured', 'Whether an integration is configured (1) or not (0)',
      Object.entries(snapshot.integrations).map(([integration, configured]) => ({
        labels: { integration }, value: configured
      }))),
    ...gauge('home_sync_running', 'Whether Hue to Nanoleaf sync is running', [
      { value: snapshot.syncRunning }
    ]),
    ...gauge('home_hue_sensor_value', 'Latest Hue sensor reading (temperature in C, light level raw, motion 0/1)',
      snapshot.hueSensors.map(sensor => ({
        labels: { id: sensor.id, name: sensor.name, category: sensor.category }, value: sensor.value
      })))
  ];
}

function entityGauges(specs, entities) {
  return specs.flatMap(spec => gauge(spec.name, spec.help, entities.map(entity => ({
    labels: spec.labels(entity), value: spec.value(entity)
  }))));
}

function applianceWarningGauges(appliances) {
  return gauge('home_appliance_warning', 'Active appliance warning (always 1, warning in label)',
    appliances.flatMap(appliance => appliance.warnings.map(warning => ({
      labels: { name: appliance.name, warning }, value: 1
    }))));
}

function gauge(name, help, samples) {
  const lines = samples
    .filter(sample => sample.value !== null && sample.value !== undefined)
    .map(sample => `${name}${formatLabels(sample.labels)} ${toNumber(sample.value)}`);

  if (lines.length === 0) {
    return [];
  }

  return [`# HELP ${name} ${help}`, `# TYPE ${name} gauge`, ...lines];
}

function formatLabels(labels = {}) {
  const pairs = Object.entries(labels).map(([key, value]) => `${key}="${escapeLabel(value)}"`);

  return pairs.length > 0 ? `{${pairs.join(',')}}` : '';
}

function escapeLabel(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
}

function toNumber(value) {
  if (typeof value === 'boolean') {
    return value ? 1 : 0;
  }

  return value;
}

function collectSnapshot() {
  const homeConnectReady = homeconnect.isConfigured() && homeconnect.isAuthenticated();
  const openwrtState = openwrt.getState();

  return {
    version,
    uptimeSeconds: Math.round(process.uptime()),
    integrations: integrationsSnapshot(homeConnectReady),
    syncRunning: sync.getStatus().running,
    hueSensors: hue.getSensorReadings(),
    roomba: roomba.getCachedStatus(),
    airPurifiers: airpurifier.getAllStatuses().filter(status => status.configured).map(airPurifierSnapshot),
    weather: weatherSnapshot(weather.getStatus()),
    appliances: homeConnectReady ? (storage.getHomeConnectCache().statuses || []).map(applianceSnapshot) : [],
    openwrtAgents: openwrtState.routers,
    openwrtDeviceCount: openwrtState.devices.length
  };
}

function integrationsSnapshot(homeConnectReady) {
  return {
    hue: Boolean(storage.getHue()?.username),
    nanoleaf: Boolean(storage.getNanoleaf()?.authToken),
    roomba: roomba.isConfigured(),
    homeconnect: homeConnectReady,
    airpurifier: airpurifier.getAllConfigs().length > 0,
    weather: weather.isConfigured(),
    transport: transport.isConfigured()
  };
}

function weatherSnapshot(weatherStatus) {
  return weatherStatus?.current ? { location: weatherStatus.location, ...weatherStatus.current } : null;
}

function airPurifierSnapshot(status) {
  return {
    name: status.device?.name || `airpurifier-${status.index}`,
    connected: status.connected,
    power: isPowerOn(status.pwr),
    pm25: status.pm25 ?? null,
    iaql: status.iaql ?? null,
    tvoc: status.tvoc ?? null
  };
}

function isPowerOn(power) {
  return power === undefined ? null : String(power) === '1';
}

function applianceSnapshot(entry) {
  const status = entry.status || {};

  return {
    name: entry.name,
    type: entry.type,
    connected: entry.connected,
    operationState: operationStateOf(status),
    remainingSeconds: status.program?.remainingTime ?? null,
    warnings: status.warnings || []
  };
}

function operationStateOf(status) {
  const rawState = status.OperationState;

  return status.operationState || (rawState ? homeconnect.parseOperationState(rawState) : 'unknown');
}

module.exports = {
  formatMetrics,
  collectSnapshot
};
