const readers = require('./airpurifier/readers');
const lifecycle = require('./airpurifier/lifecycle');
const commands = require('./airpurifier/commands');

module.exports = {
  ...readers,
  ...lifecycle,
  ...commands
};
