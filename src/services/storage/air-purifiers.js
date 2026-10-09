const { load, save } = require('./config');
const { getCoapState, setCoapState } = require('./state-files');

function getAirPurifier(index) {
  return getAirPurifiers()[index] || null;
}

function addAirPurifier(device) {
  const purifiers = getAirPurifiers();
  purifiers.push(device);
  setAirPurifiers(purifiers);

  return purifiers.length - 1;
}

function updateAirPurifier(index, device) {
  const purifiers = getAirPurifiers();

  if (!isValidIndex(index, purifiers)) {
    return false;
  }

  purifiers[index] = { ...purifiers[index], ...device };
  setAirPurifiers(purifiers);

  return true;
}

function removeAirPurifier(index) {
  const purifiers = getAirPurifiers();

  if (!isValidIndex(index, purifiers)) {
    return false;
  }

  purifiers.splice(index, 1);
  setAirPurifiers(purifiers);

  return true;
}

function getAirPurifiers() {
  return load().airPurifiers || [];
}

function setAirPurifiers(airPurifiers) {
  const config = load();
  config.airPurifiers = airPurifiers;
  save(config);
}

function isValidIndex(index, list) {
  return index >= 0 && index < list.length;
}

function getAirPurifierCounter(index) {
  return getCoapState()[`airpurifier_${index}`]?.counter || null;
}

function setAirPurifierCounter(index, counter) {
  const state = getCoapState();
  state[`airpurifier_${index}`] = { counter, timestamp: Date.now() };
  setCoapState(state);
}

module.exports = {
  getAirPurifiers,
  getAirPurifier,
  addAirPurifier,
  updateAirPurifier,
  removeAirPurifier,
  getAirPurifierCounter,
  setAirPurifierCounter
};
