const storage = require('../storage');
const { coap, buildCoapUrl, requestDeviceInfo } = require('./coap-client');
const { getBaseUrl, forgetDeviceState } = require('./device-state');
const { disconnect } = require('./session');

const IP_FIELD = 'ip';

async function getDeviceInfo(index) {
  const baseUrl = getBaseUrl(index);

  if (!baseUrl) {
    throw new Error('Air purifier not configured');
  }

  return requestDeviceInfo(baseUrl);
}

async function configure(address, customName) {
  const testUrl = buildCoapUrl(address);

  try {
    const deviceInfo = await requestDeviceInfo(testUrl);

    if (!deviceInfo) {
      throw new Error('No response from device');
    }

    const index = storage.addAirPurifier({
      [IP_FIELD]: address,
      name: customName || deviceInfo.name,
      model: deviceInfo.modelid
    });

    coap.reset(testUrl);

    return describeConfiguredDevice(index, address, deviceInfo);
  } catch (err) {
    coap.reset(testUrl);
    throw new Error(`Failed to connect to air purifier at ${address}: ${err.message}`);
  }
}

function remove(index) {
  disconnect(index);
  storage.removeAirPurifier(index);
  forgetDeviceState(index);
}

function describeConfiguredDevice(index, address, deviceInfo) {
  return {
    success: true,
    index,
    device: {
      [IP_FIELD]: address,
      name: deviceInfo.name,
      model: deviceInfo.modelid,
      type: deviceInfo.type
    }
  };
}

module.exports = { getDeviceInfo, configure, remove };
