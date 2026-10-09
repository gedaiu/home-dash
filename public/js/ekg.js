import { $ } from './utils.js';

const EKG_WIDTH = 200;
const EKG_BEAT_WIDTH = 25;
const EKG_TRAIL_WIDTH = 50;
const EKG_MIN_SPEED = 10;
const EKG_MAX_SPEED = 35;
const EKG_BASE_Y = 50;
const EKG_MIN_AMPLITUDE = 0.3;
const EKG_AMPLITUDE_LATENCY_SCALE = 400;
const EKG_SPEED_LATENCY_SCALE = 300;
const HIGH_LATENCY_MS = 200;
const MS_PER_SECOND = 1000;
const PERCENT = 100;
const GRADIENT_MID_STOP = 0.3;
const GRADIENT_LATE_STOP = 0.7;
const GRADIENT_HEAD_OFFSET = 0.1;
const FLAT_LINE_PATH = 'M 0 50 L 200 50';

const BEAT_POINTS = [
  { offsetX: 2, rise: 0 },
  { offsetX: 4, rise: -5 },
  { offsetX: 6, rise: 3 },
  { offsetX: 8, rise: -40 },
  { offsetX: 10, rise: 15 },
  { offsetX: 12, rise: -8 },
  { offsetX: 14, rise: 0 },
  { offsetX: 17, rise: 5 },
  { offsetX: 20, rise: 0 }
];

let ekgPosition = 0;
let ekgAnimationFrame = null;
let ekgAmplitude = 1;
const EKG_DEFAULT_SPEED = 25;
let ekgSpeed = EKG_DEFAULT_SPEED;
let ekgLastTime = 0;

export function updateEkgDisplay(currentLatency) {
  const monitor = $('#ekg-monitor');
  const latencyEl = $('#ekg-latency');

  if (!monitor || !latencyEl) {
    return;
  }

  monitor.classList.remove('disconnected');
  latencyEl.textContent = `${currentLatency} ms`;
  monitor.classList.toggle('high-latency', currentLatency > HIGH_LATENCY_MS);

  ekgAmplitude = Math.max(EKG_MIN_AMPLITUDE, Math.min(1, 1 - (currentLatency / EKG_AMPLITUDE_LATENCY_SCALE)));
  ekgSpeed = EKG_MAX_SPEED - ((currentLatency / EKG_SPEED_LATENCY_SCALE) * (EKG_MAX_SPEED - EKG_MIN_SPEED));
  ekgSpeed = Math.max(EKG_MIN_SPEED, Math.min(EKG_MAX_SPEED, ekgSpeed));

  if (!ekgAnimationFrame) {
    initEkg();
    ekgLastTime = 0;
    ekgAnimationFrame = requestAnimationFrame(animateEkg);
  }
}

export function updateEkgDisconnected() {
  const latencyEl = $('#ekg-latency');
  const monitor = $('#ekg-monitor');

  if (!latencyEl || !monitor) {
    return;
  }

  monitor.classList.add('disconnected');
  monitor.classList.remove('high-latency');
  latencyEl.textContent = 'OFFLINE';

  drawFlatLine();

  if (ekgAnimationFrame) {
    cancelAnimationFrame(ekgAnimationFrame);
    ekgAnimationFrame = null;
  }

  ekgPosition = 0;
}

function animateEkg(timestamp) {
  const dot = $('#ekg-dot');
  const maskRect = $('#ekg-mask-rect');

  if (dot && maskRect) {
    stepEkg(timestamp, dot, maskRect);
  }

  ekgAnimationFrame = requestAnimationFrame(animateEkg);
}

function stepEkg(timestamp, dot, maskRect) {
  if (!ekgLastTime) {
    ekgLastTime = timestamp;

    return;
  }

  const delta = (timestamp - ekgLastTime) / MS_PER_SECOND;
  ekgLastTime = timestamp;

  advanceEkgPosition(delta);
  maskRect.setAttribute('width', ekgPosition);
  updateEkgGradient();
  dot.setAttribute('cx', ekgPosition);
  dot.setAttribute('cy', getEkgYAtX(ekgPosition, ekgAmplitude));
}

function advanceEkgPosition(delta) {
  ekgPosition += ekgSpeed * delta;

  if (ekgPosition >= EKG_WIDTH) {
    ekgPosition = 0;
    initEkg();
  }
}

function drawFlatLine() {
  setAttributeIfPresent($('#ekg-path'), 'd', FLAT_LINE_PATH);
  setAttributeIfPresent($('#ekg-trace'), 'd', FLAT_LINE_PATH);
  setAttributeIfPresent($('#ekg-dot'), 'cx', '100');
  setAttributeIfPresent($('#ekg-dot'), 'cy', '50');
  setAttributeIfPresent($('#ekg-mask-rect'), 'width', '200');
}

export function initEkg() {
  const waveform = generateEkgWaveform(ekgAmplitude);

  setAttributeIfPresent($('#ekg-path'), 'd', waveform);
  setAttributeIfPresent($('#ekg-trace'), 'd', waveform);
}

function generateEkgWaveform(amplitude) {
  const beatPoints = [...BEAT_POINTS, { offsetX: EKG_BEAT_WIDTH, rise: 0 }];
  const segments = [];

  for (let start = 0; start < EKG_WIDTH + EKG_BEAT_WIDTH; start += EKG_BEAT_WIDTH) {
    beatPoints.forEach(point => segments.push(` L ${start + point.offsetX} ${EKG_BASE_Y + point.rise * amplitude}`));
  }

  return `M 0 ${EKG_BASE_Y}${segments.join('')}`;
}

function getEkgYAtX(positionX, amplitude) {
  const beatX = ((positionX % EKG_BEAT_WIDTH) + EKG_BEAT_WIDTH) % EKG_BEAT_WIDTH;
  const endIndex = BEAT_POINTS.findIndex(point => beatX <= point.offsetX);

  if (endIndex <= 0) {
    return EKG_BASE_Y;
  }

  const startPoint = BEAT_POINTS[endIndex - 1];
  const endPoint = BEAT_POINTS[endIndex];
  const progress = (beatX - startPoint.offsetX) / (endPoint.offsetX - startPoint.offsetX);

  return EKG_BASE_Y + (startPoint.rise + (endPoint.rise - startPoint.rise) * progress) * amplitude;
}

function updateEkgGradient() {
  const gradient = document.getElementById('ekg-gradient');

  if (!gradient) {
    return;
  }

  const trailStart = Math.max(0, ekgPosition - EKG_TRAIL_WIDTH);
  const startPercent = (trailStart / EKG_WIDTH) * PERCENT;
  const endPercent = (ekgPosition / EKG_WIDTH) * PERCENT;
  const span = endPercent - startPercent;

  gradient.innerHTML = `
    <stop offset="0%" stop-color="transparent"/>
    <stop offset="${startPercent}%" stop-color="transparent"/>
    <stop offset="${startPercent + span * GRADIENT_MID_STOP}%" stop-color="#002200"/>
    <stop offset="${startPercent + span * GRADIENT_LATE_STOP}%" stop-color="#00aa00"/>
    <stop offset="${endPercent}%" stop-color="#33ff33"/>
    <stop offset="${endPercent + GRADIENT_HEAD_OFFSET}%" stop-color="transparent"/>
    <stop offset="100%" stop-color="transparent"/>
  `;
}

function setAttributeIfPresent(element, name, value) {
  if (element) {
    element.setAttribute(name, value);
  }
}
