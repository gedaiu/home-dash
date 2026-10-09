import { FULL_TURN, QUARTER_TURN, HALF } from './geometry-constants.js';

const MIN_RENDER_DIMENSION = 10;
const COUNTRY_RADIUS_RATIO = 0.40;
const OUTER_RADIUS_RATIO = 0.48;
const FIRST_RING_DIMENSION_RATIO = 0.15;
const DEFAULT_FIRST_RING_RADIUS = 90;
const FALLBACK_RING_RADIUS = 50;
const MIN_RING_RADIUS = 80;
const MIN_DEVICE_SPACING = 55;
const SUBNET_GAP = 60;
const GATEWAY_GAP = 40;
const SPLIT_RING_GAP = 45;
const COUNTRY_RING_MARGIN = 50;
const RING_ROTATION_FACTOR = 0.4;
const GATEWAY_GAP_ANGLE = 0.3;
const GATEWAY_ANGLE_STEP = 0.25;
const MAX_DESTINATION_SPREAD_FACTOR = 0.8;
const MAX_DESTINATION_SPREAD = Math.PI * MAX_DESTINATION_SPREAD_FACTOR;
const DESTINATION_SPREAD_STEP = 0.15;

export function computeLayout(width, height, subnets) {
  const minDimension = Math.min(width, height);

  if (minDimension < MIN_RENDER_DIMENSION) return null;

  const countryRadius = minDimension * COUNTRY_RADIUS_RATIO;
  const { ringRadii, scaleFactor } = calculateRingRadii(subnets, minDimension, countryRadius);

  return {
    width,
    height,
    centerX: width / 2,
    centerY: height / 2,
    countryRadius,
    outerRadius: minDimension * OUTER_RADIUS_RATIO,
    ringRadii,
    scaleFactor
  };
}

export function positionCountries(countries, layout) {
  return countries.map((country, i) => {
    const angle = (i / countries.length) * FULL_TURN - QUARTER_TURN;

    return { ...country, ...polarPosition(layout, angle, layout.countryRadius), angle };
  });
}

export function positionDevices(subnets, layout) {
  return subnets.flatMap((subnetData, subnetIndex) => {
    const radius = layout.ringRadii[subnetIndex] * layout.scaleFactor;
    const gatewayDevices = subnetData.devices.filter(device => device.isGateway);
    const regularDevices = regularDevicesOf(subnetData);
    const ring = { layout, radius, subnetIndex };

    return [
      ...positionRegularDevices(regularDevices, ring, gatewayDevices.length > 0),
      ...positionGatewayDevices(gatewayDevices, ring)
    ];
  });
}

export function positionDestinations({ destinations, countryPositions, selectedCountryCode }, layout) {
  if (!selectedCountryCode) return [];

  const selectedCountryPos = countryPositions.find(country => country.code === selectedCountryCode);
  if (!selectedCountryPos) return [];

  const countryDests = destinations
    .filter(destination => destination.country === selectedCountryCode)
    .sort((left, right) => right.totalBytes - left.totalBytes);

  const destCount = countryDests.length;
  const spread = Math.min(MAX_DESTINATION_SPREAD, destCount * DESTINATION_SPREAD_STEP);

  return countryDests.map((destination, i) => {
    const offsetAngle = destCount === 1 ? 0 : (i / (destCount - 1) - HALF) * spread;
    const angle = selectedCountryPos.angle + offsetAngle;

    return { ...destination, ...polarPosition(layout, angle, layout.outerRadius), angle };
  });
}

function calculateRingRadii(subnets, minDimension, countryRadius) {
  const minRadii = subnets.map(minimumRingRadius);
  const ringRadii = [Math.max(minRadii[0] || DEFAULT_FIRST_RING_RADIUS, minDimension * FIRST_RING_DIMENSION_RATIO)];

  for (let i = 1; i < subnets.length; i++) {
    const previousRadius = ringRadii[i - 1];

    ringRadii.push(Math.max(previousRadius + ringGap(subnets[i - 1], subnets[i]), minRadii[i] || FALLBACK_RING_RADIUS));
  }

  const outermostRadius = ringRadii[ringRadii.length - 1];
  const maxDeviceRadius = countryRadius - COUNTRY_RING_MARGIN;
  const scaleFactor = outermostRadius > maxDeviceRadius ? maxDeviceRadius / outermostRadius : 1;

  return { ringRadii, scaleFactor };
}

function minimumRingRadius(subnetData) {
  const deviceCount = regularDevicesOf(subnetData).length;

  return Math.max(MIN_RING_RADIUS, (deviceCount * MIN_DEVICE_SPACING) / FULL_TURN);
}

function regularDevicesOf(subnetData) {
  return subnetData.devices.filter(device => !device.isGateway);
}

function ringGap(previousRing, currentRing) {
  return previousRing.subnet === currentRing.subnet ? SPLIT_RING_GAP : SUBNET_GAP + GATEWAY_GAP;
}

function positionRegularDevices(regularDevices, ring, hasGateway) {
  const gapAngle = hasGateway ? GATEWAY_GAP_ANGLE : 0;
  const availableAngle = FULL_TURN - gapAngle;
  const ringOffset = ring.subnetIndex * Math.PI * RING_ROTATION_FACTOR;
  const startAngle = -QUARTER_TURN + gapAngle / 2 + ringOffset;

  return regularDevices.map((device, i) => {
    const angle = startAngle + (i / Math.max(1, regularDevices.length)) * availableAngle;

    return { ...device, ...polarPosition(ring.layout, angle, ring.radius), angle, subnetIndex: ring.subnetIndex };
  });
}

function positionGatewayDevices(gatewayDevices, ring) {
  return gatewayDevices.map((device, i) => {
    const angle = -QUARTER_TURN + (i - (gatewayDevices.length - 1) / 2) * GATEWAY_ANGLE_STEP;

    return {
      ...device,
      ...polarPosition(ring.layout, angle, ring.radius),
      angle,
      subnetIndex: ring.subnetIndex,
      isGatewayNode: true
    };
  });
}

function polarPosition(layout, angle, radius) {
  return {
    posX: layout.centerX + Math.cos(angle) * radius,
    posY: layout.centerY + Math.sin(angle) * radius
  };
}
