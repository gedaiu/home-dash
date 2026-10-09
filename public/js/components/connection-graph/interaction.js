import { getDeviceDisplayName } from '../../state.js';

const HIT_RADIUS_SQUARED = 200;
const EMPTY_SELECTION = { mac: null, country: null, destination: null };
const HIT_KINDS = [
  { kind: 'device', listName: 'devices' },
  { kind: 'country', listName: 'countries' },
  { kind: 'destination', listName: 'destinations' }
];
const SELECTION_RULES = {
  device: (device, selection) => ({ ...EMPTY_SELECTION, mac: toggle(selection.mac, device.mac) }),
  country: (country, selection) => ({ ...EMPTY_SELECTION, country: toggle(selection.country, country.code) }),
  destination: (dest, selection) => ({
    ...EMPTY_SELECTION,
    country: selection.country,
    destination: toggle(selection.destination, dest.label)
  })
};
const HOVER_RULES = { device: hoverDevice, country: hoverCountry, destination: hoverDestination };

export function pointerPosition(canvas, event) {
  const rect = canvas.getBoundingClientRect();

  return { pointerX: event.clientX - rect.left, pointerY: event.clientY - rect.top };
}

export function findHit(positions, pointer) {
  for (const { kind, listName } of HIT_KINDS) {
    const target = findHitTarget(pointer, positions[listName]);

    if (target) return { kind, target };
  }

  return null;
}

export function nextSelection(hit, selection) {
  if (!hit) return EMPTY_SELECTION;

  return SELECTION_RULES[hit.kind](hit.target, selection);
}

export function updateHover(context) {
  const rule = HOVER_RULES[context.hit?.kind] || clearHover;

  rule(context);
}

function findHitTarget(pointer, positions) {
  return positions.find(node => {
    const deltaX = pointer.pointerX - node.posX;
    const deltaY = pointer.pointerY - node.posY;

    return deltaX * deltaX + deltaY * deltaY < HIT_RADIUS_SQUARED;
  }) || null;
}

function toggle(current, value) {
  return current === value ? null : value;
}

function hoverDevice({ hit, event, hover, setHover }) {
  const device = hit.target;

  if (hover.device?.mac === device.mac) return;

  setHover.device({
    mac: device.mac,
    name: getDeviceDisplayName(device.mac, device.hostname, device.hostname),
    posX: event.clientX,
    posY: event.clientY
  });
  setHover.country(null);
  setHover.dest(null);
}

function hoverCountry({ hit, hover, setHover }) {
  if (hover.country === hit.target.code) return;

  setHover.country(hit.target.code);
  setHover.dest(null);
  setHover.device(null);
}

function hoverDestination({ hit, hover, setHover }) {
  if (hover.dest === hit.target.label) return;

  setHover.dest(hit.target.label);
  setHover.country(null);
  setHover.device(null);
}

function clearHover({ hover, setHover }) {
  if (hover.country) setHover.country(null);
  if (hover.dest) setHover.dest(null);
  if (hover.device) setHover.device(null);
}
