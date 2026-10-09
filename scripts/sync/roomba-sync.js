const dorita980 = require('dorita980');
const { setNanoleafColor } = require('./nanoleaf');
const { schedulePolling } = require('./polling');

const POLL_INTERVAL_MS = 5000;
const ROOMBA_HUE_BRIGHTNESS = 200;

const PHASE_COLORS = {
  charging: { red: 0, green: 255, blue: 0 },
  cleaning: { red: 0, green: 150, blue: 255 },
  stuck: { red: 255, green: 0, blue: 0 },
  stopped: { red: 100, green: 100, blue: 100 },
  paused: { red: 255, green: 200, blue: 0 },
  returning: { red: 255, green: 165, blue: 0 },
  docking: { red: 255, green: 200, blue: 0 },
  emptying: { red: 150, green: 0, blue: 255 },
  error: { red: 255, green: 0, blue: 0 },
  cancelled: { red: 200, green: 200, blue: 200 }
};
const UNKNOWN_PHASE_COLOR = { red: 128, green: 128, blue: 128 };

const MISSION_PHASES = {
  charge: 'charging',
  run: 'cleaning',
  stuck: 'stuck',
  stop: 'stopped',
  pause: 'paused',
  hmMidMsn: 'returning',
  hmPostMsn: 'returning',
  hmUsrDock: 'docking',
  evac: 'emptying',
  chargingerror: 'error',
  cancelled: 'cancelled'
};

async function syncRoombaDevice(config) {
  console.log(`Syncing: Roomba -> Nanoleaf`);
  console.log(`Poll interval: ${POLL_INTERVAL_MS}ms`);
  console.log('\nPress Ctrl+C to stop.\n');

  const { blid, password, ip: roombaIp } = config.roomba;
  const robot = new dorita980.Local(blid, password, roombaIp);
  const session = { config, robot, lastPhase: null };

  robot.on('error', err => console.error('Roomba connection error:', err.message));

  await pollRoomba(session);
  schedulePolling(() => pollRoomba(session), () => POLL_INTERVAL_MS);

  process.on('SIGINT', () => disconnect(robot));
}

async function pollRoomba(session) {
  try {
    const robotState = await session.robot.getRobotState(['cleanMissionStatus', 'batPct']);
    const mission = parseMission(robotState.cleanMissionStatus);

    if (mission.phase !== session.lastPhase) {
      await announcePhase(session, mission.phase, robotState.batPct);
    }
  } catch (err) {
    console.error(`Error polling Roomba: ${err.message}`);
  }
}

async function announcePhase(session, phase, batteryPercent) {
  const rgb = PHASE_COLORS[phase] || UNKNOWN_PHASE_COLOR;

  console.log(`${new Date().toLocaleTimeString()} - Roomba phase: ${phase}`);
  console.log(`  Battery: ${batteryPercent}%`);
  console.log(`  RGB: (${rgb.red}, ${rgb.green}, ${rgb.blue})`);

  await setNanoleafColor(session.config, rgb, { hueBrightness: ROOMBA_HUE_BRIGHTNESS, useAnimation: false });
  session.lastPhase = phase;
}

function parseMission(mission) {
  if (!mission) {
    return { phase: 'unknown', cycle: 'none' };
  }

  return {
    phase: MISSION_PHASES[mission.phase] || mission.phase || 'unknown',
    cycle: mission.cycle || 'none'
  };
}

function disconnect(robot) {
  console.log('\nDisconnecting from Roomba...');
  robot.end();
  process.exit(0);
}

module.exports = { syncRoombaDevice };
