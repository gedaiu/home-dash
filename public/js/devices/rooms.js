import { html } from 'htm/preact';
import { useState, useEffect } from 'preact/hooks';
import { rooms, hue, nanoleaf, addLog, getPanelName } from '../state.js';
import { API } from '../api.js';
import { Panel } from '../components/Panel.js';

const ROOM_ICONS = {
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

const ARCHETYPE_ICONS = {
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

const CATEGORY_ICONS = {
  plug: 'plug',
  strip: 'grip-horizontal',
  candle: 'flame',
  spot: 'circle-dot',
  ceiling: 'lamp-ceiling',
  lamp: 'lamp-desk',
  bulb: 'lightbulb',
  device: 'cpu'
};

function getRoomIcon(roomClass) {
  return ROOM_ICONS[roomClass] || 'layout-grid';
}

function getDeviceIcon(category, archetype) {
  if (archetype && ARCHETYPE_ICONS[archetype]) {
    return ARCHETYPE_ICONS[archetype];
  }
  return CATEGORY_ICONS[category] || 'cpu';
}

function getLightColor(state) {
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

function getStateText(light) {
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

function getNanoleafColor(state) {
  if (!state?.on) {
    return '#333';
  }
  if (state.hue !== undefined && state.sat !== undefined) {
    return `hsl(${state.hue}, ${state.sat}%, 50%)`;
  }
  return '#fff';
}

function LightItem({ light, isSelected }) {
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

function NanoleafItem({ device }) {
  if (!device) {
    return null;
  }

  const isOn = device.state?.on;
  const color = isOn ? getNanoleafColor(device.state) : '#333';
  const stateText = isOn ? `${device.state?.brightness || 0}%` : 'OFF';

  return html`
    <div
      class=${`light-item nanoleaf-item ${isOn ? '' : 'off'}`}
      data-id="nanoleaf"
      data-name=${device.name}
      data-category="nanoleaf"
    >
      <i data-lucide="triangle" class=${`device-icon ${isOn ? 'on' : ''}`}></i>
      <span class=${`light-indicator ${isOn ? 'on' : ''}`} style=${`background-color: ${color}`}></span>
      <span class="light-name">${device.name}</span>
      <span class="light-state">${stateText}</span>
    </div>
  `;
}

function RoomPanel({ room, selectedLightId, nanoleafDevice, nanoleafConfig }) {
  const [refreshing, setRefreshing] = useState(false);
  const roomIcon = getRoomIcon(room.class);
  const panelKey = `room:${room.id}`;
  const displayName = getPanelName(panelKey, room.name.toUpperCase());

  const showNanoleaf = nanoleafConfig?.roomId?.toLowerCase() === room.name.toLowerCase();

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await loadRooms();
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
  }, [room.lights]);

  const refreshButton = html`
    <button class=${`btn-icon ${refreshing ? 'spinning' : ''}`} onClick=${handleRefresh} title="Refresh">
      <i data-lucide="refresh-cw"></i>
    </button>
  `;

  return html`
    <${Panel}
      icon=${roomIcon}
      title=${room.name.toUpperCase()}
      panelKey=${panelKey}
      defaultName=${room.name.toUpperCase()}
      controls=${refreshButton}
    >
      <div class="lights-list">
        ${showNanoleaf && nanoleafDevice?.configured && html`
          <${NanoleafItem} device=${nanoleafDevice} />
        `}
        ${room.lights.map(light => html`
          <${LightItem}
            key=${light.id}
            light=${light}
            isSelected=${String(light.id) === String(selectedLightId)}
          />
        `)}
      </div>
    <//>
  `;
}

export function Rooms() {
  const allRooms = rooms.value || [];
  const nanoleafState = nanoleaf.value;
  const [selectedLightId, setSelectedLightId] = useState(null);

  useEffect(() => {
    loadSyncConfig();
  }, []);

  async function loadSyncConfig() {
    try {
      const config = await API.sync.config();
      if (config.hueDeviceId) {
        setSelectedLightId(config.hueDeviceId);
      }
    } catch (err) {
      // Ignore config load errors
    }
  }

  const regularRooms = allRooms.filter(r => r.id !== 'sensors');

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
        <${RoomPanel}
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

    const allLights = roomsData.flatMap(r => r.lights);
    hue.value = { ...hue.value, lights: allLights };
  } catch (err) {
    addLog(`Failed to load rooms: ${err.message}`, 'error');
  }
}

export function updateRooms(data) {
  rooms.value = data;

  const allLights = data.flatMap(r => r.lights);
  hue.value = { ...hue.value, lights: allLights };
}
