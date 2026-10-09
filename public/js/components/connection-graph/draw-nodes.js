import { getCountryColor } from '../network/country-colors.js';
import { emphasisAlpha, logScale, drawNode, drawSideLabel } from './draw-style.js';

const DESTINATION_FONT_SIZE = 10;
const DESTINATION_LABEL_OFFSET = 12;
const DESTINATION_EMPHASIZED_RADIUS = 10;
const DESTINATION_BASE_RADIUS = 4;
const DESTINATION_RADIUS_GROWTH = 1.5;
const DESTINATION_RADIUS_BONUS_MAX = 6;
const DESTINATION_DIMMED_ALPHA = 0.8;
const DESTINATION_LABEL_MAX_LENGTH = 18;
const DESTINATION_LABEL_KEPT_LENGTH = 16;
const COUNTRY_FONT_SIZE = 11;
const COUNTRY_LABEL_GAP = 6;
const COUNTRY_EMPHASIZED_RADIUS = 14;
const COUNTRY_BASE_RADIUS = 6;
const COUNTRY_RADIUS_GROWTH = 3;
const COUNTRY_RADIUS_BONUS_MAX = 10;
const COUNTRY_IDLE_ALPHA = 0.9;
const COUNTRY_DIMMED_BY_DEVICE_ALPHA = 0.2;
const COUNTRY_DIMMED_BY_COUNTRY_ALPHA = 0.3;
const COUNTRY_DIMMED_BY_HOVER_ALPHA = 0.2;

export function drawDestinationNodes(ctx, scene) {
  const { destinations } = scene.positions;

  destinations.forEach(dest => drawDestinationNode(ctx, scene, dest));
}

export function drawCountryNodes(ctx, scene) {
  const { selectedMac } = scene.focus;
  const { devices, countries } = scene.positions;
  const selectedDevice = selectedMac ? devices.find(device => device.mac === selectedMac) : null;

  countries.forEach(country => drawCountryNode(ctx, scene, { country, selectedDevice }));
}

function drawDestinationNode(ctx, scene, dest) {
  const { selectedDest, hoveredDest } = scene.focus;
  const isSelected = selectedDest === dest.label;
  const isEmphasized = hoveredDest === dest.label || isSelected;
  const alpha = isEmphasized ? 1 : DESTINATION_DIMMED_ALPHA;
  const baseRadius = DESTINATION_BASE_RADIUS + Math.min(logScale(dest.totalBytes) * DESTINATION_RADIUS_GROWTH, DESTINATION_RADIUS_BONUS_MAX);

  drawNode(ctx, {
    posX: dest.posX,
    posY: dest.posY,
    radius: isEmphasized ? DESTINATION_EMPHASIZED_RADIUS : baseRadius,
    color: getCountryColor(dest.country),
    alpha,
    isSelected
  });

  drawSideLabel(ctx, {
    text: truncateDestinationLabel(dest.label),
    posX: dest.posX,
    posY: dest.posY,
    centerX: scene.layout.centerX,
    offset: DESTINATION_LABEL_OFFSET,
    fontSize: DESTINATION_FONT_SIZE,
    alpha,
    isSelected
  });
}

function truncateDestinationLabel(label) {
  if (label.length <= DESTINATION_LABEL_MAX_LENGTH) return label;

  return label.substring(0, DESTINATION_LABEL_KEPT_LENGTH) + '...';
}

function drawCountryNode(ctx, scene, { country, selectedDevice }) {
  const { selectedCountryCode, hoveredCountry } = scene.focus;
  const isHovered = hoveredCountry === country.code;
  const isSelected = selectedCountryCode === country.code;
  const alpha = countryAlpha(scene.focus, { country, selectedDevice, isHovered, isSelected });
  const radius = isHovered || isSelected
    ? COUNTRY_EMPHASIZED_RADIUS
    : COUNTRY_BASE_RADIUS + Math.min(Math.log2(country.destinations.size + 1) * COUNTRY_RADIUS_GROWTH, COUNTRY_RADIUS_BONUS_MAX);

  drawNode(ctx, {
    posX: country.posX,
    posY: country.posY,
    radius,
    color: getCountryColor(country.code),
    alpha,
    isSelected
  });

  drawSideLabel(ctx, {
    text: country.code,
    posX: country.posX,
    posY: country.posY,
    centerX: scene.layout.centerX,
    offset: radius + COUNTRY_LABEL_GAP,
    fontSize: COUNTRY_FONT_SIZE,
    alpha,
    isSelected
  });
}

function countryAlpha(focus, { country, selectedDevice, isHovered, isSelected }) {
  const hasConnectionToSelectedDevice = focus.selectedMac ? connectsToCountry(selectedDevice, country.code) : true;

  return emphasisAlpha([
    { isActive: focus.selectedMac, isMatch: hasConnectionToSelectedDevice, matchAlpha: 1, otherAlpha: COUNTRY_DIMMED_BY_DEVICE_ALPHA },
    { isActive: focus.selectedCountryCode, isMatch: isSelected, matchAlpha: 1, otherAlpha: COUNTRY_DIMMED_BY_COUNTRY_ALPHA },
    { isActive: focus.hoveredCountry, isMatch: isHovered, matchAlpha: 1, otherAlpha: COUNTRY_DIMMED_BY_HOVER_ALPHA }
  ], COUNTRY_IDLE_ALPHA);
}

function connectsToCountry(device, countryCode) {
  return device?.countries.some(countryData => countryData.code === countryCode);
}
