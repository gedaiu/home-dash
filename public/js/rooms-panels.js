import { getDeviceIcon, getRoomIcon, getLightColor, getStateText } from './utils.js';
import { getPanelDisplayName } from './panels.js';
import { nanoleafConfig, renderNanoleafItem } from './devices/nanoleaf.js';

export function renderRoomPanel(room, selectedLightId) {
  const showNanoleaf = nanoleafConfig?.roomId?.toLowerCase() === room.name.toLowerCase();
  const roomIcon = getRoomIcon(room.class);
  const panelKey = `room:${room.id}`;
  const displayName = getPanelDisplayName(panelKey, room.name.toUpperCase());
  const { lights } = room;
  const lightItems = lights.map(light => renderLightItem(light, selectedLightId)).join('');

  return `
        <section class="panel room-panel" data-panel-key="${panelKey}" data-default-name="${room.name.toUpperCase()}">
          <div class="panel-header">
            <i data-lucide="${roomIcon}"></i>
            <span class="panel-title">${displayName}</span>
            <button class="btn-icon refresh-room" title="Refresh">
              <i data-lucide="refresh-cw"></i>
            </button>
          </div>
          <div class="panel-content">
            <div class="lights-list">
              ${showNanoleaf ? renderNanoleafItem() : ''}
              ${lightItems}
            </div>
          </div>
        </section>
      `;
}

export function applyLightState(element, light) {
  const { isOn, isOffline } = getLightStatus(light);
  const indicator = element.querySelector('.light-indicator');
  const icon = element.querySelector('.device-icon');
  const stateElement = element.querySelector('.light-state');

  element.classList.toggle('offline', isOffline);

  if (indicator) {
    indicator.classList.toggle('on', isOn);
    indicator.style.backgroundColor = getLightColor(light.state);
  }

  if (icon) {
    icon.classList.toggle('on', isOn);
  }

  if (stateElement) {
    stateElement.textContent = getStateText(light);
  }
}

function renderLightItem(light, selectedLightId) {
  const isSelected = String(light.id) === String(selectedLightId);
  const { isOn, isOffline } = getLightStatus(light);
  const color = getLightColor(light.state);
  const icon = getDeviceIcon(light.category, light.archetype);
  const stateText = getStateText(light);

  return `
                  <div class="light-item ${isSelected ? 'selected' : ''} ${isOffline ? 'offline' : ''}"
                       data-id="${light.id}"
                       data-name="${light.name}"
                       data-category="${light.category}">
                    <i data-lucide="${icon}" class="device-icon ${isOn ? 'on' : ''}"></i>
                    <span class="light-indicator ${isOn ? 'on' : ''}"
                          style="background-color: ${color}"></span>
                    <span class="light-name">${light.name}</span>
                    <span class="light-state">${stateText}</span>
                  </div>
                `;
}

function getLightStatus(light) {
  return {
    isOn: light.state.on && light.state.reachable !== false,
    isOffline: light.state.reachable === false
  };
}
