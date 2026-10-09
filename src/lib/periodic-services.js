const hueService = require('../services/hue');
const homeconnectService = require('../services/homeconnect');
const roombaService = require('../services/roomba');
const weatherService = require('../services/weather');
const transportService = require('../services/transport');

module.exports = [hueService, homeconnectService, roombaService, weatherService, transportService];
