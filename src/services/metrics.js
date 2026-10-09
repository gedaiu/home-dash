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

function escapeLabel(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
}

function formatLabels(labels = {}) {
  const pairs = Object.entries(labels).map(([key, value]) => `${key}="${escapeLabel(value)}"`);
  return pairs.length > 0 ? `{${pairs.join(',')}}` : '';
}

function toNumber(value) {
  if (typeof value === 'boolean') {
    return value ? 1 : 0;
  }
  return value;
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

function formatMetrics(snapshot) {
  const lines = [
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
      }))),
    ...gauge('home_roomba_battery_percent', 'Roomba battery level', snapshot.roomba ? [
      { labels: { name: snapshot.roomba.name }, value: snapshot.roomba.batteryPercent }
    ] : []),
    ...gauge('home_roomba_bin_full', 'Whether the Roomba bin is full', snapshot.roomba ? [
      { labels: { name: snapshot.roomba.name }, value: snapshot.roomba.binFull }
    ] : []),
    ...gauge('home_roomba_phase', 'Current Roomba mission phase (always 1, phase in label)', snapshot.roomba ? [
      { labels: { name: snapshot.roomba.name, phase: snapshot.roomba.phase }, value: 1 }
    ] : []),
    ...gauge('home_airpurifier_connected', 'Whether the air purifier is reachable',
      snapshot.airPurifiers.map(device => ({ labels: { name: device.name }, value: device.connected }))),
    ...gauge('home_airpurifier_power', 'Whether the air purifier is switched on',
      snapshot.airPurifiers.map(device => ({ labels: { name: device.name }, value: device.power }))),
    ...gauge('home_airpurifier_pm25', 'PM2.5 concentration in ug/m3',
      snapshot.airPurifiers.map(device => ({ labels: { name: device.name }, value: device.pm25 }))),
    ...gauge('home_airpurifier_iaql', 'Indoor allergen index',
      snapshot.airPurifiers.map(device => ({ labels: { name: device.name }, value: device.iaql }))),
    ...gauge('home_airpurifier_tvoc', 'Total volatile organic compounds index',
      snapshot.airPurifiers.map(device => ({ labels: { name: device.name }, value: device.tvoc }))),
    ...gauge('home_weather_temperature_celsius', 'Outdoor temperature', snapshot.weather ? [
      { labels: { location: snapshot.weather.location }, value: snapshot.weather.temp }
    ] : []),
    ...gauge('home_weather_feels_like_celsius', 'Outdoor feels-like temperature', snapshot.weather ? [
      { labels: { location: snapshot.weather.location }, value: snapshot.weather.feelsLike }
    ] : []),
    ...gauge('home_weather_humidity_percent', 'Outdoor relative humidity', snapshot.weather ? [
      { labels: { location: snapshot.weather.location }, value: snapshot.weather.humidity }
    ] : []),
    ...gauge('home_weather_wind_speed_mps', 'Outdoor wind speed', snapshot.weather ? [
      { labels: { location: snapshot.weather.location }, value: snapshot.weather.windSpeed }
    ] : []),
    ...gauge('home_appliance_connected', 'Whether a Home Connect appliance is online',
      snapshot.appliances.map(appliance => ({
        labels: { name: appliance.name, type: appliance.type }, value: appliance.connected
      }))),
    ...gauge('home_appliance_state', 'Appliance operation state (always 1, state in label)',
      snapshot.appliances.map(appliance => ({
        labels: { name: appliance.name, state: appliance.operationState }, value: 1
      }))),
    ...gauge('home_appliance_remaining_seconds', 'Remaining program time',
      snapshot.appliances.map(appliance => ({
        labels: { name: appliance.name }, value: appliance.remainingSeconds
      }))),
    ...gauge('home_appliance_warning', 'Active appliance warning (always 1, warning in label)',
      snapshot.appliances.flatMap(appliance => appliance.warnings.map(warning => ({
        labels: { name: appliance.name, warning }, value: 1
      })))),
    ...gauge('home_openwrt_agent_online', 'Whether an OpenWrt netmon agent is connected',
      snapshot.openwrtAgents.map(agent => ({
        labels: { name: agent.name, role: agent.role }, value: agent.online
      }))),
    ...gauge('home_openwrt_devices', 'Devices reported by OpenWrt netmon agents', [
      { value: snapshot.openwrtDeviceCount }
    ])
  ];

  return `${lines.join('\n')}\n`;
}

function airPurifierSnapshot(status) {
  return {
    name: status.device?.name || `airpurifier-${status.index}`,
    connected: status.connected,
    power: status.pwr === undefined ? null : String(status.pwr) === '1',
    pm25: status.pm25 ?? null,
    iaql: status.iaql ?? null,
    tvoc: status.tvoc ?? null
  };
}

function applianceSnapshot(entry) {
  const status = entry.status || {};
  const rawState = status.OperationState;

  return {
    name: entry.name,
    type: entry.type,
    connected: entry.connected,
    operationState: status.operationState || (rawState ? homeconnect.parseOperationState(rawState) : 'unknown'),
    remainingSeconds: status.program?.remainingTime ?? null,
    warnings: status.warnings || []
  };
}

function collectSnapshot() {
  const weatherData = weather.getStatus();
  const homeConnectReady = homeconnect.isConfigured() && homeconnect.isAuthenticated();
  const openwrtState = openwrt.getState();

  return {
    version,
    uptimeSeconds: Math.round(process.uptime()),
    integrations: {
      hue: Boolean(storage.getHue()?.username),
      nanoleaf: Boolean(storage.getNanoleaf()?.authToken),
      roomba: roomba.isConfigured(),
      homeconnect: homeConnectReady,
      airpurifier: airpurifier.getAllConfigs().length > 0,
      weather: weather.isConfigured(),
      transport: transport.isConfigured()
    },
    syncRunning: sync.getStatus().running,
    hueSensors: hue.getSensorReadings(),
    roomba: roomba.getCachedStatus(),
    airPurifiers: airpurifier.getAllStatuses().filter(status => status.configured).map(airPurifierSnapshot),
    weather: weatherData?.current ? { location: weatherData.location, ...weatherData.current } : null,
    appliances: homeConnectReady ? (storage.getHomeConnectCache().statuses || []).map(applianceSnapshot) : [],
    openwrtAgents: openwrtState.routers,
    openwrtDeviceCount: openwrtState.devices.length
  };
}

module.exports = {
  formatMetrics,
  collectSnapshot
};
