import { html } from 'https://esm.sh/htm@3.1.1/preact';
import { useState, useEffect } from 'https://esm.sh/preact@10.19.3/hooks';
import { effect } from 'https://esm.sh/@preact/signals@1.2.1';
import { openwrtState } from '../state.js';
import { ConnectionGraph } from './ConnectionGraph.js';

export function NetworkPage() {
  const [state, setState] = useState(openwrtState.value);

  useEffect(() => {
    const dispose = effect(() => {
      setState(openwrtState.value);
    });
    return dispose;
  }, []);

  const { routers, devices, connections } = state;
  const hasData = routers.length > 0;

  return html`
    <div class="network-page">
      <div class="network-header">
        <h2 class="network-title">
          <i data-lucide="network"></i>
          NETWORK MONITOR
        </h2>
        <div class="network-status">
          ${hasData
            ? html`<span class="status-badge online">Connected</span>`
            : html`<span class="status-badge offline">No routers connected</span>`
          }
        </div>
      </div>

      ${!hasData && html`
        <div class="network-setup">
          <div class="setup-card">
            <i data-lucide="router"></i>
            <h3>Setup Required</h3>
            <p>Install the OpenWrt agent on your router(s) to start monitoring your network.</p>
            <div class="setup-steps">
              <div class="step">
                <span class="step-number">1</span>
                <span class="step-text">Install <code>luci-app-netmon</code> on your OpenWrt router</span>
              </div>
              <div class="step">
                <span class="step-number">2</span>
                <span class="step-text">Go to Services > Network Monitor in LuCI</span>
              </div>
              <div class="step">
                <span class="step-number">3</span>
                <span class="step-text">Enter this server's URL: <code>ws://${window.location.hostname}:${window.location.port || '3000'}/ws/agent</code></span>
              </div>
              <div class="step">
                <span class="step-number">4</span>
                <span class="step-text">Click Save & Apply</span>
              </div>
            </div>
          </div>
        </div>
      `}

      ${hasData && html`
        <div class="network-grid">
          <section class="panel network-graph-panel">
            <div class="panel-header">
              <i data-lucide="share-2"></i>
              <span>CONNECTION GRAPH</span>
            </div>
            <div class="panel-content graph-panel-content">
              <${ConnectionGraph} />
            </div>
          </section>

          <div class="network-sidebar">
            <section class="panel">
              <div class="panel-header">
                <i data-lucide="server"></i>
                <span>ROUTERS</span>
              </div>
              <div class="panel-content">
                ${routers.map(router => html`
                  <div class="router-card ${router.online ? 'online' : 'offline'}">
                    <div class="router-header">
                      <span class="router-name">${router.name || router.id}</span>
                      <span class="router-role">${router.role}</span>
                    </div>
                    <div class="router-stats">
                      <div class="stat">
                        <span class="stat-label">CPU</span>
                        <span class="stat-value">${router.cpu || '--'}%</span>
                      </div>
                      <div class="stat">
                        <span class="stat-label">MEM</span>
                        <span class="stat-value">${router.memory || '--'}%</span>
                      </div>
                      <div class="stat">
                        <span class="stat-label">TEMP</span>
                        <span class="stat-value">${router.temp || '--'}C</span>
                      </div>
                    </div>
                  </div>
                `)}
              </div>
            </section>

            <section class="panel">
              <div class="panel-header">
                <i data-lucide="smartphone"></i>
                <span>DEVICES (${devices.filter(d => d.online).length}/${devices.length})</span>
              </div>
              <div class="panel-content device-list-panel">
                ${devices.length === 0 && html`
                  <div class="loading">No devices detected yet...</div>
                `}
                ${devices.map(device => html`
                  <div class="device-row ${device.online ? 'online' : 'offline'}">
                    <span class="device-indicator"></span>
                    <span class="device-name">${device.hostname || device.mac}</span>
                    <span class="device-ip">${device.ip}</span>
                  </div>
                `)}
              </div>
            </section>
          </div>
        </div>
      `}
    </div>
  `;
}
