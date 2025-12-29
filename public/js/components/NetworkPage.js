import { html } from 'https://esm.sh/htm@3.1.1/preact';
import { useState, useEffect } from 'https://esm.sh/preact@10.19.3/hooks';
import { effect } from 'https://esm.sh/@preact/signals@1.2.1';
import { openwrtState, selectedDeviceMac, selectedCountry, selectedDestination } from '../state.js';
import { ConnectionGraph } from './ConnectionGraph.js';

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + units[i];
}

function formatDuration(ms) {
  if (ms < 1000) return 'just now';
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m ago`;
}

function formatTimeRange(ms) {
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return '< 1 min';
  if (minutes < 60) return `${minutes} min`;

  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

const DISPLAY_MODES = [
  { value: 'orgs', label: 'Orgs' },
  { value: 'hosts', label: 'Hosts' },
  { value: 'ips', label: 'IPs' }
];

const DEST_LIMITS = [
  { value: 30, label: '30' },
  { value: 50, label: '50' },
  { value: 100, label: '100' },
  { value: 200, label: '200' },
  { value: 0, label: 'All' }
];

export function NetworkPage() {
  const [state, setState] = useState(openwrtState.value);
  const [selectedMac, setSelectedMac] = useState(null);
  const [selCountry, setSelCountry] = useState(null);
  const [selDest, setSelDest] = useState(null);
  const [viewMode, setViewMode] = useState('local');
  const [displayMode, setDisplayMode] = useState('orgs');
  const [maxDests, setMaxDests] = useState(30);

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

  useEffect(() => {
    const dispose = effect(() => {
      setSelCountry(selectedCountry.value);
    });
    return dispose;
  }, []);

  useEffect(() => {
    const dispose = effect(() => {
      setSelDest(selectedDestination.value);
    });
    return dispose;
  }, []);

  // Re-create Lucide icons when selection changes
  useEffect(() => {
    if (window.lucide) {
      window.lucide.createIcons();
    }
  }, [selectedMac, selCountry, selDest, state]);

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

  // Check if anything is selected
  const hasSelection = selectedMac || selCountry || selDest;

  // Build connection data for details panel
  const connectionData = (() => {
    const deviceMap = new Map();
    const destMap = new Map();
    const countryMap = new Map();

    for (const conn of connections) {
      if (!conn.enriched || !conn.srcMac) {
        continue;
      }

      const bytes = conn.bytes || 0;
      const country = conn.enriched.country || 'Unknown';

      let destLabel;
      if (displayMode === 'ips') {
        destLabel = conn.dst_ip;
      } else if (displayMode === 'hosts') {
        destLabel = conn.enriched.hostname || conn.dst_ip;
      } else {
        destLabel = conn.enriched.org || conn.dst_ip;
      }

      // Track device data
      if (!deviceMap.has(conn.srcMac)) {
        const device = devices.find(d => d.mac === conn.srcMac);
        deviceMap.set(conn.srcMac, {
          mac: conn.srcMac,
          hostname: device?.hostname || conn.srcHostname || conn.srcMac.substring(0, 8),
          ip: device?.ip || conn.src_ip,
          totalBytes: 0,
          connectionCount: 0,
          countries: new Map(),
          destinations: new Map()
        });
      }
      const deviceData = deviceMap.get(conn.srcMac);
      deviceData.totalBytes += bytes;
      deviceData.connectionCount++;

      // Track device's countries
      if (!deviceData.countries.has(country)) {
        deviceData.countries.set(country, { code: country, bytes: 0 });
      }
      deviceData.countries.get(country).bytes += bytes;

      // Track device's destinations
      if (!deviceData.destinations.has(destLabel)) {
        deviceData.destinations.set(destLabel, {
          label: destLabel,
          country,
          ip: conn.dst_ip,
          hostname: conn.enriched.hostname,
          org: conn.enriched.org,
          bytes: 0
        });
      }
      deviceData.destinations.get(destLabel).bytes += bytes;

      // Track global destinations
      if (!destMap.has(destLabel)) {
        destMap.set(destLabel, {
          label: destLabel,
          country,
          ip: conn.dst_ip,
          hostname: conn.enriched.hostname,
          org: conn.enriched.org,
          totalBytes: 0,
          connectionCount: 0,
          devices: new Set(),
          firstSeen: conn.lastSeen || Date.now(),
          lastSeen: conn.lastSeen || Date.now()
        });
      }
      const destData = destMap.get(destLabel);
      destData.totalBytes += bytes;
      destData.connectionCount++;
      destData.devices.add(conn.srcMac);
      if (conn.lastSeen) {
        if (conn.lastSeen < destData.firstSeen) {
          destData.firstSeen = conn.lastSeen;
        }
        if (conn.lastSeen > destData.lastSeen) {
          destData.lastSeen = conn.lastSeen;
        }
      }

      // Track global countries
      if (!countryMap.has(country)) {
        countryMap.set(country, {
          code: country,
          totalBytes: 0,
          devices: new Set(),
          destinations: new Set()
        });
      }
      const countryData = countryMap.get(country);
      countryData.totalBytes += bytes;
      countryData.devices.add(conn.srcMac);
      countryData.destinations.add(destLabel);
    }

    return {
      devices: deviceMap,
      destinations: destMap,
      countries: countryMap
    };
  })();

  // Get selected item details
  const selectedDeviceData = selectedMac ? connectionData.devices.get(selectedMac) : null;
  const selectedCountryData = selCountry ? connectionData.countries.get(selCountry) : null;
  const selectedDestData = selDest ? connectionData.destinations.get(selDest) : null;

  // Helper to get sorted arrays from Maps
  const getDeviceCountries = (deviceData) => {
    if (!deviceData) return [];
    return Array.from(deviceData.countries.values()).sort((a, b) => b.bytes - a.bytes);
  };

  const getDeviceDestinations = (deviceData) => {
    if (!deviceData) return [];
    return Array.from(deviceData.destinations.values()).sort((a, b) => b.bytes - a.bytes);
  };

  const getCountryDevices = (countryCode) => {
    const result = [];
    for (const [mac, deviceData] of connectionData.devices) {
      if (deviceData.countries.has(countryCode)) {
        result.push({
          ...deviceData,
          bytesToCountry: deviceData.countries.get(countryCode).bytes
        });
      }
    }
    return result.sort((a, b) => b.bytesToCountry - a.bytesToCountry);
  };

  const getDestDevices = (destLabel) => {
    const destData = connectionData.destinations.get(destLabel);
    if (!destData) return [];
    const result = [];
    for (const mac of destData.devices) {
      const deviceData = connectionData.devices.get(mac);
      if (deviceData) {
        const destInfo = deviceData.destinations.get(destLabel);
        result.push({
          ...deviceData,
          bytesToDest: destInfo?.bytes || 0
        });
      }
    }
    return result.sort((a, b) => b.bytesToDest - a.bytesToDest);
  };

  const clearSelection = () => {
    selectedDeviceMac.value = null;
    selectedCountry.value = null;
    selectedDestination.value = null;
  };

  // Build remote destinations from connections (for list view)
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

  // Get country color
  const getCountryColor = (country) => {
    const colors = {
      'US': '#ff6b35', 'DE': '#ffa500', 'GB': '#ffb347', 'NL': '#ffd700',
      'FR': '#ff9500', 'CN': '#ff4500', 'JP': '#ff7f50', 'KR': '#ff6347',
      'AU': '#ffae42', 'CA': '#ff8c00', 'IE': '#32cd32', 'SG': '#ff69b4'
    };
    return colors[country] || '#cc7000';
  };

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
            <${ConnectionGraph}
              displayMode=${displayMode}
              maxDestinations=${maxDests === 0 ? Infinity : maxDests}
            />
          </div>

          <div class="network-sidebar">
            <div class="network-controls">
              <select
                class="control-select"
                value=${displayMode}
                onChange=${(e) => setDisplayMode(e.target.value)}
              >
                ${DISPLAY_MODES.map(m => html`
                  <option value=${m.value}>${m.label}</option>
                `)}
              </select>
              <select
                class="control-select"
                value=${maxDests}
                onChange=${(e) => setMaxDests(Number(e.target.value))}
              >
                ${DEST_LIMITS.map(l => html`
                  <option value=${l.value}>${l.label}</option>
                `)}
              </select>
            </div>

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

            ${hasSelection ? html`
              <section class="panel details-panel">
                <div class="panel-header details-header-bar">
                  <i data-lucide="${selectedMac ? 'smartphone' : selDest ? 'server' : 'globe'}"></i>
                  <span>${selectedMac ? 'Device Details' : selDest ? 'Destination Details' : 'Country Details'}</span>
                  <button class="close-btn" onClick=${clearSelection} title="Close"></button>
                </div>
                <div class="panel-content details-content">
                  ${selectedMac && selectedDeviceData && html`
                    <div class="details-header">
                      <span class="details-name device-color">${selectedDeviceData.hostname}</span>
                      <span class="details-subtitle">${selectedDeviceData.ip}</span>
                      <span class="details-subtitle mono">${selectedMac}</span>
                    </div>
                    <div class="details-stats">
                      <div class="stat">
                        <span class="stat-value">${formatBytes(selectedDeviceData.totalBytes)}</span>
                        <span class="stat-label">Traffic</span>
                      </div>
                      <div class="stat">
                        <span class="stat-value">${selectedDeviceData.connectionCount}</span>
                        <span class="stat-label">Connections</span>
                      </div>
                    </div>
                    <div class="details-section">
                      <div class="section-title">Countries</div>
                      <div class="details-list">
                        ${getDeviceCountries(selectedDeviceData).slice(0, 8).map(c => html`
                          <div class="details-row clickable" onClick=${() => {
                            selectedDeviceMac.value = null;
                            selectedCountry.value = c.code;
                            selectedDestination.value = null;
                          }}>
                            <span class="row-color" style="background: ${getCountryColor(c.code)}"></span>
                            <span class="row-label">${c.code}</span>
                            <span class="row-value">${formatBytes(c.bytes)}</span>
                          </div>
                        `)}
                      </div>
                    </div>
                    <div class="details-section">
                      <div class="section-title">Top Destinations</div>
                      <div class="details-list">
                        ${getDeviceDestinations(selectedDeviceData).slice(0, 8).map(d => html`
                          <div class="details-row clickable" onClick=${() => {
                            selectedDeviceMac.value = null;
                            selectedCountry.value = d.country;
                            selectedDestination.value = d.label;
                          }}>
                            <span class="row-color" style="background: ${getCountryColor(d.country)}"></span>
                            <span class="row-label">${d.label}</span>
                            <span class="row-value">${formatBytes(d.bytes)}</span>
                          </div>
                        `)}
                      </div>
                    </div>
                  `}

                  ${selCountry && !selDest && selectedCountryData && html`
                    <div class="details-header">
                      <span class="details-name" style="color: ${getCountryColor(selCountry)}">${selCountry}</span>
                    </div>
                    <div class="details-stats">
                      <div class="stat">
                        <span class="stat-value">${formatBytes(selectedCountryData.totalBytes)}</span>
                        <span class="stat-label">Traffic</span>
                      </div>
                      <div class="stat">
                        <span class="stat-value">${selectedCountryData.devices.size}</span>
                        <span class="stat-label">Devices</span>
                      </div>
                      <div class="stat">
                        <span class="stat-value">${selectedCountryData.destinations.size}</span>
                        <span class="stat-label">Destinations</span>
                      </div>
                    </div>
                    <div class="details-section">
                      <div class="section-title">Local Devices</div>
                      <div class="details-list">
                        ${getCountryDevices(selCountry).slice(0, 8).map(d => html`
                          <div class="details-row clickable" onClick=${() => {
                            selectedDeviceMac.value = d.mac;
                            selectedCountry.value = null;
                            selectedDestination.value = null;
                          }}>
                            <span class="row-color" style="background: #00d4aa"></span>
                            <span class="row-label">${d.hostname}</span>
                            <span class="row-value">${formatBytes(d.bytesToCountry)}</span>
                          </div>
                        `)}
                      </div>
                    </div>
                  `}

                  ${selDest && selectedDestData && html`
                    <div class="details-header">
                      <span class="details-name" style="color: ${getCountryColor(selectedDestData.country)}">${selectedDestData.label}</span>
                      <span class="details-subtitle">${selectedDestData.country || 'Unknown'}</span>
                      ${selectedDestData.hostname && selectedDestData.hostname !== selectedDestData.label && html`
                        <span class="details-subtitle mono">${selectedDestData.hostname}</span>
                      `}
                      ${selectedDestData.ip && html`
                        <span class="details-subtitle mono">${selectedDestData.ip}</span>
                      `}
                    </div>
                    <div class="details-stats">
                      <div class="stat">
                        <span class="stat-value">${formatBytes(selectedDestData.totalBytes)}</span>
                        <span class="stat-label">Traffic</span>
                      </div>
                      <div class="stat">
                        <span class="stat-value">${selectedDestData.connectionCount}</span>
                        <span class="stat-label">Connections</span>
                      </div>
                      <div class="stat">
                        <span class="stat-value">${selectedDestData.devices.size}</span>
                        <span class="stat-label">Devices</span>
                      </div>
                    </div>
                    <div class="details-section">
                      <div class="section-title">Local Devices</div>
                      <div class="details-list">
                        ${getDestDevices(selDest).slice(0, 10).map(d => html`
                          <div class="details-row clickable" onClick=${() => {
                            selectedDeviceMac.value = d.mac;
                            selectedCountry.value = null;
                            selectedDestination.value = null;
                          }}>
                            <span class="row-color" style="background: #00d4aa"></span>
                            <span class="row-label">${d.hostname}</span>
                            <span class="row-value">${formatBytes(d.bytesToDest)}</span>
                          </div>
                        `)}
                      </div>
                    </div>
                    <div class="details-section data-info">
                      <div class="section-title">Data Info</div>
                      <div class="details-list">
                        <div class="details-row">
                          <span class="row-label">Time window</span>
                          <span class="row-value">${formatTimeRange(selectedDestData.lastSeen - selectedDestData.firstSeen)}</span>
                        </div>
                        <div class="details-row">
                          <span class="row-label">Last seen</span>
                          <span class="row-value">${formatDuration(Date.now() - selectedDestData.lastSeen)}</span>
                        </div>
                        <div class="details-row">
                          <span class="row-label">Source</span>
                          <span class="row-value">conntrack</span>
                        </div>
                      </div>
                      <div class="data-info-note">
                        Traffic is measured from active connections. Old connections are pruned after 5 minutes of inactivity.
                      </div>
                    </div>
                  `}
                </div>
              </section>
            ` : html`
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
            `}
          </div>
        </div>
      `}
    </div>
  `;
}
