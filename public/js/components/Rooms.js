import { html } from 'https://esm.sh/htm@3.1.1/preact';
import { useState, useEffect } from 'https://esm.sh/preact@10.19.3/hooks';
import { effect } from 'https://esm.sh/@preact/signals@1.2.1';
import { roomsState, getPanelDisplayName } from '../state.js';
import { API } from '../api.js';

const ROOM_ICONS = {
  'living_room': 'sofa', 'kitchen': 'utensils', 'dining': 'utensils-crossed',
  'bedroom': 'bed-double', 'kids_bedroom': 'baby', 'bathroom': 'bath',
  'office': 'briefcase', 'gym': 'dumbbell', 'hallway': 'door-open',
  'garage': 'warehouse', 'terrace': 'trees', 'garden': 'flower-2',
  'home': 'home', 'attic': 'triangle', 'staircase': 'stairs',
  'lounge': 'armchair', 'computer': 'monitor', 'tv': 'tv',
  'laundry_room': 'washing-machine', 'balcony': 'fence', 'other': 'layout-grid'
};

const ARCHETYPE_ICONS = {
  'sultanbulb': 'lightbulb', 'classicbulb': 'lightbulb', 'spotbulb': 'circle-dot',
  'pendantround': 'lamp-ceiling', 'ceilinground': 'lamp-ceiling',
  'flexiblelamp': 'lamp-desk', 'tablelamp': 'lamp-desk', 'floorlamp': 'lamp-floor',
  'plug': 'plug', 'lightstrip': 'grip-horizontal', 'hueplay': 'tv'
};

const CATEGORY_ICONS = {
  plug: 'plug', strip: 'grip-horizontal', candle: 'flame',
  spot: 'circle-dot', ceiling: 'lamp-ceiling', lamp: 'lamp-desk', bulb: 'lightbulb'
};

function getRoomIcon(roomClass) {
  return ROOM_ICONS[roomClass] || 'layout-grid';
}

function getDeviceIcon(category, archetype) {
  if (archetype && ARCHETYPE_ICONS[archetype]) return ARCHETYPE_ICONS[archetype];
  return CATEGORY_ICONS[category] || 'cpu';
}

function getLightColor(state) {
  if (!state.on || state.reachable === false) return '#333';
  if (state.colormode === 'xy' && state.xy) {
    const [x, y] = state.xy;
    const z = 1 - x - y;
    const Y = state.bri / 254;
    const X = (Y / y) * x;
    const Z = (Y / y) * z;
    let r = X * 3.2406 - Y * 1.5372 - Z * 0.4986;
    let g = -X * 0.9689 + Y * 1.8758 + Z * 0.0415;
    let b = X * 0.0557 - Y * 0.2040 + Z * 1.0570;
    r = r > 0.0031308 ? 1.055 * Math.pow(r, 1/2.4) - 0.055 : 12.92 * r;
    g = g > 0.0031308 ? 1.055 * Math.pow(g, 1/2.4) - 0.055 : 12.92 * g;
    b = b > 0.0031308 ? 1.055 * Math.pow(b, 1/2.4) - 0.055 : 12.92 * b;
    r = Math.min(255, Math.max(0, Math.round(r * 255)));
    g = Math.min(255, Math.max(0, Math.round(g * 255)));
    b = Math.min(255, Math.max(0, Math.round(b * 255)));
    return `rgb(${r},${g},${b})`;
  }
  if (state.colormode === 'ct' && state.ct) {
    const kelvin = Math.round(1000000 / state.ct);
    const temp = kelvin / 100;
    let r, g, b;
    if (temp <= 66) {
      r = 255;
      g = Math.min(255, Math.max(0, 99.4708 * Math.log(temp) - 161.1196));
    } else {
      r = Math.min(255, Math.max(0, 329.698 * Math.pow(temp - 60, -0.1332)));
      g = Math.min(255, Math.max(0, 288.122 * Math.pow(temp - 60, -0.0755)));
    }
    if (temp >= 66) b = 255;
    else if (temp <= 19) b = 0;
    else b = Math.min(255, Math.max(0, 138.5177 * Math.log(temp - 10) - 305.0448));
    return `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
  }
  return '#ffcc00';
}

function getStateText(light) {
  if (light.state.reachable === false) return 'Offline';
  if (!light.state.on) return 'Off';
  const bri = Math.round((light.state.bri / 254) * 100);
  return `${bri}%`;
}

function LightItem({ light, isSelected }) {
  const isOn = light.state.on && light.state.reachable !== false;
  const isOffline = light.state.reachable === false;
  const color = getLightColor(light.state);
  const icon = getDeviceIcon(light.category, light.archetype);
  const stateText = getStateText(light);

  return html`
    <div class="light-item ${isSelected ? 'selected' : ''} ${isOffline ? 'offline' : ''}"
         data-id=${light.id} data-name=${light.name} data-category=${light.category}>
      <i data-lucide=${icon} class="device-icon ${isOn ? 'on' : ''}"></i>
      <span class="light-indicator ${isOn ? 'on' : ''}" style="background-color: ${color}"></span>
      <span class="light-name">${light.name}</span>
      <span class="light-state">${stateText}</span>
    </div>
  `;
}

function RoomPanel({ room, selectedLightId }) {
  const roomIcon = getRoomIcon(room.class);
  const panelKey = `room:${room.id}`;
  const displayName = getPanelDisplayName(panelKey, room.name.toUpperCase());

  return html`
    <section class="panel room-panel" data-panel-key=${panelKey} data-default-name=${room.name.toUpperCase()}>
      <div class="panel-header">
        <i data-lucide=${roomIcon}></i>
        <span class="panel-title">${displayName}</span>
      </div>
      <div class="panel-content">
        <div class="lights-list">
          ${room.lights.map(light => html`
            <${LightItem} key=${light.id} light=${light} isSelected=${String(light.id) === String(selectedLightId)} />
          `)}
        </div>
      </div>
    </section>
  `;
}

export function Rooms() {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    API.hue.rooms().then(data => {
      roomsState.value = data || [];
      setLoading(false);
    }).catch(err => {
      console.error('Failed to load rooms:', err);
      setLoading(false);
    });

    const dispose = effect(() => {
      const allRooms = roomsState.value || [];
      setRooms(allRooms.filter(r => r.id !== 'sensors'));
    });
    return dispose;
  }, []);

  useEffect(() => {
    if (window.lucide) {
      window.lucide.createIcons();
    }
  }, [rooms]);

  if (loading) {
    return html`<div class="loading">Loading rooms...</div>`;
  }

  if (rooms.length === 0) {
    return html`<div class="loading">No rooms found. Configure Hue Bridge first.</div>`;
  }

  return html`
    ${rooms.map(room => html`<${RoomPanel} key=${room.id} room=${room} />`)}
  `;
}
