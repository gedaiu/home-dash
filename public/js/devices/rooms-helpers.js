const ROOM_ICONS = {
  'living_room': 'sofa',
  'kitchen': 'utensils',
  'dining': 'utensils-crossed',
  'bedroom': 'bed-double',
  'kids_bedroom': 'baby',
  'bathroom': 'bath',
  'nursery': 'baby',
  'recreation': 'gamepad-2',
  'office': 'briefcase',
  'gym': 'dumbbell',
  'hallway': 'door-open',
  'toilet': 'droplets',
  'front_door': 'door-closed',
  'garage': 'warehouse',
  'terrace': 'trees',
  'garden': 'flower-2',
  'driveway': 'car',
  'carport': 'car',
  'home': 'home',
  'downstairs': 'arrow-down',
  'upstairs': 'arrow-up',
  'top_floor': 'arrow-up-to-line',
  'attic': 'triangle',
  'guest_room': 'bed-single',
  'staircase': 'stairs',
  'lounge': 'armchair',
  'man_cave': 'gamepad-2',
  'computer': 'monitor',
  'studio': 'music',
  'music': 'music-2',
  'tv': 'tv',
  'reading': 'book-open',
  'closet': 'shirt',
  'storage': 'archive',
  'laundry_room': 'washing-machine',
  'balcony': 'fence',
  'porch': 'lamp',
  'barbecue': 'flame',
  'pool': 'waves',
  'other': 'layout-grid'
};

const ARCHETYPE_ICONS = {
  'sultanbulb': 'lightbulb',
  'classicbulb': 'lightbulb',
  'vintagebulb': 'lightbulb',
  'candlebulb': 'lightbulb',
  'spotbulb': 'circle-dot',
  'recessedceiling': 'circle-dot',
  'recessedfloor': 'circle-dot',
  'pendantround': 'lamp-ceiling',
  'pendantlong': 'lamp-ceiling',
  'ceilinghorizontal': 'lamp-ceiling',
  'ceilingvertical': 'lamp-ceiling',
  'ceilinground': 'lamp-ceiling',
  'ceilingsquare': 'lamp-ceiling',
  'flexiblelamp': 'lamp-desk',
  'tablelamp': 'lamp-desk',
  'tableshade': 'lamp-desk',
  'floorlamp': 'lamp-floor',
  'floorlantern': 'lamp-floor',
  'floorshade': 'lamp-floor',
  'singlespot': 'circle-dot',
  'doublespot': 'circle-dot',
  'walllantern': 'lamp-wall-down',
  'wallshade': 'lamp-wall-down',
  'wallspot': 'lamp-wall-down',
  'plug': 'plug',
  'lightstrip': 'grip-horizontal',
  'huelightstrip': 'grip-horizontal',
  'hueplay': 'tv',
  'huego': 'battery',
  'huebloom': 'sparkles',
  'hueiris': 'sparkles',
  'twilight': 'moon-star',
  'bollard': 'cylinder',
  'christmastree': 'tree-pine'
};

const CATEGORY_ICONS = {
  plug: 'plug',
  strip: 'grip-horizontal',
  candle: 'flame',
  spot: 'circle-dot',
  ceiling: 'lamp-ceiling',
  lamp: 'lamp-desk',
  bulb: 'lightbulb',
  device: 'cpu'
};

const OFF_COLOR = '#333';
const MIRED_TO_KELVIN = 1000000;
const WARM_KELVIN_LIMIT = 4000;
const HUE_MAX = 65535;
const DEGREES_IN_CIRCLE = 360;
const SATURATION_MAX = 254;
const BRIGHTNESS_MAX = 254;
const PERCENT = 100;

export function getRoomIcon(roomClass) {
  return ROOM_ICONS[roomClass] || 'layout-grid';
}

export function getDeviceIcon(category, archetype) {
  if (archetype && ARCHETYPE_ICONS[archetype]) {
    return ARCHETYPE_ICONS[archetype];
  }

  return CATEGORY_ICONS[category] || 'cpu';
}

export function getLightColor(state) {
  if (!state.on || state.reachable === false) {
    return OFF_COLOR;
  }

  if (state.colormode === 'ct') {
    return getColorTemperatureColor(state.ct);
  }

  if (state.hue !== undefined && state.sat !== undefined) {
    const hue = (state.hue / HUE_MAX) * DEGREES_IN_CIRCLE;
    const saturation = (state.sat / SATURATION_MAX) * PERCENT;

    return `hsl(${hue}, ${saturation}%, 50%)`;
  }

  return '#fff';
}

export function getStateText(light) {
  if (light.state.reachable === false) {
    return 'OFFLINE';
  }

  if (!light.state.on) {
    return 'OFF';
  }

  if (light.state.bri !== undefined) {
    return `${Math.round(light.state.bri / BRIGHTNESS_MAX * PERCENT)}%`;
  }

  return 'ON';
}

export function getNanoleafColor(state) {
  if (!state?.on) {
    return OFF_COLOR;
  }

  if (state.hue !== undefined && state.sat !== undefined) {
    return `hsl(${state.hue}, ${state.sat}%, 50%)`;
  }

  return '#fff';
}

function getColorTemperatureColor(mired) {
  const kelvin = Math.round(MIRED_TO_KELVIN / mired);

  return kelvin < WARM_KELVIN_LIMIT ? '#ffcc88' : '#fff5e6';
}
