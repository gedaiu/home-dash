import { API } from './api.js';
import { $, $$, SYNCABLE_CATEGORIES } from './utils.js';
import { attachEditableTitles } from './panels.js';
import { setNanoleafDevice, setNanoleafConfig } from './devices/nanoleaf.js';
import { renderSensorPanels } from './rooms-sensors.js';
import { renderRoomPanel, applyLightState } from './rooms-panels.js';

export { updatePm25Sensors } from './rooms-sensors.js';

let allRooms = [];
let allLights = [];
let selectedLightId = null;
let configLocked = false;

export function getAllRooms() {
  return allRooms;
}

export function getAllLights() {
  return allLights;
}

export function getSelectedLightId() {
  return selectedLightId;
}

export function setSelectedLightId(id) {
  selectedLightId = id;
}

export function setConfigLocked(locked) {
  configLocked = locked;
}

export async function loadRooms() {
  const content = $('#rooms-content');

  try {
    await renderRooms(content);
  } catch (err) {
    content.innerHTML = `<div class="loading error">Error: ${err.message}</div>`;
  }
}

export function updateRooms(rooms) {
  if (!rooms || rooms.length === 0) {
    return;
  }

  allRooms = rooms;
  allLights = rooms.flatMap(room => room.lights);

  renderSensorsRoom(rooms);
  rooms.filter(isRegularRoom).flatMap(room => room.lights).forEach(updateLightItem);
  lucide.createIcons();
}

export function populateLightSelect() {
  const select = $('#sync-source-select');
  const currentValue = select.value;

  select.innerHTML = '<option value="">-- Select a light --</option>';

  allRooms
    .map(room => ({ room, syncableLights: room.lights.filter(light => SYNCABLE_CATEGORIES.includes(light.category)) }))
    .filter(({ syncableLights }) => syncableLights.length > 0)
    .forEach(({ room, syncableLights }) => select.appendChild(createLightOptgroup(room, syncableLights)));

  if (currentValue && !select.value) {
    select.value = currentValue;
  }
}

async function renderRooms(content) {
  const rooms = await fetchRooms();

  if (rooms.length === 0) {
    content.innerHTML = `<div class="loading">No rooms found. Configure Hue Bridge first.</div>`;

    return;
  }

  allRooms = rooms;
  allLights = rooms.flatMap(room => room.lights);
  populateLightSelect();
  renderSensorsRoom(rooms);

  content.innerHTML = rooms.filter(isRegularRoom).map(room => renderRoomPanel(room, selectedLightId)).join('');

  lucide.createIcons();
  attachEditableTitles();

  $$('.refresh-room').forEach(button => {
    button.addEventListener('click', loadRooms);
  });
}

async function fetchRooms() {
  const [rooms, device, config] = await Promise.all([
    API.hue.rooms(),
    API.nanoleaf.device(),
    API.nanoleaf.config()
  ]);

  setNanoleafDevice(device?.configured ? device : null);
  setNanoleafConfig(config?.configured ? config : null);

  return rooms;
}

function renderSensorsRoom(rooms) {
  const sensorsRoom = rooms.find(room => !isRegularRoom(room));

  if (sensorsRoom) {
    $('#sensors-content').innerHTML = renderSensorPanels(sensorsRoom.lights);
  }
}

function isRegularRoom(room) {
  return room.id !== 'sensors';
}

function updateLightItem(light) {
  const element = $(`.light-item[data-id="${light.id}"]`);

  if (element) {
    applyLightState(element, light);
  }
}

function createLightOptgroup(room, syncableLights) {
  const optgroup = document.createElement('optgroup');
  optgroup.label = room.name;

  syncableLights.forEach(light => {
    const option = document.createElement('option');
    option.value = light.id;
    option.textContent = light.name;

    if (String(light.id) === String(selectedLightId)) {
      option.selected = true;
    }

    optgroup.appendChild(option);
  });

  return optgroup;
}
