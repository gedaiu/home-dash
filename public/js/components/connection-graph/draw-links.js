import { getCountryColor } from '../network/country-colors.js';
import { accentColor, emphasisAlpha, logScale, strokeRing } from './draw-style.js';

const GRID_ALPHA = 0.1;
const STRONG_LINK_ALPHA = 0.6;
const FAINT_LINK_ALPHA = 0.05;
const IDLE_LINK_ALPHA = 0.2;
const MAX_HIGHLIGHT_WIDTH = 4;
const HIGHLIGHT_WIDTH_GROWTH = 0.5;
const DESTINATION_ALPHA = 0.4;
const DESTINATION_HIGHLIGHT_WIDTH = 2;

export function drawGridRings(ctx, scene) {
  const { layout, focus } = scene;

  ctx.strokeStyle = accentColor(GRID_ALPHA);
  ctx.lineWidth = 1;

  layout.ringRadii.forEach(ringRadius => strokeRing(ctx, layout, ringRadius * layout.scaleFactor));
  strokeRing(ctx, layout, layout.countryRadius);

  if (focus.selectedCountryCode) {
    strokeRing(ctx, layout, layout.outerRadius);
  }
}

export function drawDeviceConnections(ctx, scene) {
  const { devices, countries } = scene.positions;
  const links = devices.flatMap(device => device.countries.map(countryData => ({
    device,
    countryData,
    countryPos: countries.find(country => country.code === countryData.code)
  })));

  links
    .filter(link => link.countryPos)
    .forEach(link => drawDeviceLink(ctx, scene, link));
}

export function drawDestinationConnections(ctx, scene) {
  const { selectedCountryCode, selectedDest, hoveredDest } = scene.focus;
  const { countries, destinations: destPositions } = scene.positions;

  if (!selectedCountryCode || destPositions.length === 0) return;

  const countryPos = countries.find(country => country.code === selectedCountryCode);
  if (!countryPos) return;

  destPositions.forEach(dest => {
    const isHighlighted = selectedDest === dest.label || hoveredDest === dest.label;

    ctx.beginPath();
    ctx.strokeStyle = isHighlighted ? getCountryColor(dest.country) : accentColor(DESTINATION_ALPHA);
    ctx.lineWidth = isHighlighted ? DESTINATION_HIGHLIGHT_WIDTH : 1;
    ctx.moveTo(countryPos.posX, countryPos.posY);
    ctx.lineTo(dest.posX, dest.posY);
    ctx.stroke();
  });
}

function drawDeviceLink(ctx, scene, link) {
  const { device, countryData, countryPos } = link;
  const { layout, focus } = scene;
  const isDeviceSelected = focus.selectedMac === device.mac;
  const isCountrySelected = focus.selectedCountryCode === countryData.code;
  const isCountryHovered = focus.hoveredCountry === countryData.code;
  const isHighlighted = isDeviceSelected || isCountrySelected || isCountryHovered;
  const alpha = emphasisAlpha([
    linkRule(focus.selectedMac, isDeviceSelected),
    linkRule(focus.selectedCountryCode, isCountrySelected),
    linkRule(focus.hoveredCountry, isCountryHovered)
  ], IDLE_LINK_ALPHA);

  ctx.beginPath();
  ctx.strokeStyle = isHighlighted ? getCountryColor(countryData.code) : accentColor(alpha);
  ctx.lineWidth = isHighlighted ? highlightedLinkWidth(countryData.bytes) : 1;
  ctx.moveTo(device.posX, device.posY);
  ctx.quadraticCurveTo(layout.centerX, layout.centerY, countryPos.posX, countryPos.posY);
  ctx.stroke();
}

function linkRule(isActive, isMatch) {
  return { isActive, isMatch, matchAlpha: STRONG_LINK_ALPHA, otherAlpha: FAINT_LINK_ALPHA };
}

function highlightedLinkWidth(bytes) {
  return Math.min(1 + logScale(bytes) * HIGHLIGHT_WIDTH_GROWTH, MAX_HIGHLIGHT_WIDTH);
}
