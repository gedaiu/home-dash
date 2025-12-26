#!/usr/bin/env node

const { api } = require('node-hue-api');
const axios = require('axios');
const fs = require('node:fs');
const dorita980 = require('dorita980');

const CONFIG_FILE = './network-config.json';
const POLL_INTERVAL_SLOW_MS = 5000;
const POLL_INTERVAL_FAST_MS = 1000;
const FAST_POLL_DURATION_MS = 10000;
const SATURATION_THRESHOLD = 50;
const DEFAULT_MIN_BRIGHTNESS = 5;
const DEFAULT_MAX_BRIGHTNESS = 100;

function loadConfig() {
  if (!fs.existsSync(CONFIG_FILE)) {
    return null;
  }

  try {
    const data = fs.readFileSync(CONFIG_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return null;
  }
}

function roombaPhaseToColor(phase) {
  const phaseColors = {
    'charging': { r: 0, g: 255, b: 0 },
    'cleaning': { r: 0, g: 150, b: 255 },
    'stuck': { r: 255, g: 0, b: 0 },
    'stopped': { r: 100, g: 100, b: 100 },
    'paused': { r: 255, g: 200, b: 0 },
    'returning': { r: 255, g: 165, b: 0 },
    'docking': { r: 255, g: 200, b: 0 },
    'emptying': { r: 150, g: 0, b: 255 },
    'error': { r: 255, b: 0, g: 0 },
    'cancelled': { r: 200, g: 200, b: 200 }
  };
  return phaseColors[phase] || { r: 128, g: 128, b: 128 };
}

function hueToRgb(hue, sat, bri) {
  const h = hue / 65535;
  const s = sat / 254;
  const v = bri / 254;

  let r, g, b;
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);

  switch (i % 6) {
    case 0: r = v; g = t; b = p; break;
    case 1: r = q; g = v; b = p; break;
    case 2: r = p; g = v; b = t; break;
    case 3: r = p; g = q; b = v; break;
    case 4: r = t; g = p; b = v; break;
    case 5: r = v; g = p; b = q; break;
  }

  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255)
  };
}

function ctToRgb(ct, bri) {
  const kelvin = Math.round(1000000 / ct);
  const temp = kelvin / 100;
  const brightness = bri / 254;

  let r, g, b;

  if (temp <= 66) {
    r = 255;
    g = temp;
    g = 99.4708025861 * Math.log(g) - 161.1195681661;
    if (temp <= 19) {
      b = 0;
    } else {
      b = temp - 10;
      b = 138.5177312231 * Math.log(b) - 305.0447927307;
    }
  } else {
    r = temp - 60;
    r = 329.698727446 * Math.pow(r, -0.1332047592);
    g = temp - 60;
    g = 288.1221695283 * Math.pow(g, -0.0755148492);
    b = 255;
  }

  return {
    r: Math.round(Math.min(255, Math.max(0, r)) * brightness),
    g: Math.round(Math.min(255, Math.max(0, g)) * brightness),
    b: Math.round(Math.min(255, Math.max(0, b)) * brightness)
  };
}

function xyToRgb(x, y, bri) {
  const brightness = bri / 254;

  const z = 1.0 - x - y;
  const Y = brightness;
  const X = (Y / y) * x;
  const Z = (Y / y) * z;

  let r = X * 1.656492 - Y * 0.354851 - Z * 0.255038;
  let g = -X * 0.707196 + Y * 1.655397 + Z * 0.036152;
  let b = X * 0.051713 - Y * 0.121364 + Z * 1.011530;

  r = r <= 0.0031308 ? 12.92 * r : (1.0 + 0.055) * Math.pow(r, 1.0 / 2.4) - 0.055;
  g = g <= 0.0031308 ? 12.92 * g : (1.0 + 0.055) * Math.pow(g, 1.0 / 2.4) - 0.055;
  b = b <= 0.0031308 ? 12.92 * b : (1.0 + 0.055) * Math.pow(b, 1.0 / 2.4) - 0.055;

  const maxVal = Math.max(r, g, b);
  if (maxVal > 1) {
    r /= maxVal;
    g /= maxVal;
    b /= maxVal;
  }

  return {
    r: Math.round(Math.min(255, Math.max(0, r * 255))),
    g: Math.round(Math.min(255, Math.max(0, g * 255))),
    b: Math.round(Math.min(255, Math.max(0, b * 255)))
  };
}

function isCloseToWhite(state) {
  if (state.colormode === 'ct') {
    return true;
  }

  if (state.colormode === 'hs' || state.colormode === 'xy') {
    const satPercent = (state.sat / 254) * 100;
    return satPercent < SATURATION_THRESHOLD;
  }

  return true;
}

function mapBrightness(hueBrightness, config) {
  const minBri = config.nanoleaf?.minBrightness ?? DEFAULT_MIN_BRIGHTNESS;
  const maxBri = config.nanoleaf?.maxBrightness ?? DEFAULT_MAX_BRIGHTNESS;
  const huePercent = hueBrightness / 254;
  return Math.round(minBri + huePercent * (maxBri - minBri));
}

