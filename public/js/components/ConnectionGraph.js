import { html } from 'https://esm.sh/htm@3.1.1/preact';
import { useEffect, useState, useRef } from 'https://esm.sh/preact@10.19.3/hooks';
import { effect } from 'https://esm.sh/@preact/signals@1.2.1';
import {
  openwrtState,
  selectedDeviceMac,
  selectedCountry,
  selectedDestination,
  resolverState,
  findDeviceCustomization,
  getDeviceColor,
  getDeviceDisplayName,
  isDeviceVerified,
  DEVICE_TYPES
} from '../state.js';
import { sendMessage } from '../websocket-preact.js';

// Get device icon based on MAC and hostname
function getDeviceIconName(mac, hostname) {
  const custom = findDeviceCustomization(mac, hostname);
  const typeId = custom?.type || 'unknown';
  const deviceType = DEVICE_TYPES.find(t => t.id === typeId);
  return deviceType?.icon || 'help-circle';
}

// Simple icon drawing using basic shapes
function drawDeviceIcon(ctx, x, y, size, iconName, color, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 1.5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const s = size;

  switch (iconName) {
    case 'monitor':
      ctx.strokeRect(x - s, y - s * 0.7, s * 2, s * 1.2);
      ctx.beginPath();
      ctx.moveTo(x - s * 0.3, y + s * 0.5);
      ctx.lineTo(x + s * 0.3, y + s * 0.5);
      ctx.moveTo(x, y + s * 0.5);
      ctx.lineTo(x, y + s * 0.8);
      ctx.moveTo(x - s * 0.5, y + s * 0.8);
      ctx.lineTo(x + s * 0.5, y + s * 0.8);
      ctx.stroke();
      break;

    case 'laptop':
      ctx.strokeRect(x - s * 0.8, y - s * 0.5, s * 1.6, s * 0.9);
      ctx.beginPath();
      ctx.moveTo(x - s, y + s * 0.5);
      ctx.lineTo(x + s, y + s * 0.5);
      ctx.stroke();
      break;

    case 'smartphone':
      ctx.strokeRect(x - s * 0.4, y - s * 0.8, s * 0.8, s * 1.6);
      ctx.beginPath();
      ctx.arc(x, y + s * 0.5, s * 0.1, 0, Math.PI * 2);
      ctx.stroke();
      break;

    case 'tablet':
      ctx.strokeRect(x - s * 0.6, y - s * 0.8, s * 1.2, s * 1.6);
      ctx.beginPath();
      ctx.arc(x, y + s * 0.5, s * 0.1, 0, Math.PI * 2);
      ctx.stroke();
      break;

    case 'tv':
      ctx.strokeRect(x - s, y - s * 0.6, s * 2, s * 1.2);
      break;

    case 'speaker':
      ctx.strokeRect(x - s * 0.5, y - s * 0.8, s, s * 1.6);
      ctx.beginPath();
      ctx.arc(x, y + s * 0.2, s * 0.25, 0, Math.PI * 2);
      ctx.stroke();
      break;

    case 'cpu':
      ctx.strokeRect(x - s * 0.5, y - s * 0.5, s, s);
      ctx.beginPath();
      for (let i = -1; i <= 1; i += 2) {
        ctx.moveTo(x + i * s * 0.5, y - s * 0.3);
        ctx.lineTo(x + i * s * 0.7, y - s * 0.3);
        ctx.moveTo(x + i * s * 0.5, y + s * 0.3);
        ctx.lineTo(x + i * s * 0.7, y + s * 0.3);
      }
      ctx.stroke();
      break;

    case 'camera':
      ctx.strokeRect(x - s * 0.7, y - s * 0.4, s * 1.4, s * 0.8);
      ctx.beginPath();
      ctx.arc(x, y, s * 0.25, 0, Math.PI * 2);
      ctx.stroke();
      break;

    case 'printer':
      ctx.strokeRect(x - s * 0.7, y - s * 0.3, s * 1.4, s * 0.6);
      ctx.strokeRect(x - s * 0.5, y - s * 0.7, s, s * 0.4);
      break;

    case 'gamepad-2':
      ctx.beginPath();
      ctx.arc(x - s * 0.4, y, s * 0.35, 0, Math.PI * 2);
      ctx.arc(x + s * 0.4, y, s * 0.35, 0, Math.PI * 2);
      ctx.stroke();
      break;

    case 'wifi':
      ctx.beginPath();
      ctx.arc(x, y + s * 0.3, s * 0.8, -Math.PI * 0.8, -Math.PI * 0.2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x, y + s * 0.3, s * 0.5, -Math.PI * 0.8, -Math.PI * 0.2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x, y + s * 0.3, s * 0.15, 0, Math.PI * 2);
      ctx.fill();
      break;

    case 'router':
      ctx.strokeRect(x - s * 0.8, y - s * 0.3, s * 1.6, s * 0.6);
      ctx.beginPath();
      ctx.moveTo(x - s * 0.4, y - s * 0.3);
      ctx.lineTo(x - s * 0.4, y - s * 0.7);
      ctx.moveTo(x + s * 0.4, y - s * 0.3);
      ctx.lineTo(x + s * 0.4, y - s * 0.7);
      ctx.stroke();
      break;

    case 'server':
      ctx.strokeRect(x - s * 0.6, y - s * 0.8, s * 1.2, s * 0.5);
      ctx.strokeRect(x - s * 0.6, y - s * 0.25, s * 1.2, s * 0.5);
      ctx.strokeRect(x - s * 0.6, y + s * 0.3, s * 1.2, s * 0.5);
      break;

    case 'hard-drive':
      ctx.strokeRect(x - s * 0.8, y - s * 0.4, s * 1.6, s * 0.8);
      ctx.beginPath();
      ctx.arc(x + s * 0.4, y, s * 0.15, 0, Math.PI * 2);
      ctx.stroke();
      break;

    case 'help-circle':
    default:
      ctx.beginPath();
      ctx.arc(x, y, s * 0.7, 0, Math.PI * 2);
      ctx.stroke();
      ctx.font = `bold ${s}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('?', x, y);
      break;
  }

  ctx.restore();
}

// displayMode: 'orgs' | 'ips' | 'hosts'
function buildConnectionData(connections, devices, displayMode = 'orgs', maxDestinations = 30) {
  const deviceMap = new Map();
  const destinationMap = new Map();
  const countryMap = new Map();

  devices.forEach(device => {
    deviceMap.set(device.mac, {
      mac: device.mac,
      hostname: device.hostname || device.mac.substring(0, 8),
      ip: device.ip,
      online: device.online,
      totalBytes: 0,
      connectionCount: 0,
      destinations: new Map(),
      countries: new Map()
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
        destinations: new Map(),
        countries: new Map()
      });
    }

    const device = deviceMap.get(conn.srcMac);
    const org = conn.enriched.org || conn.enriched.asName || conn.enriched.isp;
    const country = conn.enriched.country || 'Unknown';
    const dstIP = conn.dst_ip;
    const dstHostname = conn.enriched.hostname;

    let dstLabel;
    if (displayMode === 'ips') {
      dstLabel = dstIP;
    } else if (displayMode === 'hosts') {
      dstLabel = dstHostname || dstIP;
    } else {
      dstLabel = org || dstIP;
    }

    const bytes = conn.bytes || 0;

    device.totalBytes += bytes;
    device.connectionCount += 1;

    // Track device's countries
    if (!device.countries.has(country)) {
      device.countries.set(country, { code: country, bytes: 0, count: 0 });
    }
    const deviceCountry = device.countries.get(country);
    deviceCountry.bytes += bytes;
    deviceCountry.count += 1;

    // Track device's destinations
    if (!device.destinations.has(dstLabel)) {
      device.destinations.set(dstLabel, { label: dstLabel, country, org, ip: dstIP, hostname: dstHostname, bytes: 0, count: 0 });
    }
    const dest = device.destinations.get(dstLabel);
    dest.bytes += bytes;
    dest.count += 1;

    // Track global destinations
    if (!destinationMap.has(dstLabel)) {
      destinationMap.set(dstLabel, { label: dstLabel, country, org, ip: dstIP, hostname: dstHostname, totalBytes: 0, devices: new Set() });
    }
    const destGlobal = destinationMap.get(dstLabel);
    destGlobal.totalBytes += bytes;
    destGlobal.devices.add(conn.srcMac);

    // Track global countries
    if (!countryMap.has(country)) {
      countryMap.set(country, { code: country, totalBytes: 0, devices: new Set(), destinations: new Set() });
    }
    const countryData = countryMap.get(country);
    countryData.totalBytes += bytes;
    countryData.devices.add(conn.srcMac);
    countryData.destinations.add(dstLabel);
  });

  const deviceList = Array.from(deviceMap.values())
    .map(d => ({
      ...d,
      destinations: Array.from(d.destinations.values()).sort((a, b) => b.bytes - a.bytes),
      countries: Array.from(d.countries.values()).sort((a, b) => b.bytes - a.bytes)
    }))
    .sort((a, b) => b.totalBytes - a.totalBytes);

  const destinationList = Array.from(destinationMap.values())
    .sort((a, b) => b.totalBytes - a.totalBytes)
    .slice(0, maxDestinations);

  const countryList = Array.from(countryMap.values())
    .sort((a, b) => b.totalBytes - a.totalBytes);

  return { devices: deviceList, destinations: destinationList, countries: countryList };
}

function getCountryColor(country) {
  const colors = {
    'US': '#ff6b35', 'DE': '#ffa500', 'GB': '#ffb347', 'NL': '#ffd700',
    'FR': '#ff9500', 'CN': '#ff4500', 'JP': '#ff7f50', 'KR': '#ff6347',
    'AU': '#ffae42', 'CA': '#ff8c00', 'IE': '#32cd32', 'SG': '#ff69b4'
  };
  return colors[country] || '#cc7000';
}

export function ConnectionGraph({ displayMode = 'orgs', maxDestinations = 30 }) {
  const [data, setData] = useState({ devices: [], destinations: [], countries: [] });
  const [selectedMac, setSelectedMac] = useState(null);
  const [selectedCountryCode, setSelectedCountryCode] = useState(null);
  const [selectedDest, setSelectedDest] = useState(null);
  const [hoveredCountry, setHoveredCountry] = useState(null);
  const [hoveredDest, setHoveredDest] = useState(null);
  const [resolver, setResolver] = useState({ total: 0, resolved: 0, pending: 0, inProgress: false });
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const canvasRef = useRef(null);
  const lastStateRef = useRef(null);

  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      if (canvas && canvas.parentElement) {
        const rect = canvas.parentElement.getBoundingClientRect();
        setDimensions({ width: rect.width, height: rect.height });
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const dispose = effect(() => {
      setResolver(resolverState.value);
    });
    return dispose;
  }, []);

  useEffect(() => {
    let lastUpdate = 0;
    const dispose = effect(() => {
      const state = openwrtState.value;
      lastStateRef.current = state;
      const now = Date.now();
      if (now - lastUpdate < 3000) return;
      lastUpdate = now;
      setData(buildConnectionData(state.connections || [], state.devices || [], displayMode, maxDestinations));
    });
    return dispose;
  }, [displayMode, maxDestinations]);

  // Reset destination selection when display mode changes
  useEffect(() => {
    setSelectedDest(null);
  }, [displayMode]);

  const startResolver = () => {
    sendMessage('resolver:start');
  };

  useEffect(() => {
    const dispose = effect(() => setSelectedMac(selectedDeviceMac.value));
    return dispose;
  }, []);

  useEffect(() => {
    const dispose = effect(() => setSelectedCountryCode(selectedCountry.value));
    return dispose;
  }, []);

  useEffect(() => {
    const dispose = effect(() => setSelectedDest(selectedDestination.value));
    return dispose;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

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

    // If no data, just clear the canvas and return
    if (data.devices.length === 0) {
      ctx.clearRect(0, 0, width, height);
      return;
    }

    const centerX = width / 2;
    const centerY = height / 2;
    const minDimension = Math.min(width, height);

    // Skip drawing if container has no size
    if (minDimension < 10) {
      return;
    }

    const innerRadius = minDimension * 0.15;
    const countryRadius = minDimension * 0.35;
    const outerRadius = minDimension * 0.45;

    // Clear
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, width, height);

    // Draw grid circles
    ctx.strokeStyle = 'rgba(255, 140, 0, 0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(centerX, centerY, innerRadius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(centerX, centerY, countryRadius, 0, Math.PI * 2);
    ctx.stroke();
    if (selectedCountryCode) {
      ctx.beginPath();
      ctx.arc(centerX, centerY, outerRadius, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Position countries around country ring
    const countries = data.countries;
    const countryPositions = countries.map((country, i) => {
      const angle = (i / countries.length) * Math.PI * 2 - Math.PI / 2;
      return {
        ...country,
        x: centerX + Math.cos(angle) * countryRadius,
        y: centerY + Math.sin(angle) * countryRadius,
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

    // Position destinations (only when a country is selected)
    // Destinations are positioned in an arc around their parent country's angle
    let destPositions = [];
    if (selectedCountryCode) {
      const selectedCountryPos = countryPositions.find(c => c.code === selectedCountryCode);
      if (selectedCountryPos) {
        const countryDests = data.destinations
          .filter(d => d.country === selectedCountryCode)
          .sort((a, b) => b.totalBytes - a.totalBytes);

        const destCount = countryDests.length;
        const maxSpread = Math.PI * 0.8;
        const spread = Math.min(maxSpread, destCount * 0.15);

        destPositions = countryDests.map((dest, i) => {
          const offsetAngle = destCount === 1
            ? 0
            : (i / (destCount - 1) - 0.5) * spread;
          const angle = selectedCountryPos.angle + offsetAngle;
          return {
            ...dest,
            x: centerX + Math.cos(angle) * outerRadius,
            y: centerY + Math.sin(angle) * outerRadius,
            angle
          };
        });
      }
    }

    // Draw device to country connections
    devicePositions.forEach(device => {
      const isDeviceSelected = selectedMac === device.mac;

      device.countries.forEach(countryData => {
        const countryPos = countryPositions.find(c => c.code === countryData.code);
        if (!countryPos) return;

        const isCountrySelected = selectedCountryCode === countryData.code;
        const isCountryHovered = hoveredCountry === countryData.code;
        const isHighlighted = isDeviceSelected || isCountrySelected || isCountryHovered;

        let alpha;
        if (selectedMac) {
          alpha = isDeviceSelected ? 0.6 : 0.05;
        } else if (selectedCountryCode) {
          alpha = isCountrySelected ? 0.6 : 0.05;
        } else if (hoveredCountry) {
          alpha = isCountryHovered ? 0.6 : 0.05;
        } else {
          alpha = 0.2;
        }

        const lineWidth = isHighlighted ? Math.min(1 + Math.log2(countryData.bytes / 1000 + 1) * 0.5, 4) : 1;

        ctx.beginPath();
        ctx.strokeStyle = isHighlighted ? getCountryColor(countryData.code) : `rgba(255, 140, 0, ${alpha})`;
        ctx.lineWidth = lineWidth;

        // Curved line through center
        ctx.moveTo(device.x, device.y);
        ctx.quadraticCurveTo(centerX, centerY, countryPos.x, countryPos.y);
        ctx.stroke();
      });
    });

    // Draw country to destination connections (only when country is selected)
    if (selectedCountryCode && destPositions.length > 0) {
      const countryPos = countryPositions.find(c => c.code === selectedCountryCode);
      if (countryPos) {
        destPositions.forEach(dest => {
          const isDestSelected = selectedDest === dest.label;
          const isDestHovered = hoveredDest === dest.label;
          const isHighlighted = isDestSelected || isDestHovered;

          const alpha = isHighlighted ? 0.8 : 0.4;
          const lineWidth = isHighlighted ? 2 : 1;

          ctx.beginPath();
          ctx.strokeStyle = isHighlighted ? getCountryColor(dest.country) : `rgba(255, 140, 0, ${alpha})`;
          ctx.lineWidth = lineWidth;
          ctx.moveTo(countryPos.x, countryPos.y);
          ctx.lineTo(dest.x, dest.y);
          ctx.stroke();
        });
      }
    }

    // Draw destination nodes (only when country is selected)
    destPositions.forEach(dest => {
      const isHovered = hoveredDest === dest.label;
      const isSelected = selectedDest === dest.label;

      const alpha = isHovered || isSelected ? 1 : 0.8;
      const baseRadius = 4 + Math.min(Math.log2(dest.totalBytes / 1000 + 1) * 1.5, 6);
      const radius = (isHovered || isSelected) ? 10 : baseRadius;

      ctx.beginPath();
      ctx.arc(dest.x, dest.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = getCountryColor(dest.country);
      ctx.globalAlpha = alpha;
      ctx.fill();
      ctx.globalAlpha = 1;

      if (isSelected) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Label
      ctx.fillStyle = `rgba(255, 140, 0, ${alpha})`;
      ctx.font = (isSelected ? 'bold ' : '') + '10px monospace';
      ctx.textAlign = dest.x > centerX ? 'left' : 'right';
      ctx.textBaseline = 'middle';
      const labelX = dest.x + (dest.x > centerX ? 12 : -12);
      const label = dest.label.length > 18 ? dest.label.substring(0, 16) + '...' : dest.label;
      ctx.fillText(label, labelX, dest.y);
    });

    // Draw country nodes
    countryPositions.forEach(country => {
      const isHovered = hoveredCountry === country.code;
      const isSelected = selectedCountryCode === country.code;
      const hasConnectionToSelectedDevice = selectedMac
        ? devices.find(d => d.mac === selectedMac)?.countries.some(c => c.code === country.code)
        : true;

      let alpha;
      if (selectedMac) {
        alpha = hasConnectionToSelectedDevice ? 1 : 0.2;
      } else if (selectedCountryCode) {
        alpha = isSelected ? 1 : 0.3;
      } else if (hoveredCountry) {
        alpha = isHovered ? 1 : 0.2;
      } else {
        alpha = 0.9;
      }

      const destCount = country.destinations.size;
      const radius = (isHovered || isSelected) ? 14 : 6 + Math.min(Math.log2(destCount + 1) * 3, 10);

      ctx.beginPath();
      ctx.arc(country.x, country.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = getCountryColor(country.code);
      ctx.globalAlpha = alpha;
      ctx.fill();
      ctx.globalAlpha = 1;

      if (isSelected) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Country label
      ctx.fillStyle = `rgba(255, 140, 0, ${alpha})`;
      ctx.font = (isSelected ? 'bold ' : '') + '11px monospace';
      ctx.textAlign = country.x > centerX ? 'left' : 'right';
      ctx.textBaseline = 'middle';
      const labelX = country.x + (country.x > centerX ? radius + 6 : -radius - 6);
      ctx.fillText(country.code, labelX, country.y);
    });

    // Draw device nodes
    devicePositions.forEach(device => {
      const isSelected = selectedMac === device.mac;
      const isConnectedToSelectedCountry = selectedCountryCode && device.countries.some(c => c.code === selectedCountryCode);
      const isHighlighted = isSelected || isConnectedToSelectedCountry;
      const deviceColor = getDeviceColor(device.mac, device.hostname);
      const verified = isDeviceVerified(device.mac, device.hostname);
      const displayName = getDeviceDisplayName(device.mac, device.hostname, device.hostname);

      let alpha = 1;
      if (selectedCountryCode && !isConnectedToSelectedCountry) {
        alpha = 0.3;
      }

      const radius = isHighlighted ? 16 : 12;
      const highlightColor = isHighlighted ? '#fff' : deviceColor;
      const fillColor = device.online ? deviceColor : '#4a4a4a';

      // Draw outer ring for verified devices
      if (verified) {
        ctx.beginPath();
        ctx.arc(device.x, device.y, radius + 3, 0, Math.PI * 2);
        ctx.globalAlpha = alpha * 0.5;
        ctx.strokeStyle = deviceColor;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      // Draw device circle
      ctx.beginPath();
      ctx.arc(device.x, device.y, radius, 0, Math.PI * 2);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = isHighlighted ? fillColor : 'rgba(10, 10, 10, 0.9)';
      ctx.fill();
      ctx.strokeStyle = fillColor;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.globalAlpha = 1;

      // Draw device icon
      const iconName = getDeviceIconName(device.mac, device.hostname);
      drawDeviceIcon(ctx, device.x, device.y, radius * 0.6, iconName, highlightColor, alpha);

      // Label - use custom display name if set
      ctx.globalAlpha = alpha;
      ctx.fillStyle = highlightColor;
      ctx.font = isHighlighted ? 'bold 11px monospace' : '10px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(displayName, device.x, device.y + radius + 6);
      ctx.globalAlpha = 1;
    });

    // Store positions for click detection
    canvas._devicePositions = devicePositions;
    canvas._countryPositions = countryPositions;
    canvas._destPositions = destPositions;

  }, [data, selectedMac, selectedCountryCode, selectedDest, hoveredCountry, hoveredDest, dimensions]);

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
        setSelectedCountryCode(null);
        selectedCountry.value = null;
        setSelectedDest(null);
        selectedDestination.value = null;
        return;
      }
    }

    // Check country clicks
    for (const country of canvas._countryPositions || []) {
      const dx = x - country.x;
      const dy = y - country.y;
      if (dx * dx + dy * dy < 200) {
        const newCountry = selectedCountryCode === country.code ? null : country.code;
        setSelectedCountryCode(newCountry);
        selectedCountry.value = newCountry;
        setSelectedMac(null);
        selectedDeviceMac.value = null;
        setSelectedDest(null);
        selectedDestination.value = null;
        return;
      }
    }

    // Check destination clicks (only when country is selected)
    for (const dest of canvas._destPositions || []) {
      const dx = x - dest.x;
      const dy = y - dest.y;
      if (dx * dx + dy * dy < 200) {
        const newDest = selectedDest === dest.label ? null : dest.label;
        setSelectedDest(newDest);
        selectedDestination.value = newDest;
        setSelectedMac(null);
        selectedDeviceMac.value = null;
        return;
      }
    }

    // Click on empty space clears selection
    setSelectedMac(null);
    setSelectedCountryCode(null);
    setSelectedDest(null);
    selectedDeviceMac.value = null;
    selectedCountry.value = null;
    selectedDestination.value = null;
  };

  const handleCanvasMove = (e) => {
    const canvas = canvasRef.current;
    if (!canvas._countryPositions) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Check country hover
    for (const country of canvas._countryPositions) {
      const dx = x - country.x;
      const dy = y - country.y;
      if (dx * dx + dy * dy < 200) {
        if (hoveredCountry !== country.code) {
          setHoveredCountry(country.code);
          setHoveredDest(null);
        }
        return;
      }
    }

    // Check destination hover (when country is selected)
    for (const dest of canvas._destPositions || []) {
      const dx = x - dest.x;
      const dy = y - dest.y;
      if (dx * dx + dy * dy < 200) {
        if (hoveredDest !== dest.label) {
          setHoveredDest(dest.label);
          setHoveredCountry(null);
        }
        return;
      }
    }

    if (hoveredCountry) setHoveredCountry(null);
    if (hoveredDest) setHoveredDest(null);
  };

  const hasData = data.devices.length > 0;

  return html`
    <div class="radial-graph-container">
      <div class="radial-canvas-wrapper">
        <canvas
          ref=${canvasRef}
          onClick=${handleCanvasClick}
          onMouseMove=${handleCanvasMove}
          onMouseLeave=${() => { setHoveredDest(null); setHoveredCountry(null); }}
        />
        ${displayMode === 'hosts' && html`
          <div class="radial-toggle">
            <button
              class="toggle-btn resolver-btn ${resolver.inProgress ? 'resolving' : ''}"
              onClick=${startResolver}
              disabled=${resolver.inProgress}
            >
              ${resolver.inProgress
                ? `Resolving ${resolver.resolved}/${resolver.total}`
                : 'Resolve'}
            </button>
          </div>
        `}
        ${!hasData && html`
          <div class="radial-loading">
            <div class="loading-orbits">
              <div class="orbit orbit-1"></div>
              <div class="orbit orbit-2"></div>
              <div class="orbit orbit-3"></div>
              <div class="node node-center"></div>
              <div class="node node-1"></div>
              <div class="node node-2"></div>
              <div class="node node-3"></div>
            </div>
            <span class="loading-text">Scanning network...</span>
          </div>
        `}
      </div>

    </div>
  `;
}
