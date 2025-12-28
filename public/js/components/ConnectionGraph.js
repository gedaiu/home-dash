import { html } from 'https://esm.sh/htm@3.1.1/preact';
import { useEffect, useState, useRef } from 'https://esm.sh/preact@10.19.3/hooks';
import { effect } from 'https://esm.sh/@preact/signals@1.2.1';
import { openwrtState, selectedDeviceMac } from '../state.js';

function buildConnectionData(connections, devices) {
  const deviceMap = new Map();
  const destinationMap = new Map();

  devices.forEach(device => {
    deviceMap.set(device.mac, {
      mac: device.mac,
      hostname: device.hostname || device.mac.substring(0, 8),
      ip: device.ip,
      online: device.online,
      totalBytes: 0,
      connectionCount: 0,
      destinations: new Map()
    });
  });

  connections.forEach(conn => {
    if (!conn.srcMac || !conn.enriched) {
      return;
    }

    if (!deviceMap.has(conn.srcMac)) {
      deviceMap.set(conn.srcMac, {
        mac: conn.srcMac,
        hostname: conn.srcHostname || conn.srcMac.substring(0, 8),
        ip: conn.src_ip,
        online: true,
        totalBytes: 0,
        connectionCount: 0,
        destinations: new Map()
      });
    }

    const device = deviceMap.get(conn.srcMac);
    const org = conn.enriched.org || conn.enriched.asName || conn.enriched.isp;
    const country = conn.enriched.country;
    const dstLabel = org || country || conn.dst_ip;
    const bytes = conn.bytes || 0;

    device.totalBytes += bytes;
    device.connectionCount += 1;

    if (!device.destinations.has(dstLabel)) {
      device.destinations.set(dstLabel, { label: dstLabel, country, org, bytes: 0, count: 0 });
    }
    const dest = device.destinations.get(dstLabel);
    dest.bytes += bytes;
    dest.count += 1;

    if (!destinationMap.has(dstLabel)) {
      destinationMap.set(dstLabel, { label: dstLabel, country, org, totalBytes: 0, devices: new Set() });
    }
    const destGlobal = destinationMap.get(dstLabel);
    destGlobal.totalBytes += bytes;
    destGlobal.devices.add(conn.srcMac);
  });

  const deviceList = Array.from(deviceMap.values())
    .map(d => ({ ...d, destinations: Array.from(d.destinations.values()).sort((a, b) => b.bytes - a.bytes) }))
    .sort((a, b) => b.totalBytes - a.totalBytes);

  const destinationList = Array.from(destinationMap.values())
    .sort((a, b) => b.totalBytes - a.totalBytes)
    .slice(0, 30);

  return { devices: deviceList, destinations: destinationList };
}

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + units[i];
}

function getCountryColor(country) {
  const colors = {
    'US': '#ff6b35', 'DE': '#ffa500', 'GB': '#ffb347', 'NL': '#ffd700',
    'FR': '#ff9500', 'CN': '#ff4500', 'JP': '#ff7f50', 'KR': '#ff6347',
    'AU': '#ffae42', 'CA': '#ff8c00', 'IE': '#32cd32', 'SG': '#ff69b4'
  };
  return colors[country] || '#cc7000';
}

