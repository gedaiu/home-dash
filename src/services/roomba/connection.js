const mqtt = require('mqtt');
const crypto = require('crypto');
const { getConfig } = require('./config');
const { logToUI } = require('./ui-log');
const { MS_PER_SECOND } = require('./parsers');

const STATE_TIMEOUT_MS = 5000;
const CONNECTION_TIMEOUT_MS = 10000;
const STATE_CHECK_INTERVAL_MS = 100;
const MQTT_TLS_PORT = 8883;
const MQTT_PROTOCOL_VERSION = 4;
const FORCE_CLOSE = true;

let mqttClient = null;
let robotState = {};

async function connect(timeout = CONNECTION_TIMEOUT_MS) {
  const config = getConfig();

  if (!config || !config.blid || !config.password) {
    return null;
  }

  if (isConnected()) {
    return mqttClient;
  }

  disconnect();

  return new Promise((resolve) => openConnection(config, timeout, resolve));
}

function openConnection(config, timeout, resolve) {
  const timeoutId = setTimeout(() => {
    logToUI('Connection timeout', 'error');
    disconnect();
    resolve(null);
  }, timeout);

  try {
    mqttClient = mqtt.connect(`tls://${config.ip}:${MQTT_TLS_PORT}`, buildMqttOptions(config));
    attachHandlers(mqttClient, { config, timeoutId, resolve });
  } catch (err) {
    clearTimeout(timeoutId);
    logToUI(`Failed to create connection: ${err.message}`, 'error');
    resolve(null);
  }
}

function buildMqttOptions(config) {
  return {
    username: config.blid,
    password: config.password,
    rejectUnauthorized: false,
    protocolId: 'MQTT',
    protocolVersion: MQTT_PROTOCOL_VERSION,
    clean: false,
    clientId: config.blid,
    ciphers: 'HIGH:!DH:!aNULL',
    secureOptions: crypto.constants.SSL_OP_LEGACY_SERVER_CONNECT,
    reconnectPeriod: 0
  };
}

function attachHandlers(client, { config, timeoutId, resolve }) {
  const abandonConnection = (message, level) => {
    clearTimeout(timeoutId);
    logToUI(message, level);
    disconnect();
    resolve(null);
  };

  client.on('connect', () => {
    clearTimeout(timeoutId);
    logToUI(`Connected to ${config.ip}`);
    client.subscribe('#');
    resolve(client);
  });

  client.on('message', mergeReportedState);
  client.on('error', (err) => abandonConnection(`Connection error: ${err.message}`, 'error'));
  client.on('offline', () => abandonConnection('Robot went offline', 'warning'));
  client.on('close', () => clearTimeout(timeoutId));
}

function mergeReportedState(topic, message) {
  try {
    const payload = JSON.parse(message.toString());

    robotState = { ...robotState, ...payload.state?.reported };
  } catch {
    // Ignore parse errors
  }
}

function disconnect() {
  robotState = {};

  if (!mqttClient) {
    return;
  }

  try {
    mqttClient.end(FORCE_CLOSE);
  } catch {
    // Ignore disconnect errors
  }

  mqttClient = null;
}

async function getRobotState(timeout = STATE_TIMEOUT_MS) {
  if (!isConnected()) {
    return null;
  }

  return new Promise((resolve) => waitForReport(resolve, timeout, Date.now()));
}

function waitForReport(resolve, timeout, startTime) {
  const hasReport = robotState.batPct !== undefined;
  const timedOut = Date.now() - startTime > timeout;

  if (hasReport || timedOut) {
    resolve(robotState);

    return;
  }

  setTimeout(() => waitForReport(resolve, timeout, startTime), STATE_CHECK_INTERVAL_MS);
}

function sendCommand(command, params = {}) {
  if (!isConnected()) {
    throw new Error('Not connected to Roomba');
  }

  logToUI(`Sending command: ${command}`);
  const message = JSON.stringify({
    command,
    time: Math.floor(Date.now() / MS_PER_SECOND),
    initiator: 'localApp',
    ...params
  });

  mqttClient.publish('cmd', message);
}

function getReportedState() {
  return robotState;
}

function isConnected() {
  return Boolean(mqttClient?.connected);
}

module.exports = { connect, disconnect, getRobotState, sendCommand, getReportedState };
