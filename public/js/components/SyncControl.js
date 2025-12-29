import { html } from 'https://esm.sh/htm@3.1.1/preact';
import { useState, useEffect } from 'https://esm.sh/preact@10.19.3/hooks';
import { effect } from 'https://esm.sh/@preact/signals@1.2.1';
import { syncState, roomsState, addLog } from '../state.js';
import { Panel, StatusBadge } from './Panel.js';
import { API } from '../api.js';

const SYNCABLE_CATEGORIES = ['bulb', 'lamp', 'spot', 'ceiling', 'strip', 'candle'];

export function SyncControl() {
  const [status, setStatus] = useState({ running: false });
  const [config, setConfig] = useState(null);
  const [selectedLight, setSelectedLight] = useState('');
  const [minBri, setMinBri] = useState(5);
  const [maxBri, setMaxBri] = useState(100);
  const [rooms, setRooms] = useState([]);

  useEffect(() => {
    Promise.all([
      API.sync.config(),
      API.sync.status(),
      API.nanoleaf.config()
    ]).then(([syncCfg, syncStatus, nanoleafCfg]) => {
      setConfig(syncCfg);
      setStatus(syncStatus);
      if (syncCfg.hueDeviceId) {
        setSelectedLight(syncCfg.hueDeviceId);
      }
      if (nanoleafCfg.configured) {
        setMinBri(nanoleafCfg.minBrightness || 5);
        setMaxBri(nanoleafCfg.maxBrightness || 100);
      }
    }).catch(err => {
      console.error('Failed to load sync config:', err);
    });

    const disposeSync = effect(() => {
      if (syncState.value) {
        setStatus(syncState.value);
      }
    });

    const disposeRooms = effect(() => {
      const allRooms = roomsState.value || [];
      setRooms(allRooms.filter(r => r.id !== 'sensors'));
    });

    return () => {
      disposeSync();
      disposeRooms();
    };
  }, []);

  // Re-create Lucide icons when status changes
  useEffect(() => {
    if (window.lucide) {
      window.lucide.createIcons();
    }
  }, [status.running]);

  const toggleSync = async () => {
    try {
      if (status.running) {
        await API.sync.stop();
        addLog('Sync stopped', 'info');
      } else {
        const result = await API.sync.start();
        if (result.success) {
          addLog('Sync started', 'success');
        } else {
          addLog(`Failed to start sync: ${result.error}`, 'error');
        }
      }
    } catch (err) {
      addLog(`Sync error: ${err.message}`, 'error');
    }
  };

  const onSourceChange = async (e) => {
    const lightId = e.target.value;
    setSelectedLight(lightId);
    try {
      await API.sync.setConfig({ hueDeviceId: lightId });
      addLog(`Sync source changed`, 'info');
    } catch (err) {
      addLog(`Failed to set source: ${err.message}`, 'error');
    }
  };

  const onBrightnessChange = async (type, value) => {
    const newMin = type === 'min' ? value : minBri;
    const newMax = type === 'max' ? value : maxBri;
    if (type === 'min') setMinBri(value);
    else setMaxBri(value);

    try {
      await API.nanoleaf.updateConfig({
        minBrightness: newMin,
        maxBrightness: newMax
      });
    } catch (err) {
      console.error('Failed to update brightness:', err);
    }
  };

  const controls = html`
    <button class="btn-icon ${status.running ? 'btn-stop' : 'btn-start'}" onClick=${toggleSync} title=${status.running ? 'Stop' : 'Start'}>
      <i data-lucide=${status.running ? 'square' : 'play'}></i>
    </button>
  `;

  const lastSync = status.lastSync ? new Date(status.lastSync).toLocaleTimeString() : '--:--:--';
  const colorStyle = status.currentColor
    ? `rgb(${status.currentColor.r}, ${status.currentColor.g}, ${status.currentColor.b})`
    : 'transparent';
  const colorText = status.currentColor
    ? `RGB(${status.currentColor.r}, ${status.currentColor.g}, ${status.currentColor.b})`
    : '---';

  return html`
    <${Panel} panelKey="sync" defaultName="SYNC CONTROL" icon="activity" controls=${controls}>
      <div class="sync-content">
        <div class="sync-status">
          <div class="sync-info">
            <div class="sync-row">
              <span class="label">STATUS:</span>
              <${StatusBadge} status=${status.running ? 'RUNNING' : 'STOPPED'} className=${status.running ? 'online' : 'offline'} />
            </div>
            <div class="sync-row">
              <span class="label">SOURCE:</span>
              <span class="value">
                <select class="control-select" value=${selectedLight} onChange=${onSourceChange} disabled=${config?.allowChange === false}>
                  <option value="">-- Select a light --</option>
                  ${rooms.map(room => {
                    const syncable = room.lights.filter(l => SYNCABLE_CATEGORIES.includes(l.category));
                    if (syncable.length === 0) return null;
                    return html`
                      <optgroup label=${room.name}>
                        ${syncable.map(light => html`
                          <option value=${light.id} selected=${String(light.id) === String(selectedLight)}>${light.name}</option>
                        `)}
                      </optgroup>
                    `;
                  })}
                </select>
              </span>
            </div>
            <div class="sync-row">
              <span class="label">LAST SYNC:</span>
              <span class="value">${lastSync}</span>
            </div>
            <div class="sync-row">
              <span class="label">COLOR:</span>
              <span class="value">
                <span class="color-preview" style="background-color: ${colorStyle}"></span>
                <span>${colorText}</span>
              </span>
            </div>
          </div>
        </div>
        <div class="brightness-config">
          <div class="config-row">
            <span class="label">BRIGHTNESS RANGE:</span>
            <span class="value">${minBri}% - ${maxBri}%</span>
          </div>
          <div class="slider-row">
            <label>MIN:</label>
            <input type="range" min="0" max="100" value=${minBri} onInput=${(e) => onBrightnessChange('min', parseInt(e.target.value))} />
            <span>${minBri}%</span>
          </div>
          <div class="slider-row">
            <label>MAX:</label>
            <input type="range" min="0" max="100" value=${maxBri} onInput=${(e) => onBrightnessChange('max', parseInt(e.target.value))} />
            <span>${maxBri}%</span>
          </div>
        </div>
      </div>
    <//>
  `;
}
