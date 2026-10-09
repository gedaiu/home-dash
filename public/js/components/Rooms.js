import { html } from 'https://esm.sh/htm@3.1.1/preact';
import { useState, useEffect } from 'https://esm.sh/preact@10.19.3/hooks';
import { effect } from 'https://esm.sh/@preact/signals@1.2.1';
import { roomsState, getPanelDisplayName } from '../state.js';
import { API } from '../api.js';

const ROOM_ICONS = {
  'living_room': 'sofa', 'kitchen': 'utensils', 'dining': 'utensils-crossed',
  'bedroom': 'bed-double', 'kids_bedroom': 'baby', 'bathroom': 'bath',
  'office': 'briefcase', 'gym': 'dumbbell', 'hallway': 'door-open',
  'garage': 'warehouse', 'terrace': 'trees', 'garden': 'flower-2',
  'home': 'home', 'attic': 'triangle', 'staircase': 'stairs',
  'lounge': 'armchair', 'computer': 'monitor', 'tv': 'tv',
  'laundry_room': 'washing-machine', 'balcony': 'fence', 'other': 'layout-grid'
};

const ARCHETYPE_ICONS = {
  'sultanbulb': 'lightbulb', 'classicbulb': 'lightbulb', 'spotbulb': 'circle-dot',
  'pendantround': 'lamp-ceiling', 'ceilinground': 'lamp-ceiling',
  'flexiblelamp': 'lamp-desk', 'tablelamp': 'lamp-desk', 'floorlamp': 'lamp-floor',
  'plug': 'plug', 'lightstrip': 'grip-horizontal', 'hueplay': 'tv'
};

const CATEGORY_ICONS = {
  plug: 'plug', strip: 'grip-horizontal', candle: 'flame',
  spot: 'circle-dot', ceiling: 'lamp-ceiling', lamp: 'lamp-desk', bulb: 'lightbulb'
};

const OFF_LIGHT_COLOR = '#333';
const DEFAULT_LIGHT_COLOR = '#ffcc00';
const HUE_MAX_BRIGHTNESS = 254;
const PERCENT = 100;
const RGB_MAX = 255;
const GAMMA_THRESHOLD = 0.0031308;
const GAMMA_SCALE = 1.055;
const GAMMA_DIVISOR = 2.4;
const GAMMA_EXPONENT = 1 / GAMMA_DIVISOR;
const GAMMA_OFFSET = 0.055;
const LINEAR_SCALE = 12.92;
const XYZ_TO_RGB_ROWS = [
  { xWeight: 3.2406, yWeight: -1.5372, zWeight: -0.4986 },
  { xWeight: -0.9689, yWeight: 1.8758, zWeight: 0.0415 },
  { xWeight: 0.0557, yWeight: -0.2040, zWeight: 1.0570 }
];
const MIREDS_TO_KELVIN = 1000000;
const KELVIN_SCALE = 100;
const WARM_LIMIT = 66;
const COOL_SHIFT = 60;
const BLUE_SHIFT = 10;
const BLUE_DARK_LIMIT = 19;
const WARM_GREEN = { scale: 99.4708, offset: 161.1196 };
const COOL_RED = { scale: 329.698, exponent: -0.1332 };
const COOL_GREEN = { scale: 288.122, exponent: -0.0755 };
const BLUE_CURVE = { scale: 138.5177, offset: 305.0448 };

export function renderRooms() {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => subscribeRooms({ setRooms, setLoading }), []);

  useEffect(refreshIcons, [rooms]);

  if (loading) {
    return html`<div class="loading">Loading rooms...</div>`;
  }

  if (rooms.length === 0) {
    return html`<div class="loading">No rooms found. Configure Hue Bridge first.</div>`;
  }

  return html`
    ${rooms.map(room => html`<${roomPanel} key=${room.id} room=${room} />`)}
  `;
}

export { renderRooms as Rooms };

function subscribeRooms({ setRooms, setLoading }) {
  loadRooms(setLoading);

  return effect(() => {
    const allRooms = roomsState.value || [];
    setRooms(allRooms.filter(room => room.id !== 'sensors'));
  });
}

async function loadRooms(setLoading) {
  try {
    const loadedRooms = await API.hue.rooms();
    roomsState.value = loadedRooms || [];
    setLoading(false);
  } catch (err) {
    console.error('Failed to load rooms:', err);
    setLoading(false);
  }
}