function getLightRgb(state) {
  if (!state.on) {
    return { r: 0, g: 0, b: 0 };
  }

  if (state.colormode === 'ct') {
    return ctToRgb(state.ct, state.bri);
  }

  if (state.colormode === 'xy' && state.xy) {
    return xyToRgb(state.xy[0], state.xy[1], state.bri);
  }

  if (state.colormode === 'hs') {
    return hueToRgb(state.hue || 0, state.sat || 0, state.bri);
  }

  const brightness = Math.round((state.bri / 254) * 255);
  return { r: brightness, g: brightness, b: brightness };
}

function stateChanged(prev, curr) {
  if (!prev) {
    return true;
  }

  const xyChanged = prev.xy?.[0] !== curr.xy?.[0] || prev.xy?.[1] !== curr.xy?.[1];

  return prev.on !== curr.on ||
    prev.bri !== curr.bri ||
    prev.hue !== curr.hue ||
    prev.sat !== curr.sat ||
    prev.ct !== curr.ct ||
    prev.colormode !== curr.colormode ||
    xyChanged;
}

async function createOrUpdateEffect(config, hue, sat, bri) {
  const { ip, port, authToken } = config.nanoleaf;
  const baseUrl = `http://${ip}:${port || 16021}/api/v1/${authToken}`;

  const effect = {
    command: 'add',
    animName: 'HueSync',
    animType: 'random',
    colorType: 'HSB',
    palette: [
      { hue: hue, saturation: sat, brightness: 100 },
      { hue: hue, saturation: sat, brightness: 40 }
    ],
    brightnessRange: { minValue: 40, maxValue: 100 },
    transTime: { minValue: 20, maxValue: 30 },
    delayTime: { minValue: 10, maxValue: 20 },
    loop: true
  };

  await axios.put(`${baseUrl}/effects`, { write: effect }, { timeout: 5000 });
  await axios.put(`${baseUrl}/state`, { brightness: { value: bri } }, { timeout: 5000 });
}

async function selectEffect(config, effectName) {
  const { ip, port, authToken } = config.nanoleaf;
  const baseUrl = `http://${ip}:${port || 16021}/api/v1/${authToken}`;

  await axios.put(`${baseUrl}/effects`, { select: effectName }, { timeout: 5000 });
}

async function setNanoleafColor(config, rgb, hueBrightness, useAnimation) {
  const { ip, port, authToken } = config.nanoleaf;
  const baseUrl = `http://${ip}:${port || 16021}/api/v1/${authToken}`;

  if (rgb.r === 0 && rgb.g === 0 && rgb.b === 0) {
    await axios.put(`${baseUrl}/state`, { on: { value: false } }, { timeout: 5000 });
    return;
  }

  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
  const hue = Math.round(hsl.h);
  const sat = Math.round(hsl.s);
  const bri = mapBrightness(hueBrightness, config);

  await axios.put(`${baseUrl}/state`, { on: { value: true } }, { timeout: 5000 });

  if (useAnimation) {
    try {
      await createOrUpdateEffect(config, hue, sat, bri);
      await selectEffect(config, 'HueSync');
    } catch (err) {
      console.error('Effect error:', err.response?.data || err.message);
    }
  } else {
    const state = {
      hue: { value: hue },
      sat: { value: sat },
      brightness: { value: bri }
    };
    await axios.put(`${baseUrl}/state`, state, { timeout: 5000 });
  }
}

function rgbToHsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;

  let h = 0;
  let s = 0;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  return {
    h: h * 360,
    s: s * 100,
    l: l * 100
  };
}

