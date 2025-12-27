import { loadPanelNames, attachEditableTitles } from './panels.js';
import { initEkg, stopEkg } from './ekg.js';
import { log, initLog } from './log.js';
import { hideModal } from './modal.js';
import { initWebSocket } from './websocket.js';
import { loadSyncConfig, initSyncControls } from './sync.js';
import { renderRooms, renderSensors, populateLightSelect } from './rooms.js';
import { loadHueBridge, discoverHue, pairHue, confirmPairHue } from './devices/hue.js';
import { loadNanoleaf, discoverNanoleaf, pairNanoleaf, confirmPairNanoleaf } from './devices/nanoleaf.js';
import { loadRoomba, startRoomba, stopRoomba, pauseRoomba, resumeRoomba, dockRoomba, toggleRoombaDetails } from './devices/roomba.js';
import { loadAirPurifiers, togglePurifierPower, setPurifierMode, setPurifierFan, connectPurifier, addPurifier, confirmAddPurifier, removePurifier, confirmRemovePurifier } from './devices/airpurifier.js';
import { loadHomeConnect, discoverHomeConnect, configureHomeConnect, startHomeConnectAuth, disconnectHomeConnect } from './devices/homeconnect.js';
import { API } from './api.js';

window.hideModal = hideModal;
window.discoverHue = discoverHue;
window.pairHue = pairHue;
window.confirmPairHue = confirmPairHue;
window.discoverNanoleaf = discoverNanoleaf;
window.pairNanoleaf = pairNanoleaf;
window.confirmPairNanoleaf = confirmPairNanoleaf;
window.startRoomba = startRoomba;
window.stopRoomba = stopRoomba;
window.pauseRoomba = pauseRoomba;
window.resumeRoomba = resumeRoomba;
window.dockRoomba = dockRoomba;
window.toggleRoombaDetails = toggleRoombaDetails;
window.togglePurifierPower = togglePurifierPower;
window.setPurifierMode = setPurifierMode;
window.setPurifierFan = setPurifierFan;
window.connectPurifier = connectPurifier;
window.addPurifier = addPurifier;
window.confirmAddPurifier = confirmAddPurifier;
window.removePurifier = removePurifier;
window.confirmRemovePurifier = confirmRemovePurifier;
window.discoverHomeConnect = discoverHomeConnect;
window.configureHomeConnect = configureHomeConnect;
window.startHomeConnectAuth = startHomeConnectAuth;
window.disconnectHomeConnect = disconnectHomeConnect;

function updateClock() {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const mins = String(now.getMinutes()).padStart(2, '0');
  const secs = String(now.getSeconds()).padStart(2, '0');
  document.getElementById('clock').textContent = `${hours}:${mins}:${secs}`;
}

async function loadRooms() {
  try {
    const rooms = await API.hue.rooms();
    renderRooms(rooms);
    populateLightSelect(rooms);
    lucide.createIcons();
    attachEditableTitles();
  } catch (err) {
    document.getElementById('rooms-content').innerHTML = `<div class="error">Failed to load rooms: ${err.message}</div>`;
  }
}

async function loadSensors() {
  try {
    const rooms = await API.hue.rooms();
    renderSensors(rooms);
    lucide.createIcons();
    attachEditableTitles();
  } catch (err) {
    document.getElementById('sensors-content').innerHTML = `<div class="error">Failed to load sensors: ${err.message}</div>`;
  }
}

async function init() {
  lucide.createIcons();
  updateClock();
  setInterval(updateClock, 1000);

  initLog();
  initSyncControls();

  await loadPanelNames();

  await Promise.all([
    loadHueBridge(),
    loadNanoleaf(),
    loadRoomba(),
    loadAirPurifiers(),
    loadHomeConnect(),
    loadRooms(),
    loadSensors(),
    loadSyncConfig()
  ]);

  initWebSocket();

  log('System ready');
}

document.addEventListener('DOMContentLoaded', init);