export function ConnectionGraph() {
  const [data, setData] = useState({ devices: [], destinations: [] });
  const [selectedMac, setSelectedMac] = useState(null);
  const [selectedDest, setSelectedDest] = useState(null);
  const [hoveredDest, setHoveredDest] = useState(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    let lastUpdate = 0;
    const dispose = effect(() => {
      const state = openwrtState.value;
      const now = Date.now();
      if (now - lastUpdate < 3000) return;
      lastUpdate = now;
      setData(buildConnectionData(state.connections || [], state.devices || []));
    });
    return dispose;
  }, []);

  useEffect(() => {
    const dispose = effect(() => setSelectedMac(selectedDeviceMac.value));
    return dispose;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || data.devices.length === 0) return;

    const ctx = canvas.getContext('2d');
    const rect = canvas.parentElement.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const width = rect.width;
    const height = rect.height;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    ctx.scale(dpr, dpr);

    const centerX = width / 2;
    const centerY = height / 2;
    const innerRadius = Math.min(width, height) * 0.15;
    const outerRadius = Math.min(width, height) * 0.42;

    // Clear
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, width, height);

    // Draw grid circles
    ctx.strokeStyle = 'rgba(255, 140, 0, 0.1)';
    ctx.lineWidth = 1;
    for (let r = innerRadius; r <= outerRadius; r += (outerRadius - innerRadius) / 3) {
      ctx.beginPath();
      ctx.arc(centerX, centerY, r, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Position destinations around outer ring
    const destinations = data.destinations;
    const destPositions = destinations.map((dest, i) => {
      const angle = (i / destinations.length) * Math.PI * 2 - Math.PI / 2;
      return {
        ...dest,
        x: centerX + Math.cos(angle) * outerRadius,
        y: centerY + Math.sin(angle) * outerRadius,
        angle
      };
    });

    // Position devices in inner ring
    const devices = data.devices.filter(d => d.connectionCount > 0);
    const devicePositions = devices.map((device, i) => {
      const angle = (i / devices.length) * Math.PI * 2 - Math.PI / 2;
      return {
        ...device,
        x: centerX + Math.cos(angle) * innerRadius,
        y: centerY + Math.sin(angle) * innerRadius,
        angle
      };
    });

    // Draw connections
    devicePositions.forEach(device => {
      const isDeviceSelected = selectedMac === device.mac;

      device.destinations.forEach(dest => {
        const destPos = destPositions.find(d => d.label === dest.label);
        if (!destPos) return;

        const isDestSelected = selectedDest === dest.label;
        const isHighlighted = isDeviceSelected || isDestSelected || hoveredDest === dest.label;

        let alpha;
        if (selectedMac) {
          alpha = isDeviceSelected ? 0.6 : 0.05;
        } else if (selectedDest) {
          alpha = isDestSelected ? 0.6 : 0.05;
        } else if (hoveredDest) {
          alpha = hoveredDest === dest.label ? 0.6 : 0.05;
        } else {
          alpha = 0.2;
        }

        const lineWidth = isHighlighted ? Math.min(1 + Math.log2(dest.bytes / 1000 + 1) * 0.5, 4) : 1;

        ctx.beginPath();
        ctx.strokeStyle = isHighlighted ? getCountryColor(dest.country) : `rgba(255, 140, 0, ${alpha})`;
        ctx.lineWidth = lineWidth;

        // Curved line
        const midX = centerX;
        const midY = centerY;
        ctx.moveTo(device.x, device.y);
        ctx.quadraticCurveTo(midX, midY, destPos.x, destPos.y);
        ctx.stroke();
      });
    });

    // Draw destination nodes
    destPositions.forEach(dest => {
      const isHovered = hoveredDest === dest.label;
      const isSelected = selectedDest === dest.label;
      const hasConnectionToSelectedDevice = selectedMac ? devices.find(d => d.mac === selectedMac)?.destinations.some(dd => dd.label === dest.label) : true;

      let alpha;
      if (selectedMac) {
        alpha = hasConnectionToSelectedDevice ? 1 : 0.2;
      } else if (selectedDest) {
        alpha = isSelected ? 1 : 0.2;
      } else if (hoveredDest) {
        alpha = isHovered ? 1 : 0.2;
      } else {
        alpha = 0.8;
      }

      const radius = (isHovered || isSelected) ? 12 : 6 + Math.min(Math.log2(dest.devices.size + 1) * 2, 6);

      ctx.beginPath();
      ctx.arc(dest.x, dest.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = getCountryColor(dest.country);
      ctx.globalAlpha = alpha;
      ctx.fill();
      ctx.globalAlpha = 1;

      // Highlight ring for selected destination
      if (isSelected) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Label
      if (isHovered || isSelected || (!selectedMac && !selectedDest && !hoveredDest)) {
        ctx.fillStyle = `rgba(255, 140, 0, ${alpha})`;
        ctx.font = (isSelected ? 'bold ' : '') + '11px monospace';
        ctx.textAlign = dest.x > centerX ? 'left' : 'right';
        ctx.textBaseline = 'middle';
        const labelX = dest.x + (dest.x > centerX ? 14 : -14);
        const label = dest.label.length > 20 ? dest.label.substring(0, 18) + '...' : dest.label;
        ctx.fillText(label, labelX, dest.y);
      }
    });

    // Draw device nodes
    devicePositions.forEach(device => {
      const isSelected = selectedMac === device.mac;
      const isConnectedToSelectedDest = selectedDest && device.destinations.some(d => d.label === selectedDest);
      const isHighlighted = isSelected || isConnectedToSelectedDest;

      let alpha = 1;
      if (selectedDest && !isConnectedToSelectedDest) {
        alpha = 0.3;
      }

      const radius = isHighlighted ? 14 : 10;

      ctx.beginPath();
      ctx.arc(device.x, device.y, radius, 0, Math.PI * 2);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = isHighlighted ? '#00ff88' : (device.online ? '#00d4aa' : '#4a4a4a');
      ctx.fill();
      ctx.strokeStyle = isHighlighted ? '#00ff88' : '#1a1a1a';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.globalAlpha = 1;

      // Label
      ctx.globalAlpha = alpha;
      ctx.fillStyle = isHighlighted ? '#00ff88' : '#00d4aa';
      ctx.font = isHighlighted ? 'bold 12px monospace' : '11px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(device.hostname, device.x, device.y + radius + 4);
      ctx.globalAlpha = 1;
    });

    // Store positions for click detection
    canvas._devicePositions = devicePositions;
    canvas._destPositions = destPositions;

  }, [data, selectedMac, selectedDest, hoveredDest]);

  const handleCanvasClick = (e) => {
    const canvas = canvasRef.current;
    if (!canvas._devicePositions) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Check device clicks first
    for (const device of canvas._devicePositions) {
      const dx = x - device.x;
      const dy = y - device.y;
      if (dx * dx + dy * dy < 200) {
        const newMac = selectedMac === device.mac ? null : device.mac;
        setSelectedMac(newMac);
        selectedDeviceMac.value = newMac;
        setSelectedDest(null);
        return;
      }
    }

    // Check destination clicks
    for (const dest of canvas._destPositions || []) {
      const dx = x - dest.x;
      const dy = y - dest.y;
      if (dx * dx + dy * dy < 200) {
        const newDest = selectedDest === dest.label ? null : dest.label;
        setSelectedDest(newDest);
        setSelectedMac(null);
        selectedDeviceMac.value = null;
        return;
      }
    }

    // Click on empty space clears selection
    setSelectedMac(null);
    setSelectedDest(null);
    selectedDeviceMac.value = null;
  };

  const handleCanvasMove = (e) => {
    const canvas = canvasRef.current;
    if (!canvas._destPositions) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    for (const dest of canvas._destPositions) {
      const dx = x - dest.x;
      const dy = y - dest.y;
      if (dx * dx + dy * dy < 200) {
        if (hoveredDest !== dest.label) setHoveredDest(dest.label);
        return;
      }
    }

    if (hoveredDest) setHoveredDest(null);
  };

  const selectedDevice = selectedMac ? data.devices.find(d => d.mac === selectedMac) : null;
  const selectedDestination = selectedDest ? data.destinations.find(d => d.label === selectedDest) : null;

  // Get connected devices for selected destination
  const connectedDevices = selectedDestination
    ? data.devices.filter(d => d.destinations.some(dest => dest.label === selectedDest))
        .map(d => ({
          ...d,
          bytesToDest: d.destinations.find(dest => dest.label === selectedDest)?.bytes || 0
        }))
        .sort((a, b) => b.bytesToDest - a.bytesToDest)
    : [];

  const hasData = data.devices.length > 0;

  return html`
    <div class="radial-graph-container">
      <div class="radial-canvas-wrapper">
        <canvas
          ref=${canvasRef}
          onClick=${handleCanvasClick}
          onMouseMove=${handleCanvasMove}
          onMouseLeave=${() => setHoveredDest(null)}
        />
        ${!hasData && html`
          <div class="radial-empty">
            <span>Waiting for connection data...</span>
          </div>
        `}
      </div>

      ${selectedDevice && html`
        <div class="radial-details">
          <div class="radial-details-header">
            <span class="device-name">${selectedDevice.hostname}</span>
            <button class="close-btn" onClick=${() => { setSelectedMac(null); selectedDeviceMac.value = null; }}>x</button>
          </div>
          <div class="radial-details-info">
            <span class="device-ip">${selectedDevice.ip}</span>
            <span class="device-mac">${selectedDevice.mac}</span>
          </div>
          <div class="radial-details-stats">
            <div class="stat">
              <span class="stat-value">${formatBytes(selectedDevice.totalBytes)}</span>
              <span class="stat-label">traffic</span>
            </div>
            <div class="stat">
              <span class="stat-value">${selectedDevice.connectionCount}</span>
              <span class="stat-label">connections</span>
            </div>
          </div>
          <div class="radial-destinations">
            ${selectedDevice.destinations.slice(0, 8).map(dest => html`
              <div class="radial-dest-row">
                <span class="dest-color" style="background: ${getCountryColor(dest.country)}"></span>
                <span class="dest-label">${dest.label}</span>
                <span class="dest-bytes">${formatBytes(dest.bytes)}</span>
              </div>
            `)}
          </div>
        </div>
      `}

      ${selectedDestination && html`
        <div class="radial-details">
          <div class="radial-details-header">
            <span class="device-name" style="color: ${getCountryColor(selectedDestination.country)}">${selectedDestination.label}</span>
            <button class="close-btn" onClick=${() => setSelectedDest(null)}>x</button>
          </div>
          <div class="radial-details-info">
            <span class="device-ip">${selectedDestination.country || 'Unknown'}</span>
            <span class="device-mac">${selectedDestination.org || ''}</span>
          </div>
          <div class="radial-details-stats">
            <div class="stat">
              <span class="stat-value">${formatBytes(selectedDestination.totalBytes)}</span>
              <span class="stat-label">traffic</span>
            </div>
            <div class="stat">
              <span class="stat-value">${connectedDevices.length}</span>
              <span class="stat-label">devices</span>
            </div>
          </div>
          <div class="radial-destinations">
            ${connectedDevices.slice(0, 8).map(device => html`
              <div class="radial-dest-row">
                <span class="dest-color" style="background: #00d4aa"></span>
                <span class="dest-label">${device.hostname}</span>
                <span class="dest-bytes">${formatBytes(device.bytesToDest)}</span>
              </div>
            `)}
          </div>
        </div>
      `}
    </div>
  `;
}
