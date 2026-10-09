const philipsCoap = require('../../lib/philips-coap');
const { coap, confirmableOptions } = require('./coap-client');
const { getBaseUrl, getDeviceState } = require('./device-state');
const { log } = require('./logging');
const { connect } = require('./session');

const VALID_FAN_SPEEDS = ['1', '2', '3', 's', 't'];
const VALID_MODES = ['M', 'P', 'A', 'AG', 'GT', 'T', 'S', 'B'];
const MAX_BRIGHTNESS = 100;
const SUCCESS_CODE_CLASS = 2;

async function setPower(index, enabled) {
  return sendCommand(index, 'pwr', enabled ? '1' : '0');
}

async function setFanSpeed(index, speed) {
  const speedStr = String(speed).toLowerCase();

  if (!VALID_FAN_SPEEDS.includes(speedStr)) {
    throw new Error(`Invalid fan speed: ${speed}. Valid: 1, 2, 3, s (sleep), t (turbo)`);
  }

  return sendCommand(index, 'om', speedStr);
}

async function setMode(index, mode) {
  const modeUpper = String(mode).toUpperCase();

  if (!VALID_MODES.includes(modeUpper)) {
    throw new Error(`Invalid mode: ${mode}. Valid: M (manual), P (auto), AG (allergen), GT (gentle), T (turbo), S (sleep)`);
  }

  return sendCommand(index, 'mode', modeUpper);
}

async function setChildLock(index, enabled) {
  return sendCommand(index, 'cl', enabled);
}

async function setLight(index, brightness) {
  const clamped = Math.max(0, Math.min(MAX_BRIGHTNESS, Math.round(brightness)));

  return sendCommand(index, 'aqil', clamped);
}

async function setButtonLight(index, enabled) {
  return sendCommand(index, 'uil', enabled ? '1' : '0');
}

async function sendCommand(index, key, value) {
  const baseUrl = getBaseUrl(index);
  const state = getDeviceState(index);

  if (!baseUrl) {
    throw new Error('Air purifier not configured');
  }

  if (!state.connected || !state.counter) {
    await connect(index);
  }

  state.counter = philipsCoap.incrementCounter(state.counter);

  const command = philipsCoap.buildCommand(key, value);
  const encrypted = philipsCoap.encrypt(command, state.counter);

  log(index, `Sending command: ${key}=${value}`);
  log(index, `Command payload: ${JSON.stringify(command)}`);
  log(index, `Using counter: ${state.counter}`);

  const response = await coap.request(`${baseUrl}/sys/dev/control`, 'post',
    Buffer.from(encrypted, 'utf-8'),
    confirmableOptions()
  );

  return reportResponse(index, response);
}

function reportResponse(index, response) {
  const success = response.code?.major === SUCCESS_CODE_CLASS;
  log(index, `Response: code=${response.code?.major}.${response.code?.minor}, success=${success}`);

  return success;
}

module.exports = { setPower, setFanSpeed, setMode, setChildLock, setLight, setButtonLight };
