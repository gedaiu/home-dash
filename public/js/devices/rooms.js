import { html } from 'htm/preact';
import { useState, useEffect } from 'preact/hooks';
import { rooms, hue, nanoleaf, addLog } from '../state.js';
import { API } from '../api.js';
import { Panel } from '../components/Panel.js';
import { getRoomIcon, getDeviceIcon, getLightColor, getStateText, getNanoleafColor } from './rooms-helpers.js';

export { roomsGrid as Rooms };

// Legacy exports for backwards compatibility
export async function loadRooms() {
  try {
    const [roomsData, device, config] = await Promise.all([
      API.hue.rooms(),
      API.nanoleaf.device(),
      API.nanoleaf.config()
    ]);

    rooms.value = roomsData;

    nanoleaf.value = {
      device: device?.configured ? device : null,
      config: config?.configured ? config : null
    };

    const allLights = roomsData.flatMap(room => room.lights);
    hue.value = { ...hue.value, lights: allLights };
  } catch (err) {
    addLog(`Failed to load rooms: ${err.message}`, 'error');
  }
}

export function updateRooms(roomsData) {
  rooms.value = roomsData;

  const allLights = roomsData.flatMap(room => room.lights);
  hue.value = { ...hue.value, lights: allLights };
}

function roomsGrid() {
  const allRooms = rooms.value || [];
  const nanoleafState = nanoleaf.value;
  const [selectedLightId, setSelectedLightId] = useState(null);

  useEffect(() => {
    loadSyncConfig(setSelectedLightId);
  }, []);

  const regularRooms = allRooms.filter(room => room.id !== 'sensors');

  if (regularRooms.length === 0) {
    return html`
      <div class="rooms-grid" id="rooms-content">
        <div class="loading">No rooms found. Configure Hue Bridge first.</div>
      </div>
    `;
  }

  return html`
    <div class="rooms-grid" id="rooms-content">
      ${regularRooms.map(room => html`
        <${roomPanel}
          key=${room.id}
          room=${room}
          selectedLightId=${selectedLightId}
          nanoleafDevice=${nanoleafState.device}
          nanoleafConfig=${nanoleafState.config}
        />
      `)}
    </div>
  `;
}

async function loadSyncConfig(setSelectedLightId) {
  try {
    const config = await API.sync.config();

    if (config.hueDeviceId) {
      setSelectedLightId(config.hueDeviceId);
    }
  } catch (err) {
    // Ignore config load errors
  }
}

function roomPanel({ room, selectedLightId, nanoleafDevice, nanoleafConfig }) {
  const { refreshing, handleRefresh } = useRoomRefresh();
  const panelKey = `room:${room.id}`;
  const showNanoleaf = nanoleafConfig?.roomId?.toLowerCase() === room.name.toLowerCase();

  useIconRefresh(room.lights);

  return html`
    <${Panel}
      icon=${getRoomIcon(room.class)}
      title=${room.name.toUpperCase()}
      panelKey=${panelKey}
      defaultName=${room.name.toUpperCase()}
      controls=${refreshButton(refreshing, handleRefresh)}
    >
      <div class="lights-list">
        ${showNanoleaf && nanoleafDevice?.configured && html`
          <${nanoleafItem} device=${nanoleafDevice} />
        `}
        ${room.lights.map(light => html`
          <${lightItem}
            key=${light.id}
            light=${light}
            isSelected=${String(light.id) === String(selectedLightId)}
          />
        `)}
      </div>
    <//>
  `;
}

function useRoomRefresh() {
  const [refreshing, setRefreshing] = useState(false);

  async function handleRefresh() {
    setRefreshing(true);

    try {
      await loadRooms();
    } finally {
      setRefreshing(false);
    }
  }

  return { refreshing, handleRefresh };
}

function useIconRefresh(lights) {
  useEffect(() => {
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
  }, [lights]);
}

function refreshButton(refreshing, handleRefresh) {
  return html`
    <button class=${`btn-icon ${refreshing ? 'spinning' : ''}`} onClick=${handleRefresh} title="Refresh">
      <i data-lucide="refresh-cw"></i>
    </button>
  `;
}

function lightItem({ light, isSelected }) {
  const isOn = light.state.on && light.state.reachable !== false;
  const isOffline = light.state.reachable === false;
  const color = getLightColor(light.state);
  const icon = getDeviceIcon(light.category, light.archetype);
  const stateText = getStateText(light);

  const classes = [
    'light-item',
    isSelected ? 'selected' : '',
    isOffline ? 'offline' : ''
  ].filter(Boolean).join(' ');

  return html`
    <div
      class=${classes}
      data-id=${light.id}
      data-name=${light.name}
      data-category=${light.category}
    >
      <i data-lucide=${icon} class=${`device-icon ${isOn ? 'on' : ''}`}></i>
      <span class=${`light-indicator ${isOn ? 'on' : ''}`} style=${`background-color: ${color}`}></span>
      <span class="light-name">${light.name}</span>
      <span class="light-state">${stateText}</span>
    </div>
  `;
}

function nanoleafItem({ device }) {
  if (!device) {
    return null;
  }

  const { onClass, offClass, color, stateText } = describeNanoleaf(device.state);

  return html`
    <div
      class=${`light-item nanoleaf-item ${offClass}`}
      data-id="nanoleaf"
      data-name=${device.name}
      data-category="nanoleaf"
    >
      <i data-lucide="triangle" class=${`device-icon ${onClass}`}></i>
      <span class=${`light-indicator ${onClass}`} style=${`background-color: ${color}`}></span>
      <span class="light-name">${device.name}</span>
      <span class="light-state">${stateText}</span>
    </div>
  `;
}

function describeNanoleaf(state) {
  if (!state?.on) {
    return { onClass: '', offClass: 'off', color: getNanoleafColor(null), stateText: 'OFF' };
  }

  return { onClass: 'on', offClass: '', color: getNanoleafColor(state), stateText: `${state.brightness || 0}%` };
}
