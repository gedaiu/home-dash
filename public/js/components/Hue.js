import { html } from 'https://esm.sh/htm@3.1.1/preact';
import { useState, useEffect } from 'https://esm.sh/preact@10.19.3/hooks';
import { effect } from 'https://esm.sh/@preact/signals@1.2.1';
import { hueState, addLog } from '../state.js';
import { Panel, StatusBadge } from './Panel.js';
import { API } from '../api.js';

function hue() {
  const [bridge, setBridge] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBridge(setBridge, setLoading);

    const dispose = effect(() => {
      if (hueState.value) {
        setBridge(hueState.value);
      }
    });

    return dispose;
  }, []);

  const controls = html`
    <button class="btn-icon" onClick=${discoverHue} title="Discover">
      <i data-lucide="search"></i>
    </button>
  `;

  return renderHuePanel(controls, renderBridgeContent(bridge, loading));
}

async function loadBridge(setBridge, setLoading) {
  const hueApi = API.hue;

  try {
    const bridgeInfo = await hueApi.bridge();
    hueState.value = bridgeInfo;
    setBridge(bridgeInfo);
  } catch (err) {
    console.error('Failed to load Hue bridge:', err);
  }

  setLoading(false);
}

async function discoverHue() {
  const hueApi = API.hue;
  addLog('Discovering Hue bridges...', 'info');

  try {
    const bridges = await hueApi.discover();

    if (bridges.length === 0) {
      addLog('No Hue bridges found', 'warning');

      return;
    }

    addLog(`Found ${bridges.length} bridge(s)`, 'success');
  } catch (err) {
    addLog(`Discovery failed: ${err.message}`, 'error');
  }
}

function renderHuePanel(controls, content) {
  return html`
    <${Panel} panelKey="hue" defaultName="HUE BRIDGE" icon="lightbulb" controls=${controls}>
      ${content}
    <//>
  `;
}

function renderBridgeContent(bridge, loading) {
  if (loading) {
    return html`<div class="loading">Connecting...</div>`;
  }

  if (!bridge || !bridge.configured) {
    return html`
      <div class="device-info">
        <div class="info-row">
          <span class="label">STATUS:</span>
          <${StatusBadge} status="NOT CONFIGURED" className="offline" />
        </div>
        <p style="margin-top: 12px; color: var(--text-dim)">
          Click search to discover bridges
        </p>
      </div>
    `;
  }

  return renderConnectedBridge(bridge);
}

function renderConnectedBridge(bridge) {
  return html`
    <div class="device-info">
      <div class="info-row">
        <span class="label">STATUS:</span>
        <${StatusBadge} status="CONNECTED" className="online" />
      </div>
      <div class="info-row">
        <span class="label">IP:</span>
        <span class="value">${bridge.ip}</span>
      </div>
      ${bridge.name ? html`
        <div class="info-row">
          <span class="label">NAME:</span>
          <span class="value">${bridge.name}</span>
        </div>
      ` : null}
    </div>
  `;
}

export { hue as Hue };