function refreshIcons() {
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

function roomPanel({ room, selectedLightId }) {
  const roomIcon = getRoomIcon(room.class);
  const panelKey = `room:${room.id}`;
  const defaultName = room.name.toUpperCase();
  const displayName = getPanelDisplayName(panelKey, defaultName);

  return html`
    <section class="panel room-panel" data-panel-key=${panelKey} data-default-name=${defaultName}>
      <div class="panel-header">
        <i data-lucide=${roomIcon}></i>
        <span class="panel-title">${displayName}</span>
      </div>
      <div class="panel-content">
        <div class="lights-list">
          ${room.lights.map(light => html`
            <${lightItem} key=${light.id} light=${light} isSelected=${String(light.id) === String(selectedLightId)} />
          `)}
        </div>
      </div>
    </section>
  `;
}

function getRoomIcon(roomClass) {
  return ROOM_ICONS[roomClass] || 'layout-grid';
}

function lightItem({ light, isSelected }) {
  const isOn = light.state.on && light.state.reachable !== false;
  const isOffline = light.state.reachable === false;
  const color = getLightColor(light.state);
  const icon = getDeviceIcon(light.category, light.archetype);
  const stateText = getStateText(light);

  return html`
    <div class="light-item ${isSelected ? 'selected' : ''} ${isOffline ? 'offline' : ''}"
         data-id=${light.id} data-name=${light.name} data-category=${light.category}>
      <i data-lucide=${icon} class="device-icon ${isOn ? 'on' : ''}"></i>
      <span class="light-indicator ${isOn ? 'on' : ''}" style="background-color: ${color}"></span>
      <span class="light-name">${light.name}</span>
      <span class="light-state">${stateText}</span>
    </div>
  `;
}

function getDeviceIcon(category, archetype) {
  if (archetype && ARCHETYPE_ICONS[archetype]) {
    return ARCHETYPE_ICONS[archetype];
  }

  return CATEGORY_ICONS[category] || 'cpu';
}

function getLightColor(state) {
  if (isOffOrUnreachable(state)) {
    return OFF_LIGHT_COLOR;
  }

  if (hasXyColor(state)) {
    return xyToRgb(state);
  }

  if (hasColorTemperature(state)) {
    return colorTemperatureToRgb(state.ct);
  }

  return DEFAULT_LIGHT_COLOR;
}

function isOffOrUnreachable(state) {
  return !state.on || state.reachable === false;
}

function hasXyColor(state) {
  return state.colormode === 'xy' && state.xy;
}

function hasColorTemperature(state) {
  return state.colormode === 'ct' && state.ct;
}

function xyToRgb(state) {
  const [chromaX, chromaY] = state.xy;
  const chromaZ = 1 - chromaX - chromaY;
  const luminance = state.bri / HUE_MAX_BRIGHTNESS;
  const cieX = (luminance / chromaY) * chromaX;
  const cieZ = (luminance / chromaY) * chromaZ;
  const [red, green, blue] = XYZ_TO_RGB_ROWS.map(row => {
    const linear = cieX * row.xWeight + luminance * row.yWeight + cieZ * row.zWeight;

    return clampChannel(Math.round(gammaEncode(linear) * RGB_MAX));
  });

  return `rgb(${red},${green},${blue})`;
}

function gammaEncode(linear) {
  return linear > GAMMA_THRESHOLD
    ? GAMMA_SCALE * Math.pow(linear, GAMMA_EXPONENT) - GAMMA_OFFSET
    : LINEAR_SCALE * linear;
}

function clampChannel(channel) {
  return Math.min(RGB_MAX, Math.max(0, channel));
}

function colorTemperatureToRgb(mireds) {
  const kelvin = Math.round(MIREDS_TO_KELVIN / mireds);
  const scaledKelvin = kelvin / KELVIN_SCALE;
  const red = Math.round(temperatureRed(scaledKelvin));
  const green = Math.round(temperatureGreen(scaledKelvin));
  const blue = Math.round(temperatureBlue(scaledKelvin));

  return `rgb(${red},${green},${blue})`;
}

function temperatureRed(scaledKelvin) {
  if (scaledKelvin <= WARM_LIMIT) {
    return RGB_MAX;
  }

  return clampChannel(COOL_RED.scale * Math.pow(scaledKelvin - COOL_SHIFT, COOL_RED.exponent));
}

function temperatureGreen(scaledKelvin) {
  if (scaledKelvin <= WARM_LIMIT) {
    return clampChannel(WARM_GREEN.scale * Math.log(scaledKelvin) - WARM_GREEN.offset);
  }

  return clampChannel(COOL_GREEN.scale * Math.pow(scaledKelvin - COOL_SHIFT, COOL_GREEN.exponent));
}

function temperatureBlue(scaledKelvin) {
  if (scaledKelvin >= WARM_LIMIT) {
    return RGB_MAX;
  }

  if (scaledKelvin <= BLUE_DARK_LIMIT) {
    return 0;
  }

  return clampChannel(BLUE_CURVE.scale * Math.log(scaledKelvin - BLUE_SHIFT) - BLUE_CURVE.offset);
}

function getStateText(light) {
  if (light.state.reachable === false) {
    return 'Offline';
  }

  if (!light.state.on) {
    return 'Off';
  }

  return `${Math.round((light.state.bri / HUE_MAX_BRIGHTNESS) * PERCENT)}%`;
}
