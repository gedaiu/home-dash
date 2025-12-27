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

function getLast24hValues(history) {
  if (!history || history.length === 0) {
    return [];
  }

  if (typeof history[0] === 'number') {
    return history;
  }

  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  return history.filter(e => e.t >= cutoff).map(e => e.v);
}

function formatTimeAgo(isoString) {
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

function Sparkline({ history, color }) {
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

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const points = values.map((val, i) => {
    const x = (i / (values.length - 1)) * 100;
    const y = 100 - ((val - min) / range) * 100;
    return `${x},${y}`;
  }).join(' ');

  return html`
    <div class="sparkline">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none">
        <polyline points=${points} fill="none" stroke=${color} stroke-width="2" vector-effect="non-scaling-stroke"/>
      </svg>
    </div>
  `;
}

function SensorPanel({ sensor }) {
  const icon = CATEGORY_ICONS[sensor.category] || 'radio';
  const typeClass = `sensor-${sensor.category}`;
  const panelKey = `sensor:${sensor.storageId || sensor.id}`;
  const displayName = getPanelName(panelKey, sensor.name);

  let value = '--';
  let unit = '';
  let minMax = null;

  if (sensor.category === 'temperature' && sensor.state.temperature !== undefined) {
    value = sensor.state.temperature.toFixed(1);
    unit = '\u00B0C';
    if (sensor.dailyStats) {
      minMax = html`<span class="sensor-minmax">${sensor.dailyStats.min.toFixed(1)} / ${sensor.dailyStats.max.toFixed(1)}</span>`;
    }
  } else if (sensor.category === 'motion') {
    value = sensor.state.presence ? 'DETECTED' : 'CLEAR';
  } else if (sensor.category === 'lightlevel' && sensor.state.lightlevel !== undefined) {
    value = sensor.state.lightlevel;
    unit = ' lux';
  } else if (sensor.category === 'switch') {
    value = 'READY';
  } else if (sensor.category === 'pm25' && sensor.state.pm25 !== undefined) {
    value = sensor.state.pm25;
    unit = ' \u00B5g/m\u00B3';
    if (sensor.dailyStats) {
      minMax = html`<span class="sensor-minmax">${sensor.dailyStats.min} / ${sensor.dailyStats.max}</span>`;
    }
  }

  const activeClass = (sensor.category === 'motion' && sensor.state.presence) ? 'active' : '';

  const colorMap = {
    temperature: '#ff6b35',
    motion: sensor.state.presence ? '#00ff88' : '#00d4ff',
    lightlevel: '#ffd700',
    switch: '#b388ff',
    pm25: '#00d4ff'
  };
  const sparklineColor = colorMap[sensor.category] || '#ff8c00';

  let bottomContent;
  if (sensor.category === 'motion') {
    const detections = getLastMotionDetections(sensor.history);
    if (detections.length > 0) {
      bottomContent = html`
        <div class="motion-detections">
          ${detections.map(d => html`<span>${d}</span>`)}
        </div>
      `;
    } else if (sensor.state.lastupdated) {
      bottomContent = html`
        <div class="motion-detections">
          <span>${formatTimeAgo(sensor.state.lastupdated)}</span>
        </div>
      `;
    } else {
      bottomContent = html`
        <div class="motion-detections">
          <span>No recent activity</span>
        </div>
      `;
    }
  } else {
    bottomContent = html`<${Sparkline} history=${sensor.history} color=${sparklineColor} />`;
  }

  return html`
    <section class=${`sensor-panel ${typeClass} ${activeClass}`} data-panel-key=${panelKey} data-default-name=${sensor.name}>
      <div class="sensor-header">
        <i data-lucide=${icon}></i>
        <span class="panel-title">${displayName}</span>
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

export function Sensors() {
  const allSensors = sensors.value || [];

  useEffect(() => {
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
  }, [allSensors]);

  const tempSensors = allSensors.filter(s => s.category === 'temperature');
  const motionSensors = allSensors.filter(s => s.category === 'motion');
  const lightSensors = allSensors.filter(s => s.category === 'lightlevel');
  const switches = allSensors.filter(s => s.category === 'switch');
  const pm25Sensors = allSensors.filter(s => s.category === 'pm25');

  const orderedSensors = [
    ...tempSensors,
    ...motionSensors,
    ...lightSensors,
    ...switches,
    ...pm25Sensors
  ];

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
        <${SensorPanel} key=${sensor.storageId || sensor.id} sensor=${sensor} />
      `)}
    </div>
  `;
}

// Legacy exports for backwards compatibility
export async function loadSensors() {
  try {
    const rooms = await API.hue.rooms();
    const sensorsRoom = rooms.find(r => r.id === 'sensors');
    if (sensorsRoom) {
      sensors.value = sensorsRoom.lights || [];
    }
  } catch (err) {
    addLog(`Failed to load sensors: ${err.message}`, 'error');
  }
}

export function updateSensors(data) {
  sensors.value = data;
}

export function updatePm25Sensors(pm25Data) {
  const current = sensors.value || [];
  const nonPm25 = current.filter(s => s.category !== 'pm25');
  sensors.value = [...nonPm25, ...pm25Data];
}