async function syncHueDevice(config) {
  const minBri = config.nanoleaf?.minBrightness ?? DEFAULT_MIN_BRIGHTNESS;
  const maxBri = config.nanoleaf?.maxBrightness ?? DEFAULT_MAX_BRIGHTNESS;

  console.log(`Syncing: "${config.sync.hueDeviceName || config.sync.deviceName}" -> Nanoleaf`);
  console.log(`Poll interval: ${POLL_INTERVAL_SLOW_MS}ms (${POLL_INTERVAL_FAST_MS}ms for ${FAST_POLL_DURATION_MS / 1000}s after change)`);
  console.log(`Saturation threshold for animation: ${SATURATION_THRESHOLD}%`);
  console.log(`Nanoleaf brightness range: ${minBri}% - ${maxBri}%`);
  console.log('\nPress Ctrl+C to stop.\n');

  const hueApi = await api.createLocal(config.hue.ip).connect(config.hue.username);
  let lastState = null;
  let nanoleafOff = false;
  let fastPollUntil = 0;

  const schedulePoll = () => {
    const now = Date.now();
    const interval = now < fastPollUntil ? POLL_INTERVAL_FAST_MS : POLL_INTERVAL_SLOW_MS;
    setTimeout(async () => {
      await poll();
      schedulePoll();
    }, interval);
  };

  const poll = async () => {
    try {
      const deviceId = config.sync.hueDeviceId || config.sync.deviceId;
      const light = await hueApi.lights.getLight(deviceId);
      const state = light.state || light._data?.state;

      if (!state.on) {
        if (!nanoleafOff) {
          console.log(`${new Date().toLocaleTimeString()} - Hue light OFF, turning Nanoleaf OFF`);
          await setNanoleafColor(config, { r: 0, g: 0, b: 0 }, 0, false);
          nanoleafOff = true;
          lastState = { ...state };
          fastPollUntil = Date.now() + FAST_POLL_DURATION_MS;
        }
        return;
      }

      nanoleafOff = false;

      if (stateChanged(lastState, state)) {
        console.log('Raw Hue state:', {
          on: state.on,
          bri: state.bri,
          hue: state.hue,
          sat: state.sat,
          ct: state.ct,
          xy: state.xy,
          colormode: state.colormode
        });

        const rgb = getLightRgb(state);
        const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
        const isWhite = isCloseToWhite(state);
        const useAnimation = !isWhite;

        console.log('Converted RGB:', rgb);
        console.log('Converted HSL for Nanoleaf:', {
          hue: Math.round(hsl.h),
          sat: Math.round(hsl.s),
          bri: Math.max(1, Math.round(hsl.l))
        });

        const colorInfo = `RGB(${rgb.r}, ${rgb.g}, ${rgb.b})`;
        const animInfo = useAnimation ? 'with animation' : 'no animation';

        console.log(`${new Date().toLocaleTimeString()} - ${colorInfo} ${animInfo}`);

        await setNanoleafColor(config, rgb, state.bri, useAnimation);
        lastState = { ...state };
        fastPollUntil = Date.now() + FAST_POLL_DURATION_MS;
      }
    } catch (err) {
      console.error(`Error: ${err.message}`);
    }
  };

  await poll();
  schedulePoll();
}

function parseMission(mission) {
  if (!mission) {
    return { phase: 'unknown', cycle: 'none' };
  }

  const phaseMap = {
    'charge': 'charging',
    'run': 'cleaning',
    'stuck': 'stuck',
    'stop': 'stopped',
    'pause': 'paused',
    'hmMidMsn': 'returning',
    'hmPostMsn': 'returning',
    'hmUsrDock': 'docking',
    'evac': 'emptying',
    'chargingerror': 'error',
    'cancelled': 'cancelled'
  };

  return {
    phase: phaseMap[mission.phase] || mission.phase || 'unknown',
    cycle: mission.cycle || 'none'
  };
}

async function syncRoombaDevice(config) {
  console.log(`Syncing: Roomba -> Nanoleaf`);
  console.log(`Poll interval: ${POLL_INTERVAL_SLOW_MS}ms`);
  console.log('\nPress Ctrl+C to stop.\n');

  const { blid, password, ip } = config.roomba;
  const robot = new dorita980.Local(blid, password, ip);
  let lastPhase = null;

  robot.on('error', (err) => {
    console.error('Roomba connection error:', err.message);
  });

  const poll = async () => {
    try {
      const state = await robot.getRobotState(['cleanMissionStatus', 'batPct']);
      const mission = parseMission(state.cleanMissionStatus);

      if (mission.phase !== lastPhase) {
        const rgb = roombaPhaseToColor(mission.phase);

        console.log(`${new Date().toLocaleTimeString()} - Roomba phase: ${mission.phase}`);
        console.log(`  Battery: ${state.batPct}%`);
        console.log(`  RGB: (${rgb.r}, ${rgb.g}, ${rgb.b})`);

        await setNanoleafColor(config, rgb, 200, false);
        lastPhase = mission.phase;
      }
    } catch (err) {
      console.error(`Error polling Roomba: ${err.message}`);
    }
  };

  const schedulePoll = () => {
    setTimeout(async () => {
      await poll();
      schedulePoll();
    }, POLL_INTERVAL_SLOW_MS);
  };

  await poll();
  schedulePoll();

  process.on('SIGINT', () => {
    console.log('\nDisconnecting from Roomba...');
    robot.end();
    process.exit(0);
  });
}

async function main() {
  console.log('=== Device to Nanoleaf Sync ===\n');

  const config = loadConfig();

  if (!config) {
    console.log('No configuration found. Run "node scan.js" first.');
    process.exit(1);
  }

  const deviceType = config.sync?.deviceType || (config.sync?.hueDeviceId ? 'hue' : null);

  if (!deviceType && !config.sync?.hueDeviceId) {
    console.log('No sync device configured. Run "node setup-sync.js" first.');
    process.exit(1);
  }

  if (deviceType === 'roomba') {
    if (!config.roomba?.ip || !config.roomba?.blid || !config.roomba?.password) {
      console.log('Roomba not fully configured. Run "node scan.js" to configure Roomba credentials.');
      process.exit(1);
    }
    await syncRoombaDevice(config);
  } else {
    await syncHueDevice(config);
  }
}

main();
