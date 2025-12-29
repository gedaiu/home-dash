import { html } from 'https://esm.sh/htm@3.1.1/preact';
import { useState, useEffect } from 'https://esm.sh/preact@10.19.3/hooks';
import { effect } from 'https://esm.sh/@preact/signals@1.2.1';
import { openwrtState, selectedDeviceMac } from '../state.js';
import { ConnectionGraph } from './ConnectionGraph.js';

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + units[i];
}

export function NetworkPage() {
  const [state, setState] = useState(openwrtState.value);
  const [selectedMac, setSelectedMac] = useState(null);
  const [viewMode, setViewMode] = useState('local'); // 'local' or 'remote'

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

  // Build remote destinations from connections
  const remoteDestinations = (() => {
    const destMap = new Map();

    for (const conn of connections) {
      if (!conn.enriched) {
        continue;
      }

      const ip = conn.dst_ip;
      const existing = destMap.get(ip);
      const bytes = conn.bytes || 0;

      if (existing) {
        existing.bytes += bytes;
        existing.connectionCount++;
      } else {
        destMap.set(ip, {
          ip,
          hostname: conn.enriched.hostname || null,
          country: conn.enriched.country || null,
          org: conn.enriched.org || conn.enriched.asName || null,
          bytes,
          connectionCount: 1
        });
      }
    }

    return Array.from(destMap.values()).sort((a, b) => b.bytes - a.bytes);
  })();

  return html`
    <div class="network-page">
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
          <div class="network-graph-panel">
            <${ConnectionGraph} />
          </div>

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
                <i data-lucide="${viewMode === 'local' ? 'smartphone' : 'globe'}"></i>
                <span>${viewMode === 'local'
                  ? `DEVICES (${sortedDevices.filter(d => d.online).length}/${sortedDevices.length})`
                  : `DESTINATIONS (${remoteDestinations.length})`
                }</span>
                <button
                  class="view-toggle-btn"
                  onClick=${() => setViewMode(viewMode === 'local' ? 'remote' : 'local')}
                  title=${viewMode === 'local' ? 'Show remote destinations' : 'Show local devices'}
                >
                  ${viewMode === 'local' ? 'Remote' : 'Local'}
                </button>
              </div>
              <div class="panel-content device-list-panel">
                ${viewMode === 'local' && html`
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
                `}
                ${viewMode === 'remote' && html`
                  ${remoteDestinations.length === 0 && html`
                    <div class="loading">No remote connections yet...</div>
                  `}
                  ${remoteDestinations.map(dest => html`
                    <div class="device-row remote-dest online">
                      <span class="device-indicator" style="background: ${dest.country ? '#ff8c00' : '#666'}"></span>
                      <div class="remote-dest-info">
                        <span class="device-name">
                          ${dest.country ? `[${dest.country}] ` : ''}${dest.hostname || dest.ip}
                        </span>
                        <span class="remote-dest-org">${dest.org || ''}</span>
                      </div>
                      <span class="remote-dest-traffic">${formatBytes(dest.bytes)}</span>
                    </div>
                  `)}
                `}
              </div>
            </section>
          </div>
        </div>
      `}
    </div>
  `;
}
