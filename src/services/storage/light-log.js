const fs = require('node:fs');
const path = require('node:path');
const { storagePaths, ensureLogsDir } = require('./paths');

function logLightChange(...change) {
  const [lightName, rgb, mode, lightState] = change;
  ensureLogsDir();
  const [date, zuluTime] = new Date().toISOString().split('T');
  const filePath = path.join(storagePaths.logsDir, `${date}_lights.log`);
  const line = formatLightLine(zuluTime.replace('Z', ''), { lightName, rgb, mode, lightState });

  fs.appendFileSync(filePath, line, 'utf-8');
}

function formatLightLine(time, change) {
  const { lightName, rgb, mode, lightState } = change;
  const stateText = lightState.on ? `bri:${lightState.bri}` : 'OFF';

  return `${time} [${lightName}] RGB(${rgb.r},${rgb.g},${rgb.b}) ${mode} ${stateText}\n`;
}

module.exports = { logLightChange };
