import { API } from '../api.js';
import { $ } from '../utils.js';
import { log } from '../log.js';
import { showModal, hideModal } from '../modal.js';

export async function loadHueBridge() {
  const content = $('#hue-content');

  try {
    const bridge = await API.hue.bridge();

    if (!bridge.configured) {
      content.innerHTML = `
        <div class="device-info">
          <div class="info-row">
            <span class="label">STATUS:</span>
            <span class="status-badge offline">NOT CONFIGURED</span>
          </div>
          <p style="margin-top: 12px; color: var(--text-dim)">
            Click the search icon to discover your Hue Bridge
          </p>
        </div>
      `;
      return;
    }

    content.innerHTML = `
      <div class="device-info">
        <div class="info-row">
          <span class="label">STATUS:</span>
          <span class="status-badge online">CONNECTED</span>
        </div>
        <div class="info-row">
          <span class="label">NAME:</span>
          <span class="value">${bridge.name}</span>
        </div>
        <div class="info-row">
          <span class="label">IP:</span>
          <span class="value">${bridge.ip}</span>
        </div>
        <div class="info-row">
          <span class="label">API:</span>
          <span class="value">${bridge.apiVersion}</span>
        </div>
      </div>
    `;
  } catch (err) {
    content.innerHTML = `<div class="loading error">Error: ${err.message}</div>`;
  }
}

export async function discoverHue() {
  showModal('DISCOVERING HUE BRIDGES', '<div class="loading">Scanning network...</div>');
  log('Scanning for Hue bridges...');

  try {
    const bridges = await API.hue.discover();

    if (bridges.length === 0) {
      showModal('NO BRIDGES FOUND', `
        <p>No Hue bridges were found on your network.</p>
        <p style="margin-top: 12px">Make sure your bridge is powered on and connected to the same network.</p>
      `, '<button class="btn" onclick="hideModal()">CLOSE</button>');
      return;
    }

    showModal('SELECT HUE BRIDGE', `
      <div class="device-list">
        ${bridges.map(b => `
          <div class="device-item" onclick="pairHue('${b.ip}')">
            <i data-lucide="server"></i>
            <span class="name">Hue Bridge</span>
            <span class="ip">${b.ip}</span>
          </div>
        `).join('')}
      </div>
    `);
    lucide.createIcons();
  } catch (err) {
    showModal('ERROR', `<p class="error">${err.message}</p>`,
      '<button class="btn" onclick="hideModal()">CLOSE</button>');
  }
}

export async function pairHue(ip) {
  showModal('PAIRING HUE BRIDGE', `
    <div class="pairing-instructions">
      <i data-lucide="circle-dot"></i>
      <p>Press the <span class="highlight">Link button</span> on your Hue Bridge</p>
      <p>Then click PAIR below</p>
    </div>
  `, `
    <button class="btn" onclick="hideModal()">CANCEL</button>
    <button class="btn btn-start" onclick="confirmPairHue('${ip}')">PAIR</button>
  `);
  lucide.createIcons();
}

export async function confirmPairHue(ip, loadRooms) {
  showModal('PAIRING...', '<div class="loading">Connecting to bridge...</div>');

  try {
    const result = await API.hue.pair(ip);

    if (result.success) {
      hideModal();
      log('Hue Bridge paired successfully!', 'success');
      await loadHueBridge();
      if (loadRooms) {
        await loadRooms();
      }
    } else {
      showModal('PAIRING FAILED', `
        <p class="error">${result.error}</p>
        <p style="margin-top: 12px">Make sure you pressed the Link button, then try again.</p>
      `, `
        <button class="btn" onclick="hideModal()">CANCEL</button>
        <button class="btn btn-start" onclick="pairHue('${ip}')">RETRY</button>
      `);
    }
  } catch (err) {
    showModal('ERROR', `<p class="error">${err.message}</p>`,
      '<button class="btn" onclick="hideModal()">CLOSE</button>');
  }
}
