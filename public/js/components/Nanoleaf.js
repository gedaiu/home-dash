import { html } from 'https://esm.sh/htm@3.1.1/preact';
import { useState, useEffect } from 'https://esm.sh/preact@10.19.3/hooks';
import { effect } from 'https://esm.sh/@preact/signals@1.2.1';
import { nanoleafState, addLog } from '../state.js';
import { Panel, StatusBadge } from './Panel.js';
import { API } from '../api.js';

export function Nanoleaf() {
  const [device, setDevice] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    API.nanoleaf.device().then(data => {
      nanoleafState.value = data;
      setDevice(data);
      setLoading(false);
    }).catch(err => {
      console.error('Failed to load Nanoleaf:', err);
      setLoading(false);
    });

    const dispose = effect(() => {
      if (nanoleafState.value) {
        setDevice(nanoleafState.value);
      }
    });
    return dispose;
  }, []);

  if (loading) {
    return html`
      <${Panel} panelKey="nanoleaf" defaultName="NANOLEAF" icon="triangle">
        <div class="loading">Connecting...</div>
      <//>
    `;
  }

  if (!device || !device.configured) {
    return html`
      <${Panel} panelKey="nanoleaf" defaultName="NANOLEAF" icon="triangle">
        <div class="device-info">
          <div class="info-row">
            <span class="label">STATUS:</span>
            <${StatusBadge} status="NOT CONFIGURED" className="offline" />
          </div>
          <p style="margin-top: 12px; color: var(--text-dim)">
            Configure in network settings
          </p>
        </div>
      <//>
    `;
  }

  const ipDisplay = device.port ? `${device.ip}:${device.port}` : device.ip;

  return html`
    <${Panel} panelKey="nanoleaf" defaultName="NANOLEAF" icon="triangle">
      <div class="device-info">
        <div class="info-row">
          <span class="label">STATUS:</span>
          <${StatusBadge} status="CONNECTED" className="online" />
        </div>
        ${device.ip ? html`
          <div class="info-row">
            <span class="label">IP:</span>
            <span class="value">${ipDisplay}</span>
          </div>
        ` : null}
        ${device.name ? html`
          <div class="info-row">
            <span class="label">NAME:</span>
            <span class="value">${device.name}</span>
          </div>
        ` : null}
      </div>
    <//>
  `;
}
