import { CATEGORY_ICONS, ARCHETYPE_ICONS, ROOM_ICONS } from './icon-maps.js';

const queryOne = (selector) => document.querySelector(selector);
const queryAll = (selector) => document.querySelectorAll(selector);

export { queryOne as $, queryAll as $$ };
export { CATEGORY_ICONS, ARCHETYPE_ICONS, ROOM_ICONS, SYNCABLE_CATEGORIES } from './icon-maps.js';

const MS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;
const SECONDS_PER_HOUR = SECONDS_PER_MINUTE * MINUTES_PER_HOUR;
const MS_PER_DAY = HOURS_PER_DAY * SECONDS_PER_HOUR * MS_PER_SECOND;
const CHART_SIZE = 100;
const MIRED_TO_KELVIN_FACTOR = 1000000;
const WARM_WHITE_MAX_KELVIN = 4000;
const HUE_MAX = 65535;
const DEGREES_IN_CIRCLE = 360;
const SATURATION_MAX = 254;
const BRIGHTNESS_MAX = 254;
const PERCENT = 100;

export function formatRemainingTime(seconds) {
  if (!seconds) {
    return '--:--';
  }

  const hours = Math.floor(seconds / SECONDS_PER_HOUR);
  const mins = Math.floor((seconds % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE);

  if (hours > 0) {
    return `${hours}h ${mins}m`;
  }

  return `${mins}m`;
}

export function formatTimeAgo(isoString) {
  if (!isoString || isoString === 'none') {
    return '';
  }

  const diffMs = new Date() - new Date(isoString);

  return describeElapsedSeconds(Math.floor(diffMs / MS_PER_SECOND));
}

function describeElapsedSeconds(diffSec) {
  const diffMin = Math.floor(diffSec / SECONDS_PER_MINUTE);
  const diffHour = Math.floor(diffMin / MINUTES_PER_HOUR);
  const diffDay = Math.floor(diffHour / HOURS_PER_DAY);

  if (diffSec < SECONDS_PER_MINUTE) {
    return 'just now';
  }

  if (diffMin < MINUTES_PER_HOUR) {
    return `${diffMin} min ago`;
  }

  if (diffHour < HOURS_PER_DAY) {
    return pluralAgo(diffHour, 'hour');
  }

  return pluralAgo(diffDay, 'day');
}

function pluralAgo(count, unit) {
  return count === 1 ? `1 ${unit} ago` : `${count} ${unit}s ago`;
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

  const cutoff = Date.now() - MS_PER_DAY;

  return history.filter(entry => entry.t >= cutoff).map(entry => entry.v);
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

  const points = values.map((reading, index) => {
    const xPercent = (index / (values.length - 1)) * CHART_SIZE;
    const yPercent = CHART_SIZE - ((reading - min) / range) * CHART_SIZE;

    return `${xPercent},${yPercent}`;
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
    return colorTemperatureColor(state.ct);
  }

  if (state.hue !== undefined && state.sat !== undefined) {
    const hueDegrees = (state.hue / HUE_MAX) * DEGREES_IN_CIRCLE;
    const saturationPercent = (state.sat / SATURATION_MAX) * PERCENT;

    return `hsl(${hueDegrees}, ${saturationPercent}%, 50%)`;
  }

  return '#fff';
}

function colorTemperatureColor(mired) {
  const kelvin = Math.round(MIRED_TO_KELVIN_FACTOR / mired);

  return kelvin < WARM_WHITE_MAX_KELVIN ? '#ffcc88' : '#fff5e6';
}

export function getStateText(light) {
  const { state } = light;

  if (light.isSensor) {
    return getSensorText(state);
  }

  if (state.reachable === false) {
    return 'OFFLINE';
  }

  if (!state.on) {
    return 'OFF';
  }

  if (state.bri !== undefined) {
    return `${Math.round(state.bri / BRIGHTNESS_MAX * PERCENT)}%`;
  }

  return 'ON';
}

function getSensorText(state) {
  if (state.temperature !== undefined) {
    return `${state.temperature.toFixed(1)}C`;
  }

  if (state.presence !== undefined) {
    return state.presence ? 'MOTION' : 'CLEAR';
  }

  if (state.lightlevel !== undefined) {
    return `${state.lightlevel} lux`;
  }

  return '--';
}
