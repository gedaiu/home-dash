export const $ = (sel) => document.querySelector(sel);
export const $$ = (sel) => document.querySelectorAll(sel);

export const CATEGORY_ICONS = {
  motion: 'scan-eye',
  temperature: 'thermometer',
  lightlevel: 'sun-dim',
  daylight: 'sun',
  switch: 'toggle-left',
  sensor: 'radio',
  plug: 'plug',
  strip: 'grip-horizontal',
  candle: 'flame',
  spot: 'circle-dot',
  ceiling: 'lamp-ceiling',
  lamp: 'lamp-desk',
  bulb: 'lightbulb',
  device: 'cpu',
  pm25: 'wind'
};

export const SYNCABLE_CATEGORIES = ['bulb', 'lamp', 'spot', 'ceiling', 'strip', 'candle'];

export const ARCHETYPE_ICONS = {
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

export const ROOM_ICONS = {
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

export function formatRemainingTime(seconds) {
  if (!seconds) {
    return '--:--';
  }
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${mins}m`;
  }
  return `${mins}m`;
}

export function formatTimeAgo(isoString) {
  if (!isoString || isoString === 'none') {
    return '';
  }

  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now - date;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) {
    return 'just now';
  }
  if (diffMin === 1) {
    return '1 min ago';
  }
  if (diffMin < 60) {
    return `${diffMin} min ago`;
  }
  if (diffHour === 1) {
    return '1 hour ago';
  }
  if (diffHour < 24) {
    return `${diffHour} hours ago`;
  }
  if (diffDay === 1) {
    return '1 day ago';
  }
  return `${diffDay} days ago`;
}

export function getDeviceIcon(category, archetype) {
  if (archetype && ARCHETYPE_ICONS[archetype]) {
    return ARCHETYPE_ICONS[archetype];
  }
  return CATEGORY_ICONS[category] || 'cpu';
}

export function getRoomIcon(roomClass) {
  return ROOM_ICONS[roomClass] || 'layout-grid';
}

export function getLast24hValues(history) {
  if (!history || history.length === 0) {
    return [];
  }

  if (typeof history[0] === 'number') {
    return history;
  }

  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  return history.filter(e => e.t >= cutoff).map(e => e.v);
}

export function renderSparkline(history, color) {
  const values = getLast24hValues(history);

  if (values.length < 2) {
    return `
      <div class="sparkline">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none">
          <line x1="0" y1="50" x2="100" y2="50" stroke="#666" stroke-width="2" stroke-dasharray="4,4" vector-effect="non-scaling-stroke" opacity="0.5"/>
        </svg>
      </div>
    `;
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const points = values.map((val, i) => {
    const x = (i / (values.length - 1)) * 100;
    const y = 100 - ((val - min) / range) * 100;
    return `${x},${y}`;
  }).join(' ');

  return `
    <div class="sparkline">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none">
        <polyline points="${points}" fill="none" stroke="${color}" stroke-width="2" vector-effect="non-scaling-stroke"/>
      </svg>
    </div>
  `;
}

export function getLastMotionDetections(history) {
  if (!history || history.length === 0) {
    return [];
  }

  const detections = [];
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].v === 1) {
      const time = new Date(history[i].t);
      const hours = time.getHours().toString().padStart(2, '0');
      const mins = time.getMinutes().toString().padStart(2, '0');
      detections.push(`${hours}:${mins}`);
    }
  }

  return detections;
}

export function getLightColor(state) {
  if (!state.on || state.reachable === false) {
    return '#333';
  }

  if (state.colormode === 'ct') {
    const kelvin = Math.round(1000000 / state.ct);
    if (kelvin < 4000) {
      return '#ffcc88';
    }
    return '#fff5e6';
  }

  if (state.hue !== undefined && state.sat !== undefined) {
    const h = (state.hue / 65535) * 360;
    const s = (state.sat / 254) * 100;
    return `hsl(${h}, ${s}%, 50%)`;
  }

  return '#fff';
}

export function getStateText(light) {
  if (light.isSensor) {
    if (light.state.temperature !== undefined) {
      return `${light.state.temperature.toFixed(1)}C`;
    }
    if (light.state.presence !== undefined) {
      return light.state.presence ? 'MOTION' : 'CLEAR';
    }
    if (light.state.lightlevel !== undefined) {
      return `${light.state.lightlevel} lux`;
    }
    return '--';
  }

  if (light.state.reachable === false) {
    return 'OFFLINE';
  }

  if (!light.state.on) {
    return 'OFF';
  }

  if (light.state.bri !== undefined) {
    return `${Math.round(light.state.bri / 254 * 100)}%`;
  }

  return 'ON';
}
