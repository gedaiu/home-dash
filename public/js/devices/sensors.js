import { html } from 'htm/preact';
import { useEffect } from 'preact/hooks';
import { sensors, addLog, panelNames, getPanelName } from '../state.js';
import { API } from '../api.js';

const CATEGORY_ICONS = {
  motion: 'scan-eye',
  temperature: 'thermometer',
  lightlevel: 'sun-dim',
  switch: 'toggle-left',
  pm25: 'wind'
};

const SENSOR_ORDER = ['temperature', 'motion', 'lightlevel', 'switch', 'pm25'];
const STATIC_SPARKLINE_COLORS = new Map([
  ['temperature', '#ff6b35'],
  ['lightlevel', '#ffd700'],
  ['switch', '#b388ff'],
  ['pm25', '#00d4ff']
]);
const DEFAULT_SPARKLINE_COLOR = '#ff8c00';
const EMPTY_READING = { value: '--', unit: '', minMax: null };
const SPARKLINE_SIZE = 100;
const MS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;
const MS_PER_DAY = HOURS_PER_DAY * MINUTES_PER_HOUR * SECONDS_PER_MINUTE * MS_PER_SECOND;

export function renderSensors() {
  const allSensors = sensors.value || [];

  useEffect(refreshIcons, [allSensors]);

  const orderedSensors = orderSensors(allSensors);

  if (orderedSensors.length === 0) {
    return html`
      <div class="sensors-row" id="sensors-content">
        <div class="loading">No sensors found</div>
      </div>
    `;
  }

  return html`
    <div class="sensors-row" id="sensors-content">
      ${orderedSensors.map(sensor => html`
        <${sensorPanel} key=${sensorKey(sensor)} sensor=${sensor} />
      `)}
    </div>
  `;
}

export { renderSensors as Sensors };

function refreshIcons() {
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
}

function orderSensors(allSensors) {
  return SENSOR_ORDER.flatMap(category => allSensors.filter(sensor => sensor.category === category));
}

function sensorPanel({ sensor }) {
  const panelKey = `sensor:${sensorKey(sensor)}`;
  const reading = readSensor(sensor);

  return html`
    <section class=${`sensor-panel sensor-${sensor.category} ${activeClassFor(sensor)}`} data-panel-key=${panelKey} data-default-name=${sensor.name}>
      <div class="sensor-header">
        <i data-lucide=${CATEGORY_ICONS[sensor.category] || 'radio'}></i>
        <span class="panel-title">${getPanelName(panelKey, sensor.name)}</span>
      </div>
      <div class="sensor-content">
        <div class="sensor-main">
          <span class="sensor-value">${reading.value}<span class="sensor-unit">${reading.unit}</span></span>
          ${reading.minMax}
        </div>
        ${renderBottom(sensor)}
      </div>
    </section>
  `;
}

function sensorKey(sensor) {
  return sensor.storageId || sensor.id;
}

function activeClassFor(sensor) {
  return (sensor.category === 'motion' && sensor.state.presence) ? 'active' : '';
}

function readSensor(sensor) {
  const readReading = SENSOR_READERS.get(sensor.category);

  return readReading ? readReading(sensor) : EMPTY_READING;
}

function readTemperature(sensor) {
  const { temperature } = sensor.state;

  if (temperature === undefined) {
    return EMPTY_READING;
  }

  return {
    value: temperature.toFixed(1),
    unit: '°C',
    minMax: minMaxLabel(sensor.dailyStats, reading => reading.toFixed(1))
  };
}

function readMotion(sensor) {
  return { value: sensor.state.presence ? 'DETECTED' : 'CLEAR', unit: '', minMax: null };
}

function readLightLevel(sensor) {
  const { lightlevel } = sensor.state;

  if (lightlevel === undefined) {
    return EMPTY_READING;
  }

  return { value: lightlevel, unit: ' lux', minMax: null };
}

function readSwitch() {
  return { value: 'READY', unit: '', minMax: null };
}

function readPm25(sensor) {
  const { pm25 } = sensor.state;

  if (pm25 === undefined) {
    return EMPTY_READING;
  }

  return {
    value: pm25,
    unit: ' µg/m³',
    minMax: minMaxLabel(sensor.dailyStats, reading => reading)
  };
}

