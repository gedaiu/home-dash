import { getDeviceColor, getDeviceDisplayName, isDeviceVerified } from '../../state.js';
import { FULL_TURN, HALF } from './geometry-constants.js';
import { OUTLINE_COLOR, OUTLINE_WIDTH } from './draw-style.js';
import { drawDeviceIcon, getDeviceIconName } from './device-icons.js';

const DEVICE_RADIUS = 12;
const HIGHLIGHTED_DEVICE_RADIUS = 14;
const GATEWAY_HALO_GAP = 4;
const GATEWAY_HALO_ALPHA = 0.3;
const GATEWAY_HALO_COLOR = '#ff8c00';
const GATEWAY_DASH_LENGTH = 3;
const VERIFIED_RING_GAP = 3;
const VERIFIED_RING_ALPHA = 0.5;
const OFFLINE_FILL_COLOR = '#4a4a4a';
const IDLE_BODY_FILL = 'rgba(10, 10, 10, 0.9)';
const DIMMED_BY_COUNTRY_ALPHA = 0.3;
const WITHOUT_CONNECTIONS_ALPHA = 0.5;
const ICON_SIZE_RATIO = 0.6;
const LABEL_MAX_LENGTH = 10;
const LABEL_RADIUS_GAP = 6;
const LABEL_CHAR_WIDTH = 6;
const LABEL_FONT = '8px monospace';
const LABEL_FONT_HIGHLIGHTED = 'bold 9px monospace';
const RIGHT_SIDE = { direction: 1, baseAngle: 0, baseline: 'bottom', radiusSign: -1 };
const LEFT_SIDE = { direction: -1, baseAngle: Math.PI, baseline: 'top', radiusSign: 1 };

export function drawDeviceNodes(ctx, scene) {
  const { devices } = scene.positions;

  devices.forEach(device => drawDeviceNode(ctx, scene, device));
}

function drawDeviceNode(ctx, scene, device) {
  const look = deviceLook(device, scene.focus);

  if (device.isGatewayNode) {
    drawGatewayHalo(ctx, device, look);
  }

  if (isDeviceVerified(device.mac, device.hostname)) {
    drawVerifiedRing(ctx, device, look);
  }

  drawDeviceBody(ctx, device, look);

  drawDeviceIcon(ctx, {
    originX: device.posX,
    originY: device.posY,
    size: look.radius * ICON_SIZE_RATIO,
    iconName: getDeviceIconName(device.mac, device.hostname),
    color: look.highlightColor,
    alpha: look.alpha
  });

  drawCurvedLabel(ctx, device, { centerX: scene.layout.centerX, look });
}

function deviceLook(device, focus) {
  const { selectedMac, selectedCountryCode } = focus;
  const isSelected = selectedMac === device.mac;
  const isConnectedToSelectedCountry = selectedCountryCode && device.countries.some(countryData => countryData.code === selectedCountryCode);
  const isHighlighted = isSelected || isConnectedToSelectedCountry;
  const deviceColor = getDeviceColor(device.mac, device.hostname);

  return {
    isHighlighted,
    alpha: deviceAlpha(device, { isSelected, isConnectedToSelectedCountry, selectedCountryCode }),
    radius: isHighlighted ? HIGHLIGHTED_DEVICE_RADIUS : DEVICE_RADIUS,
    deviceColor,
    highlightColor: isHighlighted ? OUTLINE_COLOR : deviceColor,
    fillColor: device.online ? deviceColor : OFFLINE_FILL_COLOR,
    displayName: getDeviceDisplayName(device.mac, device.hostname, device.hostname)
  };
}

function deviceAlpha(device, { isSelected, isConnectedToSelectedCountry, selectedCountryCode }) {
  if (selectedCountryCode && !isConnectedToSelectedCountry) return DIMMED_BY_COUNTRY_ALPHA;

  const hasConnections = device.connectionCount > 0;
  if (!hasConnections && !isSelected) return WITHOUT_CONNECTIONS_ALPHA;

  return 1;
}

function drawGatewayHalo(ctx, device, look) {
  ctx.beginPath();
  ctx.arc(device.posX, device.posY, look.radius + GATEWAY_HALO_GAP, 0, FULL_TURN);
  ctx.globalAlpha = look.alpha * GATEWAY_HALO_ALPHA;
  ctx.strokeStyle = GATEWAY_HALO_COLOR;
  ctx.lineWidth = OUTLINE_WIDTH;
  ctx.setLineDash([GATEWAY_DASH_LENGTH, GATEWAY_DASH_LENGTH]);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;
}

function drawVerifiedRing(ctx, device, look) {
  ctx.beginPath();
  ctx.arc(device.posX, device.posY, look.radius + VERIFIED_RING_GAP, 0, FULL_TURN);
  ctx.globalAlpha = look.alpha * VERIFIED_RING_ALPHA;
  ctx.strokeStyle = look.deviceColor;
  ctx.lineWidth = OUTLINE_WIDTH;
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function drawDeviceBody(ctx, device, look) {
  ctx.beginPath();
  ctx.arc(device.posX, device.posY, look.radius, 0, FULL_TURN);
  ctx.globalAlpha = look.alpha;
  ctx.fillStyle = look.isHighlighted ? look.fillColor : IDLE_BODY_FILL;
  ctx.fill();
  ctx.strokeStyle = look.fillColor;
  ctx.lineWidth = OUTLINE_WIDTH;
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function drawCurvedLabel(ctx, device, { centerX, look }) {
  const text = truncateDeviceName(look.displayName);
  const labelRadius = look.radius + LABEL_RADIUS_GAP;
  const arcAngle = (text.length * LABEL_CHAR_WIDTH) / labelRadius;
  const side = device.posX >= centerX ? RIGHT_SIDE : LEFT_SIDE;
  const placement = {
    side,
    labelRadius,
    startAngle: side.baseAngle - side.direction * arcAngle / 2,
    step: arcAngle / text.length
  };

  ctx.globalAlpha = look.alpha;
  ctx.fillStyle = look.highlightColor;
  ctx.font = look.isHighlighted ? LABEL_FONT_HIGHLIGHTED : LABEL_FONT;
  ctx.save();
  ctx.translate(device.posX, device.posY);

  for (let i = 0; i < text.length; i++) {
    drawLabelCharacter(ctx, { character: text[i], index: i }, placement);
  }

  ctx.restore();
  ctx.globalAlpha = 1;
}

function truncateDeviceName(displayName) {
  if (displayName.length <= LABEL_MAX_LENGTH) return displayName;

  return displayName.substring(0, LABEL_MAX_LENGTH - 1) + '…';
}

function drawLabelCharacter(ctx, glyph, placement) {
  const { side, labelRadius, startAngle, step } = placement;
  const charAngle = startAngle + side.direction * ((glyph.index + HALF) * step);

  ctx.save();
  ctx.rotate(charAngle);
  ctx.textAlign = 'center';
  ctx.textBaseline = side.baseline;
  ctx.fillText(glyph.character, 0, side.radiusSign * labelRadius);
  ctx.restore();
}
