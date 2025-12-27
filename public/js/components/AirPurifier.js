import { html } from 'https://esm.sh/htm@3.1.1/preact';
import { useState, useEffect } from 'https://esm.sh/preact@10.19.3/hooks';
import { effect } from 'https://esm.sh/@preact/signals@1.2.1';
import { airPurifierState, addLog, getPanelDisplayName } from '../state.js';
import { Panel, StatusBadge } from './Panel.js';
import { API } from '../api.js';

function getAirQualityLabel(iaql) {
  if (iaql <= 3) return 'GOOD';
  if (iaql <= 6) return 'MODERATE';
  if (iaql <= 9) return 'POOR';
  return 'VERY POOR';
}

function getAirQualityClass(iaql) {
  if (iaql <= 3) return 'good';
  if (iaql <= 6) return 'moderate';
  if (iaql <= 9) return 'poor';
  return 'very-poor';
}

function getModeLabel(mode) {
  const modes = { 'M': 'MANUAL', 'P': 'AUTO', 'AG': 'ALLERGEN', 'GT': 'GENTLE', 'T': 'TURBO', 'S': 'SLEEP' };
  return modes[mode] || mode;
}

function FilterBar({ current, total, label }) {
  const percent = total > 0 ? Math.round((current / total) * 100) : 0;
  const statusClass = percent > 30 ? 'good' : percent > 10 ? 'warning' : 'critical';

  return html`
    <div class="info-row">
      <span class="label">${label}:</span>
      <span class="value filter-value">
        <div class="filter-bar">
          <div class="filter-fill ${statusClass}" style="width: ${percent}%"></div>
        </div>
        <span class="filter-percent">${percent}%</span>
      </span>
    </div>
  `;
}

function AirPurifierDevice({ device, index }) {
  const defaultName = device.device?.name || `Purifier ${index + 1}`;
  const panelKey = `airpurifier:${index}`;

  const togglePower = async () => {
    try {
      const isOn = device.pwr === '1';
      await API.airpurifier.power(index, !isOn);
      addLog(`Purifier ${index + 1} turned ${isOn ? 'off' : 'on'}`, 'success');
    } catch (err) {
      addLog(`Failed to toggle purifier: ${err.message}`, 'error');
    }
  };

  const setMode = async (e) => {
    try {
      const mode = e.target.value;
      await API.airpurifier.mode(index, mode);
      addLog(`Purifier ${index + 1} mode set to ${getModeLabel(mode)}`, 'success');
    } catch (err) {
      addLog(`Failed to set mode: ${err.message}`, 'error');
    }
  };

  const setFan = async (e) => {
    try {
      const speed = e.target.value;
      await API.airpurifier.fan(index, speed);
      addLog(`Purifier ${index + 1} fan set to ${speed}`, 'success');
    } catch (err) {
      addLog(`Failed to set fan speed: ${err.message}`, 'error');
    }
  };

  if (!device.connected) {
    return html`
      <${Panel} panelKey=${panelKey} defaultName=${defaultName} icon="wind">
        <div class="device-info">
          <div class="info-row">
            <span class="label">STATUS:</span>
            <${StatusBadge} status="OFFLINE" className="offline" />
          </div>
          <p class="purifier-ip">${device.device?.ip || 'Unknown'}</p>
        </div>
      <//>
    `;
  }

  const hasStatus = device.pwr !== undefined;
  if (!hasStatus) {
    return html`
      <${Panel} panelKey=${panelKey} defaultName=${defaultName} icon="wind">
        <div class="loading">Connecting...</div>
      <//>
    `;
  }

  const isOn = device.pwr === '1';
  const iaql = device.iaql !== undefined ? device.iaql : null;
  const mode = device.mode || 'P';
  const om = device.om || '1';
  const qualityClass = iaql !== null ? getAirQualityClass(iaql) : '';

  const defaultModes = [
    { value: 'P', label: 'AUTO' },
    { value: 'S', label: 'SLEEP' },
    { value: 'T', label: 'TURBO' }
  ];

  const capabilities = device.capabilities || {};
  const availableModes = capabilities.modes || defaultModes;
  const availableSpeeds = capabilities.speeds || ['s', '1', '2', 't'];
  const hasManualMode = capabilities.hasManualMode !== false && availableModes.some(m => m.value === 'M');

  const speedLabels = { 's': 'SLEEP', '1': '1', '2': '2', '3': '3', 't': 'TURBO' };

  const controls = html`
    <button class="btn-icon ${isOn ? 'btn-stop' : 'btn-start'}" onClick=${togglePower} title=${isOn ? 'Stop' : 'Start'}>
      <i data-lucide=${isOn ? 'square' : 'play'}></i>
    </button>
  `;

  return html`
    <${Panel} panelKey=${panelKey} defaultName=${defaultName} icon="wind" controls=${controls}>
      <div class="device-info">
        <div class="info-row">
          <span class="label">AIR QUALITY:</span>
          <${StatusBadge} status=${iaql !== null ? getAirQualityLabel(iaql) : '--'} className=${qualityClass} />
        </div>
        <div class="info-row">
          <span class="label">MODE:</span>
          <select class="control-select" onChange=${setMode} disabled=${!isOn}>
            ${availableModes.map(m => html`
              <option value=${m.value} selected=${mode === m.value}>${m.label}</option>
            `)}
          </select>
        </div>
        ${hasManualMode ? html`
          <div class="info-row">
            <span class="label">FAN:</span>
            <select class="control-select" onChange=${setFan} disabled=${!isOn || mode !== 'M'}>
              ${availableSpeeds.map(s => html`
                <option value=${s} selected=${om === s}>${speedLabels[s] || s}</option>
              `)}
            </select>
          </div>
        ` : null}
        ${device.flttotal0 > 0 ? html`<${FilterBar} current=${device.fltsts0 || 0} total=${device.flttotal0} label="PRE-FILTER" />` : null}
        ${device.flttotal1 > 0 ? html`<${FilterBar} current=${device.fltsts1 || 0} total=${device.flttotal1} label="HEPA" />` : null}
        ${device.flttotal2 > 0 && device.fltsts2 > 0 ? html`<${FilterBar} current=${device.fltsts2} total=${device.flttotal2} label="CARBON" />` : null}
      </div>
    <//>
  `;
}

export function AirPurifiers() {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    API.airpurifier.devices().then(data => {
      airPurifierState.value = data || [];
      setLoading(false);
    }).catch(err => {
      console.error('Failed to load air purifiers:', err);
      setLoading(false);
    });

    const dispose = effect(() => {
      setDevices(airPurifierState.value || []);
    });
    return dispose;
  }, []);

  if (loading) {
    return null;
  }

  if (!devices || devices.length === 0) {
    return null;
  }

  return html`
    ${devices.map((device, index) => html`
      <${AirPurifierDevice} key=${index} device=${device} index=${index} />
    `)}
  `;
}
