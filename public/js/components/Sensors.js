import { html } from 'https://esm.sh/htm@3.1.1/preact';
import { useState, useEffect, useRef } from 'https://esm.sh/preact@10.19.3/hooks';
import { effect } from 'https://esm.sh/@preact/signals@1.2.1';
import { roomsState, getPanelDisplayName, setPanelDisplayName, deletePanelDisplayName } from '../state.js';

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
const MAX_MOTION_DETECTIONS = 10;
const SPARKLINE_SIZE = 100;
const MS_PER_MINUTE = 60000;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;
const MS_PER_DAY = HOURS_PER_DAY * MINUTES_PER_HOUR * MS_PER_MINUTE;

export function renderSensors() {
  const [sensors, setSensors] = useState([]);

  useEffect(() => subscribeSensors(setSensors), []);

  useEffect(refreshIcons, [sensors]);

  if (sensors.length === 0) {
    return html`<div class="loading">No sensors found</div>`;
  }

  return html`
    ${sensors.map(sensor => html`<${sensorPanel} key=${sensor.id} sensor=${sensor} />`)}
  `;
}

export { renderSensors as Sensors };

function subscribeSensors(setSensors) {
  return effect(() => {
    const rooms = roomsState.value || [];
    const sensorsRoom = rooms.find(room => room.id === 'sensors');

    if (!sensorsRoom) {
      return;
    }

    setSensors(orderSensors(sensorsRoom.lights || []));
  });
}

function orderSensors(allSensors) {
  return SENSOR_ORDER.flatMap(category => allSensors.filter(sensor => sensor.category === category));
}

function refreshIcons() {
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

function sensorPanel({ sensor }) {
  const panelKey = `sensor:${sensor.storageId || sensor.id}`;
  const displayName = getPanelDisplayName(panelKey, sensor.name);
  const titleContent = useEditableTitle({ sensor, panelKey, displayName });
  const reading = readSensor(sensor);

  return html`
    <section class="sensor-panel ${`sensor-${sensor.category}`} ${activeClassFor(sensor)}" data-panel-key=${panelKey} data-default-name=${sensor.name}>
      <div class="sensor-header">
        <i data-lucide=${CATEGORY_ICONS[sensor.category] || 'radio'}></i>
        ${titleContent}
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

function activeClassFor(sensor) {
  return (sensor.category === 'motion' && sensor.state?.presence) ? 'active' : '';
}

function useEditableTitle({ sensor, panelKey, displayName }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(displayName);
  const inputRef = useRef(null);

  useEffect(() => {
    focusInput(inputRef, isEditing);
  }, [isEditing]);

  const stopEditing = () => setIsEditing(false);

  const save = () => {
    saveTitle({ sensor, panelKey, editValue });
    stopEditing();
  };

  const startEditing = (event) => {
    event.stopPropagation();
    setEditValue(displayName);
    setIsEditing(true);
  };

  if (!isEditing) {
    return html`<span class="panel-title editable" onDblClick=${startEditing} title="Double-click to rename">${displayName}</span>`;
  }

  const onKeyDown = (event) => handleTitleKey({ event, save, cancel: stopEditing });

  return renderTitleInput({ inputRef, editValue, setEditValue, onKeyDown, onBlur: stopEditing });
}

function focusInput(inputRef, isEditing) {
  if (isEditing && inputRef.current) {
    inputRef.current.focus();
    inputRef.current.select();
  }
}

function saveTitle({ sensor, panelKey, editValue }) {
  const newName = editValue.trim();

  if (newName && newName !== sensor.name) {
    setPanelDisplayName(panelKey, newName);

    return;
  }

  deletePanelDisplayName(panelKey);
}

function handleTitleKey({ event, save, cancel }) {
  if (event.key === 'Enter') {
    event.preventDefault();
    save();

    return;
  }

  if (event.key === 'Escape') {
    cancel();
  }
}

function renderTitleInput({ inputRef, editValue, setEditValue, onKeyDown, onBlur }) {
  return html`<input
        ref=${inputRef}
        type="text"
        class="panel-title-input"
        value=${editValue}
        onInput=${(event) => setEditValue(event.target.value)}
        onKeyDown=${onKeyDown}
        onBlur=${onBlur}
      />`;
}

function readSensor(sensor) {
  const readReading = SENSOR_READERS.get(sensor.category);

  return readReading ? readReading(sensor) : EMPTY_READING;
}

function readTemperature(sensor) {
  const temperature = sensor.state?.temperature;

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
  return { value: sensor.state?.presence ? 'DETECTED' : 'CLEAR', unit: '', minMax: null };
}

function readLightLevel(sensor) {
  const lightlevel = sensor.state?.lightlevel;

  if (lightlevel === undefined) {
    return EMPTY_READING;
  }

  return { value: lightlevel, unit: ' lux', minMax: null };
}

function readSwitch() {
  return { value: 'READY', unit: '', minMax: null };
}

function readPm25(sensor) {
  const pm25 = sensor.state?.pm25;

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

  if (sensor.category === 'switch') {
    return renderSwitchLastPress(sensor);
  }

  return html`<${sparkline} history=${sensor.history} color=${sparklineColor(sensor)} />`;
}

function sparklineColor(sensor) {
  return STATIC_SPARKLINE_COLORS.get(sensor.category) || DEFAULT_SPARKLINE_COLOR;
}

function renderSwitchLastPress(sensor) {
  const lastUpdated = sensor.state?.lastupdated;
  const timeAgo = lastUpdated ? formatTimeAgo(lastUpdated) : '';

  return html`<div class="switch-lastpress"><span>${timeAgo || 'No presses recorded'}</span></div>`;
}

function renderMotionDetections(sensor) {
  const detections = getLastMotionDetections(sensor.history);

  if (detections.length > 0) {
    return html`
      <div class="motion-detections">${detections.map(detection => html`<span key=${detection}>${detection}</span>`)}</div>
    `;
  }

  const lastUpdated = sensor.state?.lastupdated;
  const message = lastUpdated ? formatTimeAgo(lastUpdated) : 'No recent activity';

  return html`<div class="motion-detections"><span>${message}</span></div>`;
}

function getLastMotionDetections(history) {
  if (!history || history.length === 0) {
    return [];
  }

  const detections = [];

  for (let i = history.length - 1; i >= 0 && detections.length < MAX_MOTION_DETECTIONS; i--) {
    if (history[i].v === 1) {
      detections.push(formatClock(history[i].t));
    }
  }

  return detections;
}

function formatClock(timestamp) {
  const time = new Date(timestamp);
  const hours = time.getHours().toString().padStart(2, '0');
  const mins = time.getMinutes().toString().padStart(2, '0');

  return `${hours}:${mins}`;
}

function formatTimeAgo(isoString) {
  if (!isoString || isoString === 'none') {
    return '';
  }

  const diffMin = Math.floor((Date.now() - new Date(isoString).getTime()) / MS_PER_MINUTE);

  if (diffMin < 1) {
    return 'just now';
  }

  if (diffMin < MINUTES_PER_HOUR) {
    return `${diffMin} min ago`;
  }

  const diffHour = Math.floor(diffMin / MINUTES_PER_HOUR);

  if (diffHour < HOURS_PER_DAY) {
    return `${diffHour} hours ago`;
  }

  return `${Math.floor(diffHour / HOURS_PER_DAY)} days ago`;
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
