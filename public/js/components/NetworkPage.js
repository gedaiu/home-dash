import { html } from 'https://esm.sh/htm@3.1.1/preact';
import { useState, useEffect } from 'https://esm.sh/preact@10.19.3/hooks';
import { effect } from 'https://esm.sh/@preact/signals@1.2.1';
import { openwrtState, selectedDeviceMac } from '../state.js';
import { ConnectionGraph } from './ConnectionGraph.js';

export function NetworkPage() {
  const [state, setState] = useState(openwrtState.value);
  const [selectedMac, setSelectedMac] = useState(null);

  useEffect(() => {
    const dispose = effect(() => {
      setState(openwrtState.value);
    });
    return dispose;
  }, []);

  useEffect(() => {
    const dispose = effect(() => {
      setSelectedMac(selectedDeviceMac.value);
    });
    return dispose;
  }, []);

  const handleDeviceClick = (device) => {
    selectedDeviceMac.value = selectedDeviceMac.value === device.mac ? null : device.mac;
  };

  const ipToNumber = (ip) => {
    if (!ip) {
      return 0;
    }
    const parts = ip.split('.');
    return parts.reduce((acc, part) => (acc << 8) + parseInt(part, 10), 0) >>> 0;
  };

  const { routers, devices, connections } = state;
  const sortedDevices = [...devices].sort((a, b) => ipToNumber(a.ip) - ipToNumber(b.ip));
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
            ${routers.map(router => html`
              <section class="panel router-panel">
                <div class="panel-header">
                  <i data-lucide="server"></i>
                  <span>${router.name || router.id}</span>
                  <span class="router-status ${router.online ? 'online' : 'offline'}">
                    ${router.online ? 'Online' : 'Offline'}
                  </span>
                </div>
                <div class="panel-content">
                  <div class="info-grid">
                    <div class="info-row">
                      <span class="label">IP</span>
                      <span class="value">${router.ip || '--'}</span>
                    </div>
                    <div class="info-row">
                      <span class="label">Role</span>
                      <span class="value">${router.role || '--'}</span>
                    </div>
                  </div>
                  <div class="router-stats">
                    <div class="stat">
                      <span class="stat-label">CPU</span>
                      <span class="stat-value">${router.cpu != null ? router.cpu.toFixed(1) : '--'}%</span>
                    </div>
                    <div class="stat">
                      <span class="stat-label">MEM</span>
                      <span class="stat-value">${router.memory != null ? router.memory.toFixed(1) : '--'}%</span>
                    </div>
                    <div class="stat">
                      <span class="stat-label">TEMP</span>
                      <span class="stat-value">${router.temp != null ? router.temp.toFixed(1) : '--'}C</span>
                    </div>
                  </div>
                </div>
              </section>
            `)}

            <section class="panel devices-panel">
              <div class="panel-header">
                <i data-lucide="smartphone"></i>
                <span>DEVICES (${sortedDevices.filter(d => d.online).length}/${sortedDevices.length})</span>
              </div>
              <div class="panel-content device-list-panel">
                ${sortedDevices.length === 0 && html`
                  <div class="loading">No devices detected yet...</div>
                `}
                ${sortedDevices.map(device => html`
                  <div
                    class="device-row ${device.online ? 'online' : 'offline'} ${selectedMac === device.mac ? 'selected' : ''}"
                    onClick=${() => handleDeviceClick(device)}
                  >
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
