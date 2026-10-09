import { $, CATEGORY_ICONS } from './utils.js';
import { renderSparkline, getLastMotionDetections, formatTimeAgo } from './utils.js';
import { getPanelDisplayName, attachEditableTitles } from './panels.js';

const BUTTON_CODE_DIVISOR = 1000;
const DECIMAL_RADIX = 10;
const PANEL_ORDER = ['temperature', 'motion', 'lightlevel', 'switch'];
const EMPTY_READOUT = { value: '--', unit: '', minMax: '' };
const DEFAULT_SPARKLINE_COLOR = '#ff8c00';
const SPARKLINE_COLORS = {
  temperature: '#ff6b35',
  lightlevel: '#ffd700',
  switch: '#b388ff',
  pm25: '#00d4ff'
};
const BUTTON_NAMES = { '1': 'ON', '2': 'UP', '3': 'DOWN', '4': 'OFF' };

let pm25Sensors = [];

const SENSOR_READOUTS = new Map([
  ['temperature', temperatureReadout],
  ['motion', motionReadout],
  ['lightlevel', lightLevelReadout],
  ['switch', switchReadout],
  ['pm25', pm25Readout]
]);

const SENSOR_BOTTOMS = new Map([
  ['motion', motionBottom],
  ['switch', switchBottom]
]);

export function updatePm25Sensors(sensors) {
  pm25Sensors = sensors || [];
  const sensorsContent = $('#sensors-content');

  if (!sensorsContent) {
    return;
  }

  const container = document.createElement('div');
  container.innerHTML = sensorsContent.innerHTML;
  container.querySelectorAll('.sensor-pm25').forEach(element => element.remove());

  sensorsContent.innerHTML = container.innerHTML + pm25Sensors.map(sensor => renderSensorPanel(sensor)).join('');
  lucide.createIcons();
  attachEditableTitles();
}

export function renderSensorPanels(sensors) {
  const ordered = PANEL_ORDER.flatMap(category => sensors.filter(sensor => sensor.category === category));

  return [...ordered, ...pm25Sensors].map(sensor => renderSensorPanel(sensor)).join('');
}

function renderSensorPanel(sensor) {
  const panelKey = `sensor:${sensor.storageId || sensor.id}`;
  const { value, unit, minMax } = sensorReadout(sensor);
  const bottomRenderer = SENSOR_BOTTOMS.get(sensor.category);
  const bottomContent = bottomRenderer ? bottomRenderer(sensor) : renderSparkline(sensor.history, sparklineColor(sensor));
  const isActive = sensor.category === 'motion' && sensor.state.presence;

  return `
    <section class="sensor-panel sensor-${sensor.category} ${isActive ? 'active' : ''}" data-panel-key="${panelKey}" data-default-name="${sensor.name}">
      <div class="sensor-header">
        <i data-lucide="${CATEGORY_ICONS[sensor.category] || 'radio'}"></i>
        <span class="panel-title">${getPanelDisplayName(panelKey, sensor.name)}</span>
      </div>
      <div class="sensor-content">
        <div class="sensor-main">
          <span class="sensor-value">${value}<span class="sensor-unit">${unit}</span></span>
          ${minMax}
        </div>
        ${bottomContent}
      </div>
    </section>
  `;
}

function sensorReadout(sensor) {
  const readout = SENSOR_READOUTS.get(sensor.category);

  return readout ? readout(sensor) : EMPTY_READOUT;
}

function temperatureReadout(sensor) {
  const { temperature } = sensor.state;

  if (temperature === undefined) {
    return EMPTY_READOUT;
  }

  return { value: temperature.toFixed(1), unit: '°C', minMax: minMaxHtml(sensor.dailyStats, stat => stat.toFixed(1)) };
}

function motionReadout(sensor) {
  return { ...EMPTY_READOUT, value: sensor.state.presence ? 'DETECTED' : 'CLEAR' };
}

function lightLevelReadout(sensor) {
  const { lightlevel } = sensor.state;

  return lightlevel === undefined ? EMPTY_READOUT : { ...EMPTY_READOUT, value: lightlevel, unit: ' lux' };
}

function switchReadout(sensor) {
  return { ...EMPTY_READOUT, value: formatButtonEvent(sensor.state.buttonevent, sensor.state.lastupdated).value };
}

function pm25Readout(sensor) {
  const { pm25 } = sensor.state;

  if (pm25 === undefined) {
    return EMPTY_READOUT;
  }

  return { value: pm25, unit: ' µg/m³', minMax: minMaxHtml(sensor.dailyStats, stat => stat) };
}

function minMaxHtml(dailyStats, format) {
  if (!dailyStats) {
    return '';
  }

  return `<span class="sensor-minmax">${format(dailyStats.min)} / ${format(dailyStats.max)}</span>`;
}

function sparklineColor(sensor) {
  if (sensor.category === 'motion') {
    return sensor.state.presence ? '#00ff88' : '#00d4ff';
  }

  return SPARKLINE_COLORS[sensor.category] || DEFAULT_SPARKLINE_COLOR;
}

function motionBottom(sensor) {
  const detections = getLastMotionDetections(sensor.history);

  if (detections.length > 0) {
    return `<div class="motion-detections">${detections.map(detection => `<span>${detection}</span>`).join('')}</div>`;
  }

  const text = sensor.state.lastupdated ? formatTimeAgo(sensor.state.lastupdated) : 'No recent activity';

  return `<div class="motion-detections"><span>${text}</span></div>`;
}

function switchBottom(sensor) {
  const { timeAgo } = formatButtonEvent(sensor.state.buttonevent, sensor.state.lastupdated);
  const text = timeAgo || 'No presses recorded';

  return `<div class="switch-lastpress"><span>${text}</span></div>`;
}

function formatButtonEvent(buttonevent, lastupdated) {
  if (buttonevent === undefined || buttonevent === null) {
    return { value: 'READY', timeAgo: '' };
  }

  return {
    value: buttonName(parseInt(buttonevent, DECIMAL_RADIX)),
    timeAgo: lastupdated ? formatTimeAgo(lastupdated) : ''
  };
}

function buttonName(code) {
  const button = Math.floor(code / BUTTON_CODE_DIVISOR);

  return BUTTON_NAMES[button] || `BTN${button}`;
}
