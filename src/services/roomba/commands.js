const { connect, sendCommand } = require('./connection');

async function start() {
  await sendRobotCommand('start');
}

async function stop() {
  await sendRobotCommand('stop');
}

async function pause() {
  await sendRobotCommand('pause');
}

async function resume() {
  await sendRobotCommand('resume');
}

async function dock() {
  await sendRobotCommand('dock');
}

async function sendRobotCommand(command) {
  const client = await connect();

  if (!client) {
    throw new Error('Roomba not connected');
  }

  sendCommand(command);
}

module.exports = { start, stop, pause, resume, dock };