const SENSOR_READERS = new Map([
  ['temperature', readTemperature],
  ['motion', readMotion],
  ['lightlevel', readLightLevel],
  ['switch', readSwitch],
  ['pm25', readPm25]
]);

function minMaxLabel(dailyStats, format) {
  if (!dailyStats) {
    return null;
  }

  const { min, max } = dailyStats;

  return html`<span class="sensor-minmax">${format(min)} / ${format(max)}</span>`;
}

function renderBottom(sensor) {
  if (sensor.category === 'motion') {
    return renderMotionDetections(sensor);
  }

  return html`<${sparkline} history=${sensor.history} color=${sparklineColor(sensor)} />`;
}

function sparklineColor(sensor) {
  if (sensor.category === 'motion') {
    return sensor.state.presence ? '#00ff88' : '#00d4ff';
  }

  return STATIC_SPARKLINE_COLORS.get(sensor.category) || DEFAULT_SPARKLINE_COLOR;
}

function renderMotionDetections(sensor) {
  const detections = getLastMotionDetections(sensor.history);

  if (detections.length > 0) {
    return html`
      <div class="motion-detections">
        ${detections.map(detection => html`<span>${detection}</span>`)}
      </div>
    `;
  }

  const message = sensor.state.lastupdated ? formatTimeAgo(sensor.state.lastupdated) : 'No recent activity';

  return html`
    <div class="motion-detections">
      <span>${message}</span>
    </div>
  `;
}

function getLastMotionDetections(history) {
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

function formatTimeAgo(isoString) {
  if (!isoString || isoString === 'none') {
    return '';
  }

  const diffSec = Math.floor((Date.now() - new Date(isoString).getTime()) / MS_PER_SECOND);

  if (diffSec < SECONDS_PER_MINUTE) {
    return 'just now';
  }

  const diffMin = Math.floor(diffSec / SECONDS_PER_MINUTE);

  if (diffMin < MINUTES_PER_HOUR) {
    return formatAgo(diffMin, 'min', 'min');
  }

  const diffHour = Math.floor(diffMin / MINUTES_PER_HOUR);

  if (diffHour < HOURS_PER_DAY) {
    return formatAgo(diffHour, 'hour', 'hours');
  }

  return formatAgo(Math.floor(diffHour / HOURS_PER_DAY), 'day', 'days');
}

function formatAgo(count, singularUnit, pluralUnit) {
  return `${count} ${count === 1 ? singularUnit : pluralUnit} ago`;
}

function sparkline({ history, color }) {
  const values = getLast24hValues(history);

  if (values.length < 2) {
    return html`
      <div class="sparkline">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none">
          <line x1="0" y1="50" x2="100" y2="50" stroke="#666" stroke-width="2" stroke-dasharray="4,4" vector-effect="non-scaling-stroke" opacity="0.5"/>
        </svg>
      </div>
    `;
  }

  return html`
    <div class="sparkline">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none">
        <polyline points=${sparklinePoints(values)} fill="none" stroke=${color} stroke-width="2" vector-effect="non-scaling-stroke"/>
      </svg>
    </div>
  `;
}

function sparklinePoints(values) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  return values.map((sample, i) => {
    const xPosition = (i / (values.length - 1)) * SPARKLINE_SIZE;
    const yPosition = SPARKLINE_SIZE - ((sample - min) / range) * SPARKLINE_SIZE;

    return `${xPosition},${yPosition}`;
  }).join(' ');
}

function getLast24hValues(history) {
  if (!history || history.length === 0) {
    return [];
  }

  if (typeof history[0] === 'number') {
    return history;
  }

  const cutoff = Date.now() - MS_PER_DAY;

  return history.filter(entry => entry.t >= cutoff).map(entry => entry.v);
}

// Legacy exports for backwards compatibility
export async function loadSensors() {
  try {
    const rooms = await API.hue.rooms();
    const sensorsRoom = rooms.find(room => room.id === 'sensors');

    if (sensorsRoom) {
      sensors.value = sensorsRoom.lights || [];
    }
  } catch (err) {
    addLog(`Failed to load sensors: ${err.message}`, 'error');
  }
}

export function updateSensors(sensorList) {
  sensors.value = sensorList;
}

export function updatePm25Sensors(pm25Data) {
  const current = sensors.value || [];
  const nonPm25 = current.filter(sensor => sensor.category !== 'pm25');
  sensors.value = [...nonPm25, ...pm25Data];
}
