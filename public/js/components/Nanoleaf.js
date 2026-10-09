import { html } from 'https://esm.sh/htm@3.1.1/preact';
import { useState, useEffect } from 'https://esm.sh/preact@10.19.3/hooks';
import { effect } from 'https://esm.sh/@preact/signals@1.2.1';
import { nanoleafState } from '../state.js';
import { Panel, StatusBadge } from './Panel.js';
import { API } from '../api.js';

function nanoleaf() {
  const [device, setDevice] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDevice(setDevice, setLoading);

    const dispose = effect(() => {
      if (nanoleafState.value) {
        setDevice(nanoleafState.value);
      }
    });

    return dispose;
  }, []);

  return html`
    <${Panel} panelKey="nanoleaf" defaultName="NANOLEAF" icon="triangle">
      ${renderDeviceContent(device, loading)}
    <//>
  `;
}

async function loadDevice(setDevice, setLoading) {
  const nanoleafApi = API.nanoleaf;

  try {
    const deviceInfo = await nanoleafApi.device();
    nanoleafState.value = deviceInfo;
    setDevice(deviceInfo);
  } catch (err) {
    console.error('Failed to load Nanoleaf:', err);
  }

  setLoading(false);
}

function renderDeviceContent(device, loading) {
  if (loading) {
    return html`<div class="loading">Connecting...</div>`;
  }

  if (!device || !device.configured) {
    return html`
      <div class="device-info">
        <div class="info-row">
          <span class="label">STATUS:</span>
          <${StatusBadge} status="NOT CONFIGURED" className="offline" />
        </div>
        <p style="margin-top: 12px; color: var(--text-dim)">
          Configure in network settings
        </p>
      </div>
    `;
  }

  return renderConnectedDevice(device);
}

function renderConnectedDevice(device) {
  const ipDisplay = device.port ? `${device.ip}:${device.port}` : device.ip;

  return html`
    <div class="device-info">
      <div class="info-row">
        <span class="label">STATUS:</span>
        <${StatusBadge} status="CONNECTED" className="online" />
      </div>
      ${device.ip ? renderInfoRow('IP:', ipDisplay) : null}
      ${device.name ? renderInfoRow('NAME:', device.name) : null}
    </div>
  `;
}

function renderInfoRow(label, value) {
  return html`
    <div class="info-row">
      <span class="label">${label}</span>
      <span class="value">${value}</span>
    </div>
  `;
}

export { nanoleaf as Nanoleaf };
