import { html } from 'https://esm.sh/htm@3.1.1/preact';
import { useState, useEffect } from 'https://esm.sh/preact@10.19.3/hooks';
import { effect } from 'https://esm.sh/@preact/signals@1.2.1';
import { roomsState, getPanelDisplayName } from '../state.js';

const CATEGORY_ICONS = {
  motion: 'scan-eye',
  temperature: 'thermometer',
  lightlevel: 'sun-dim',
  switch: 'toggle-left',
  pm25: 'wind'
};

function formatTimeAgo(isoString) {
  if (!isoString || isoString === 'none') return '';
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now - date;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMin / 60);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin} min ago`;
  if (diffHour < 24) return `${diffHour} hours ago`;
  return `${Math.floor(diffHour / 24)} days ago`;
}

function getLastMotionDetections(history) {
  if (!history || history.length === 0) return [];
  const detections = [];
  for (let i = history.length - 1; i >= 0 && detections.length < 10; i--) {
    if (history[i].v === 1) {
      const time = new Date(history[i].t);
      detections.push(`${time.getHours().toString().padStart(2, '0')}:${time.getMinutes().toString().padStart(2, '0')}`);
    }
  }
  return detections;
}

function getLast24hValues(history) {
  if (!history || history.length === 0) return [];
  if (typeof history[0] === 'number') return history;
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  return history.filter(e => e.t >= cutoff).map(e => e.v);
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
  const displayName = getPanelDisplayName(panelKey, sensor.name);

  let value = '--';
  let unit = '';
  let minMax = null;

  if (sensor.category === 'temperature' && sensor.state?.temperature !== undefined) {
    value = sensor.state.temperature.toFixed(1);
    unit = '°C';
    if (sensor.dailyStats) {
      minMax = html`<span class="sensor-minmax">${sensor.dailyStats.min.toFixed(1)} / ${sensor.dailyStats.max.toFixed(1)}</span>`;
    }
  } else if (sensor.category === 'motion') {
    value = sensor.state?.presence ? 'DETECTED' : 'CLEAR';
  } else if (sensor.category === 'lightlevel' && sensor.state?.lightlevel !== undefined) {
    value = sensor.state.lightlevel;
    unit = ' lux';
  } else if (sensor.category === 'switch') {
    value = 'READY';
  } else if (sensor.category === 'pm25' && sensor.state?.pm25 !== undefined) {
    value = sensor.state.pm25;
    unit = ' µg/m³';
    if (sensor.dailyStats) {
      minMax = html`<span class="sensor-minmax">${sensor.dailyStats.min} / ${sensor.dailyStats.max}</span>`;
    }
  }

  const activeClass = (sensor.category === 'motion' && sensor.state?.presence) ? 'active' : '';

  const colorMap = {
    temperature: '#ff6b35',
    motion: sensor.state?.presence ? '#00ff88' : '#00d4ff',
    lightlevel: '#ffd700',
    switch: '#b388ff',
    pm25: '#00d4ff'
  };
  const sparklineColor = colorMap[sensor.category] || '#ff8c00';

  let bottomContent = html`<${Sparkline} history=${sensor.history} color=${sparklineColor} />`;

  if (sensor.category === 'motion') {
    const detections = getLastMotionDetections(sensor.history);
    if (detections.length > 0) {
      bottomContent = html`
        <div class="motion-detections">${detections.map(d => html`<span key=${d}>${d}</span>`)}</div>
      `;
    } else if (sensor.state?.lastupdated) {
      bottomContent = html`<div class="motion-detections"><span>${formatTimeAgo(sensor.state.lastupdated)}</span></div>`;
    } else {
      bottomContent = html`<div class="motion-detections"><span>No recent activity</span></div>`;
    }
  } else if (sensor.category === 'switch') {
    const timeAgo = sensor.state?.lastupdated ? formatTimeAgo(sensor.state.lastupdated) : '';
    bottomContent = html`<div class="switch-lastpress"><span>${timeAgo || 'No presses recorded'}</span></div>`;
  }

  return html`
    <section class="sensor-panel ${typeClass} ${activeClass}" data-panel-key=${panelKey} data-default-name=${sensor.name}>
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
  const [sensors, setSensors] = useState([]);

  useEffect(() => {
    const dispose = effect(() => {
      const rooms = roomsState.value || [];
      const sensorsRoom = rooms.find(r => r.id === 'sensors');
      if (sensorsRoom) {
        const allSensors = sensorsRoom.lights || [];
        const temp = allSensors.filter(s => s.category === 'temperature');
        const motion = allSensors.filter(s => s.category === 'motion');
        const light = allSensors.filter(s => s.category === 'lightlevel');
        const switches = allSensors.filter(s => s.category === 'switch');
        const pm25 = allSensors.filter(s => s.category === 'pm25');
        setSensors([...temp, ...motion, ...light, ...switches, ...pm25]);
      }
    });
    return dispose;
  }, []);

  useEffect(() => {
    if (window.lucide) {
      window.lucide.createIcons();
    }
  }, [sensors]);

  if (sensors.length === 0) {
    return html`<div class="loading">No sensors found</div>`;
  }

  return html`
    ${sensors.map(sensor => html`<${SensorPanel} key=${sensor.id} sensor=${sensor} />`)}
  `;
}
