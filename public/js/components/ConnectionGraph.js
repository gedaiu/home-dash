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

// ============================================================================
// Icon Drawing
// ============================================================================

function getDeviceIconName(mac, hostname) {
  const custom = findDeviceCustomization(mac, hostname);
  const typeId = custom?.type || 'unknown';
  const deviceType = DEVICE_TYPES.find(t => t.id === typeId);
  return deviceType?.icon || 'help-circle';
}

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

// ============================================================================
// Utility Functions
// ============================================================================

function getSubnet(ip) {
  if (!ip) return null;
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  return `${parts[0]}.${parts[1]}.${parts[2]}`;
}

function isGatewayIP(ip) {
  if (!ip) return false;
  return ip.endsWith('.1');
}

function getCountryColor(country) {
  const colors = {
    'US': '#ff6b35', 'DE': '#ffa500', 'GB': '#ffb347', 'NL': '#ffd700',
    'FR': '#ff9500', 'CN': '#ff4500', 'JP': '#ff7f50', 'KR': '#ff6347',
    'AU': '#ffae42', 'CA': '#ff8c00', 'IE': '#32cd32', 'SG': '#ff69b4'
  };
  return colors[country] || '#cc7000';
}

// ============================================================================
// Data Building
// ============================================================================

function buildConnectionData(connections, devices, displayMode = 'orgs', showIdleDevices = true) {
  const deviceMap = new Map();
  const destinationMap = new Map();
  const countryMap = new Map();

  devices.forEach(device => {
    const subnet = getSubnet(device.ip);
    const isGateway = isGatewayIP(device.ip);
    deviceMap.set(device.mac, {
      mac: device.mac,
      hostname: device.hostname || device.mac.substring(0, 8),
      ip: device.ip,
      subnet,
      isGateway,
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
      const subnet = getSubnet(conn.src_ip);
      const isGateway = isGatewayIP(conn.src_ip);
      deviceMap.set(conn.srcMac, {
        mac: conn.srcMac,
        hostname: conn.srcHostname || conn.srcMac.substring(0, 8),
        ip: conn.src_ip,
        subnet,
        isGateway,
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

    if (!device.countries.has(country)) {
      device.countries.set(country, { code: country, bytes: 0, count: 0 });
    }
    const deviceCountry = device.countries.get(country);
    deviceCountry.bytes += bytes;
    deviceCountry.count += 1;

    if (!device.destinations.has(dstLabel)) {
      device.destinations.set(dstLabel, { label: dstLabel, country, org, ip: dstIP, hostname: dstHostname, bytes: 0, count: 0 });
    }
    const dest = device.destinations.get(dstLabel);
    dest.bytes += bytes;
    dest.count += 1;

    if (!destinationMap.has(dstLabel)) {
      destinationMap.set(dstLabel, { label: dstLabel, country, org, ip: dstIP, hostname: dstHostname, totalBytes: 0, devices: new Set() });
    }
    const destGlobal = destinationMap.get(dstLabel);
    destGlobal.totalBytes += bytes;
    destGlobal.devices.add(conn.srcMac);

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
    .filter(d => showIdleDevices || d.connectionCount > 0)
    .sort((a, b) => b.totalBytes - a.totalBytes);

  const destinationList = Array.from(destinationMap.values())
    .sort((a, b) => b.totalBytes - a.totalBytes);

  const countryList = Array.from(countryMap.values())
    .sort((a, b) => b.totalBytes - a.totalBytes);

  return {
    devices: deviceList,
    destinations: destinationList,
    countries: countryList,
    subnets: buildSubnetRings(deviceList)
  };
}

function buildSubnetRings(deviceList) {
  const subnetMap = new Map();
  deviceList.forEach(device => {
    const subnet = device.subnet || 'unknown';
    if (!subnetMap.has(subnet)) {
      subnetMap.set(subnet, []);
    }
    subnetMap.get(subnet).push(device);
  });

  const sortedSubnets = Array.from(subnetMap.entries())
    .map(([subnet, devices]) => ({
      subnet,
      devices,
      totalBytes: devices.reduce((sum, d) => sum + d.totalBytes, 0),
      hasGateway: devices.some(d => d.isGateway)
    }))
    .sort((a, b) => b.devices.length - a.devices.length);

  const maxDevicesPerRing = 8;
  const rings = [];

  sortedSubnets.forEach(subnetData => {
    const gatewayDevices = subnetData.devices.filter(d => d.isGateway);
    const regularDevices = subnetData.devices.filter(d => !d.isGateway);

    if (regularDevices.length <= maxDevicesPerRing) {
      rings.push({
        subnet: subnetData.subnet,
        devices: subnetData.devices,
        totalBytes: subnetData.totalBytes,
        hasGateway: subnetData.hasGateway,
        isFirstRingOfSubnet: true,
        isLastRingOfSubnet: true
      });
    } else {
      const numRings = Math.ceil(regularDevices.length / maxDevicesPerRing);
      for (let i = 0; i < numRings; i++) {
        const startIdx = i * maxDevicesPerRing;
        const endIdx = Math.min(startIdx + maxDevicesPerRing, regularDevices.length);
        const ringDevices = regularDevices.slice(startIdx, endIdx);
        const isLastRing = i === numRings - 1;

        if (isLastRing) {
          ringDevices.push(...gatewayDevices);
        }

        rings.push({
          subnet: subnetData.subnet,
          devices: ringDevices,
          totalBytes: ringDevices.reduce((sum, d) => sum + d.totalBytes, 0),
          hasGateway: isLastRing && gatewayDevices.length > 0,
          isFirstRingOfSubnet: i === 0,
          isLastRingOfSubnet: isLastRing
        });
      }
    }
  });

  return rings;
}

// ============================================================================
// Position Calculation
// ============================================================================

function calculateRingRadii(subnets, minDimension, countryRadius) {
  const minDeviceSpacing = 55;
  const subnetGap = 60;
  const splitRingGap = 45;
  const gatewayGap = 40;

  const subnetRadii = subnets.map((subnetData) => {
    const deviceCount = subnetData.devices.filter(d => !d.isGateway).length;
    const minRadius = Math.max(80, (deviceCount * minDeviceSpacing) / (2 * Math.PI));
    return minRadius;
  });

  let currentRadius = Math.max(subnetRadii[0] || 90, minDimension * 0.15);
  const ringRadii = [currentRadius];

  for (let i = 1; i < subnets.length; i++) {
    const prevRing = subnets[i - 1];
    const currentRing = subnets[i];
    const isSameSubnet = prevRing?.subnet === currentRing?.subnet;

    const gap = isSameSubnet ? splitRingGap : subnetGap;
    const extraGap = isSameSubnet ? 0 : gatewayGap;

    currentRadius += gap + extraGap;
    currentRadius = Math.max(currentRadius, subnetRadii[i] || 50);
    ringRadii.push(currentRadius);
  }

  const maxDeviceRadius = countryRadius - 50;
  const scaleFactor = currentRadius > maxDeviceRadius ? maxDeviceRadius / currentRadius : 1;

  return { ringRadii, scaleFactor };
}

function positionCountries(countries, centerX, centerY, countryRadius) {
  return countries.map((country, i) => {
    const angle = (i / countries.length) * Math.PI * 2 - Math.PI / 2;
    return {
      ...country,
      x: centerX + Math.cos(angle) * countryRadius,
      y: centerY + Math.sin(angle) * countryRadius,
      angle
    };
  });
}

function positionDevices(subnets, ringRadii, scaleFactor, centerX, centerY) {
  const devicePositions = [];

  subnets.forEach((subnetData, subnetIndex) => {
    const radius = ringRadii[subnetIndex] * scaleFactor;
    const gatewayDevices = subnetData.devices.filter(d => d.isGateway);
    const regularDevices = subnetData.devices.filter(d => !d.isGateway);

    const deviceCount = regularDevices.length;
    const ringOffset = (subnetIndex * Math.PI * 0.4);

    regularDevices.forEach((device, i) => {
      const gapAngle = gatewayDevices.length > 0 ? 0.3 : 0;
      const availableAngle = Math.PI * 2 - gapAngle;
      const baseStartAngle = -Math.PI / 2 + gapAngle / 2;
      const startAngle = baseStartAngle + ringOffset;
      const angle = startAngle + (i / Math.max(1, deviceCount)) * availableAngle;

      devicePositions.push({
        ...device,
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius,
        angle,
        subnetIndex
      });
    });

    const gatewayRadius = radius;

    gatewayDevices.forEach((device, i) => {
      const angle = -Math.PI / 2 + (i - (gatewayDevices.length - 1) / 2) * 0.25;
      devicePositions.push({
        ...device,
        x: centerX + Math.cos(angle) * gatewayRadius,
        y: centerY + Math.sin(angle) * gatewayRadius,
        angle,
        subnetIndex,
        isGatewayNode: true
      });
    });
  });

  return devicePositions;
}

function positionDestinations(destinations, selectedCountryCode, countryPositions, centerX, centerY, outerRadius) {
  if (!selectedCountryCode) return [];

  const selectedCountryPos = countryPositions.find(c => c.code === selectedCountryCode);
  if (!selectedCountryPos) return [];

  const countryDests = destinations
    .filter(d => d.country === selectedCountryCode)
    .sort((a, b) => b.totalBytes - a.totalBytes);

  const destCount = countryDests.length;
  const maxSpread = Math.PI * 0.8;
  const spread = Math.min(maxSpread, destCount * 0.15);

  return countryDests.map((dest, i) => {
    const offsetAngle = destCount === 1 ? 0 : (i / (destCount - 1) - 0.5) * spread;
    const angle = selectedCountryPos.angle + offsetAngle;
    return {
      ...dest,
      x: centerX + Math.cos(angle) * outerRadius,
      y: centerY + Math.sin(angle) * outerRadius,
      angle
    };
  });
}

// ============================================================================
// Drawing Functions
// ============================================================================

function drawGridRings(ctx, ringRadii, scaleFactor, centerX, centerY, countryRadius, selectedCountryCode, outerRadius) {
  ctx.strokeStyle = 'rgba(255, 140, 0, 0.1)';
  ctx.lineWidth = 1;

  for (let i = 0; i < ringRadii.length; i++) {
    const radius = ringRadii[i] * scaleFactor;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.beginPath();
  ctx.arc(centerX, centerY, countryRadius, 0, Math.PI * 2);
  ctx.stroke();

  if (selectedCountryCode) {
    ctx.beginPath();
    ctx.arc(centerX, centerY, outerRadius, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawDeviceConnections(ctx, devicePositions, countryPositions, centerX, centerY, selectedMac, selectedCountryCode, hoveredCountry) {
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
      ctx.moveTo(device.x, device.y);
      ctx.quadraticCurveTo(centerX, centerY, countryPos.x, countryPos.y);
      ctx.stroke();
    });
  });
}

function drawDestinationConnections(ctx, selectedCountryCode, countryPositions, destPositions, selectedDest, hoveredDest) {
  if (!selectedCountryCode || destPositions.length === 0) return;

  const countryPos = countryPositions.find(c => c.code === selectedCountryCode);
  if (!countryPos) return;

  destPositions.forEach(dest => {
    const isHighlighted = selectedDest === dest.label || hoveredDest === dest.label;
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

function drawDestinationNodes(ctx, destPositions, centerX, hoveredDest, selectedDest) {
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

    ctx.fillStyle = `rgba(255, 140, 0, ${alpha})`;
    ctx.font = (isSelected ? 'bold ' : '') + '10px monospace';
    ctx.textAlign = dest.x > centerX ? 'left' : 'right';
    ctx.textBaseline = 'middle';
    const labelX = dest.x + (dest.x > centerX ? 12 : -12);
    const label = dest.label.length > 18 ? dest.label.substring(0, 16) + '...' : dest.label;
    ctx.fillText(label, labelX, dest.y);
  });
}

function drawCountryNodes(ctx, countryPositions, devicePositions, centerX, selectedMac, selectedCountryCode, hoveredCountry) {
  countryPositions.forEach(country => {
    const isHovered = hoveredCountry === country.code;
    const isSelected = selectedCountryCode === country.code;
    const hasConnectionToSelectedDevice = selectedMac
      ? devicePositions.find(d => d.mac === selectedMac)?.countries.some(c => c.code === country.code)
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

    ctx.fillStyle = `rgba(255, 140, 0, ${alpha})`;
    ctx.font = (isSelected ? 'bold ' : '') + '11px monospace';
    ctx.textAlign = country.x > centerX ? 'left' : 'right';
    ctx.textBaseline = 'middle';
    const labelX = country.x + (country.x > centerX ? radius + 6 : -radius - 6);
    ctx.fillText(country.code, labelX, country.y);
  });
}

function drawCurvedLabel(ctx, device, centerX, displayName, highlightColor, alpha, deviceRadius, isHighlighted) {
  ctx.globalAlpha = alpha;
  ctx.fillStyle = highlightColor;
  ctx.font = isHighlighted ? 'bold 9px monospace' : '8px monospace';

  const maxLabelLength = 10;
  const truncatedName = displayName.length > maxLabelLength
    ? displayName.substring(0, maxLabelLength - 1) + '…'
    : displayName;

  const labelRadius = deviceRadius + 6;
  const charWidth = 6;
  const totalArcLength = truncatedName.length * charWidth;
  const arcAngle = totalArcLength / labelRadius;
  const isOnRightSide = device.x >= centerX;

  ctx.save();
  ctx.translate(device.x, device.y);

  if (isOnRightSide) {
    const startAngle = -arcAngle / 2;
    for (let i = 0; i < truncatedName.length; i++) {
      const charAngle = startAngle + (i + 0.5) * (arcAngle / truncatedName.length);
      ctx.save();
      ctx.rotate(charAngle);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(truncatedName[i], 0, -labelRadius);
      ctx.restore();
    }
  } else {
    const startAngle = Math.PI + arcAngle / 2;
    for (let i = 0; i < truncatedName.length; i++) {
      const charAngle = startAngle - (i + 0.5) * (arcAngle / truncatedName.length);
      ctx.save();
      ctx.rotate(charAngle);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(truncatedName[i], 0, labelRadius);
      ctx.restore();
    }
  }

  ctx.restore();
  ctx.globalAlpha = 1;
}

function drawDeviceNode(ctx, device, centerX, selectedMac, selectedCountryCode) {
  const isSelected = selectedMac === device.mac;
  const isConnectedToSelectedCountry = selectedCountryCode && device.countries.some(c => c.code === selectedCountryCode);
  const isHighlighted = isSelected || isConnectedToSelectedCountry;
  const deviceColor = getDeviceColor(device.mac, device.hostname);
  const verified = isDeviceVerified(device.mac, device.hostname);
  const displayName = getDeviceDisplayName(device.mac, device.hostname, device.hostname);
  const hasConnections = device.connectionCount > 0;

  let alpha = 1;
  if (selectedCountryCode && !isConnectedToSelectedCountry) {
    alpha = 0.3;
  } else if (!hasConnections && !isSelected) {
    alpha = 0.5;
  }

  const radius = isHighlighted ? 14 : 12;
  const highlightColor = isHighlighted ? '#fff' : deviceColor;
  const fillColor = device.online ? deviceColor : '#4a4a4a';

  if (device.isGatewayNode) {
    ctx.beginPath();
    ctx.arc(device.x, device.y, radius + 4, 0, Math.PI * 2);
    ctx.globalAlpha = alpha * 0.3;
    ctx.strokeStyle = '#ff8c00';
    ctx.lineWidth = 2;
    ctx.setLineDash([3, 3]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  }

  if (verified) {
    ctx.beginPath();
    ctx.arc(device.x, device.y, radius + 3, 0, Math.PI * 2);
    ctx.globalAlpha = alpha * 0.5;
    ctx.strokeStyle = deviceColor;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  ctx.beginPath();
  ctx.arc(device.x, device.y, radius, 0, Math.PI * 2);
  ctx.globalAlpha = alpha;
  ctx.fillStyle = isHighlighted ? fillColor : 'rgba(10, 10, 10, 0.9)';
  ctx.fill();
  ctx.strokeStyle = fillColor;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.globalAlpha = 1;

  const iconName = getDeviceIconName(device.mac, device.hostname);
  drawDeviceIcon(ctx, device.x, device.y, radius * 0.6, iconName, highlightColor, alpha);

  drawCurvedLabel(ctx, device, centerX, displayName, highlightColor, alpha, radius, isHighlighted);
}

function drawDeviceNodes(ctx, devicePositions, centerX, selectedMac, selectedCountryCode) {
  devicePositions.forEach(device => {
    drawDeviceNode(ctx, device, centerX, selectedMac, selectedCountryCode);
  });
}

// ============================================================================
// Hit Testing
// ============================================================================

function findHitTarget(x, y, positions, threshold = 200) {
  for (const item of positions) {
    const dx = x - item.x;
    const dy = y - item.y;
    if (dx * dx + dy * dy < threshold) {
      return item;
    }
  }
  return null;
}

// ============================================================================
// Main Component
// ============================================================================

export function ConnectionGraph({ displayMode = 'orgs', showIdleDevices = true }) {
  const [data, setData] = useState({ devices: [], destinations: [], countries: [], subnets: [] });
  const [selectedMac, setSelectedMac] = useState(null);
  const [selectedCountryCode, setSelectedCountryCode] = useState(null);
  const [selectedDest, setSelectedDest] = useState(null);
  const [hoveredCountry, setHoveredCountry] = useState(null);
  const [hoveredDest, setHoveredDest] = useState(null);
  const [hoveredDevice, setHoveredDevice] = useState(null);
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
    const dispose = effect(() => setResolver(resolverState.value));
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
      setData(buildConnectionData(state.connections || [], state.devices || [], displayMode, showIdleDevices));
    });
    return dispose;
  }, [displayMode, showIdleDevices]);

  useEffect(() => {
    setSelectedDest(null);
  }, [displayMode]);

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

    if (data.devices.length === 0) {
      ctx.clearRect(0, 0, width, height);
      return;
    }

    const centerX = width / 2;
    const centerY = height / 2;
    const minDimension = Math.min(width, height);

    if (minDimension < 10) return;

    const countryRadius = minDimension * 0.40;
    const outerRadius = minDimension * 0.48;
    const subnets = data.subnets || [];

    const { ringRadii, scaleFactor } = calculateRingRadii(subnets, minDimension, countryRadius);

    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, width, height);

    drawGridRings(ctx, ringRadii, scaleFactor, centerX, centerY, countryRadius, selectedCountryCode, outerRadius);

    const countryPositions = positionCountries(data.countries, centerX, centerY, countryRadius);
    const devicePositions = positionDevices(subnets, ringRadii, scaleFactor, centerX, centerY);
    const destPositions = positionDestinations(data.destinations, selectedCountryCode, countryPositions, centerX, centerY, outerRadius);

    drawDeviceConnections(ctx, devicePositions, countryPositions, centerX, centerY, selectedMac, selectedCountryCode, hoveredCountry);
    drawDestinationConnections(ctx, selectedCountryCode, countryPositions, destPositions, selectedDest, hoveredDest);
    drawDestinationNodes(ctx, destPositions, centerX, hoveredDest, selectedDest);
    drawCountryNodes(ctx, countryPositions, devicePositions, centerX, selectedMac, selectedCountryCode, hoveredCountry);
    drawDeviceNodes(ctx, devicePositions, centerX, selectedMac, selectedCountryCode);

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

    const device = findHitTarget(x, y, canvas._devicePositions);
    if (device) {
      const newMac = selectedMac === device.mac ? null : device.mac;
      setSelectedMac(newMac);
      selectedDeviceMac.value = newMac;
      setSelectedCountryCode(null);
      selectedCountry.value = null;
      setSelectedDest(null);
      selectedDestination.value = null;
      return;
    }

    const country = findHitTarget(x, y, canvas._countryPositions || []);
    if (country) {
      const newCountry = selectedCountryCode === country.code ? null : country.code;
      setSelectedCountryCode(newCountry);
      selectedCountry.value = newCountry;
      setSelectedMac(null);
      selectedDeviceMac.value = null;
      setSelectedDest(null);
      selectedDestination.value = null;
      return;
    }

    const dest = findHitTarget(x, y, canvas._destPositions || []);
    if (dest) {
      const newDest = selectedDest === dest.label ? null : dest.label;
      setSelectedDest(newDest);
      selectedDestination.value = newDest;
      setSelectedMac(null);
      selectedDeviceMac.value = null;
      return;
    }

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

    const device = findHitTarget(x, y, canvas._devicePositions || []);
    if (device) {
      const displayName = getDeviceDisplayName(device.mac, device.hostname, device.hostname);
      if (!hoveredDevice || hoveredDevice.mac !== device.mac) {
        setHoveredDevice({ mac: device.mac, name: displayName, x: e.clientX, y: e.clientY });
        setHoveredCountry(null);
        setHoveredDest(null);
      }
      return;
    }

    const country = findHitTarget(x, y, canvas._countryPositions);
    if (country) {
      if (hoveredCountry !== country.code) {
        setHoveredCountry(country.code);
        setHoveredDest(null);
        setHoveredDevice(null);
      }
      return;
    }

    const dest = findHitTarget(x, y, canvas._destPositions || []);
    if (dest) {
      if (hoveredDest !== dest.label) {
        setHoveredDest(dest.label);
        setHoveredCountry(null);
        setHoveredDevice(null);
      }
      return;
    }

    if (hoveredCountry) setHoveredCountry(null);
    if (hoveredDest) setHoveredDest(null);
    if (hoveredDevice) setHoveredDevice(null);
  };

  const startResolver = () => {
    sendMessage('resolver:start');
  };

  const hasData = data.devices.length > 0;

  return html`
    <div class="radial-graph-container">
      <div class="radial-canvas-wrapper">
        <canvas
          ref=${canvasRef}
          onClick=${handleCanvasClick}
          onMouseMove=${handleCanvasMove}
          onMouseLeave=${() => { setHoveredDest(null); setHoveredCountry(null); setHoveredDevice(null); }}
        />
        <div class="radial-toggle">
          <button
            class="toggle-btn resolver-btn ${resolver.inProgress ? 'resolving' : ''}"
            onClick=${startResolver}
            disabled=${resolver.inProgress}
          >
            ${resolver.inProgress
              ? `Resolving ${resolver.resolved}/${resolver.total}`
              : 'Resolve Hosts'}
          </button>
        </div>
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
        ${hoveredDevice && html`
          <div
            class="device-tooltip"
            style="left: ${hoveredDevice.x + 10}px; top: ${hoveredDevice.y - 30}px;"
          >
            ${hoveredDevice.name}
          </div>
        `}
      </div>
    </div>
  `;
}
