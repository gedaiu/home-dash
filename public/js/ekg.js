import { $ } from './utils.js';

const EKG_WIDTH = 200;
const EKG_BEAT_WIDTH = 25;
const EKG_TRAIL_WIDTH = 50;
const EKG_MIN_SPEED = 10;
const EKG_MAX_SPEED = 35;

let ekgPosition = 0;
let ekgAnimationFrame = null;
let ekgAmplitude = 1;
let ekgSpeed = 25;
let ekgLastTime = 0;

function generateEkgWaveform(amplitude) {
  const baseY = 50;
  let d = `M 0 ${baseY}`;
  let x = 0;

  while (x < EKG_WIDTH + EKG_BEAT_WIDTH) {
    d += ` L ${x + 2} ${baseY}`;
    d += ` L ${x + 4} ${baseY - 5 * amplitude}`;
    d += ` L ${x + 6} ${baseY + 3 * amplitude}`;
    d += ` L ${x + 8} ${baseY - 40 * amplitude}`;
    d += ` L ${x + 10} ${baseY + 15 * amplitude}`;
    d += ` L ${x + 12} ${baseY - 8 * amplitude}`;
    d += ` L ${x + 14} ${baseY}`;
    d += ` L ${x + 17} ${baseY + 5 * amplitude}`;
    d += ` L ${x + 20} ${baseY}`;
    d += ` L ${x + EKG_BEAT_WIDTH} ${baseY}`;
    x += EKG_BEAT_WIDTH;
  }

  return d;
}

function getEkgYAtX(x, amplitude) {
  const baseY = 50;
  const beatX = ((x % EKG_BEAT_WIDTH) + EKG_BEAT_WIDTH) % EKG_BEAT_WIDTH;

  if (beatX <= 2) { return baseY; }
  if (beatX <= 4) { return baseY - 5 * amplitude * ((beatX - 2) / 2); }
  if (beatX <= 6) { return baseY - 5 * amplitude + (8 * amplitude) * ((beatX - 4) / 2); }
  if (beatX <= 8) { return baseY + 3 * amplitude - (43 * amplitude) * ((beatX - 6) / 2); }
  if (beatX <= 10) { return baseY - 40 * amplitude + (55 * amplitude) * ((beatX - 8) / 2); }
  if (beatX <= 12) { return baseY + 15 * amplitude - (23 * amplitude) * ((beatX - 10) / 2); }
  if (beatX <= 14) { return baseY - 8 * amplitude + (8 * amplitude) * ((beatX - 12) / 2); }
  if (beatX <= 17) { return baseY + (5 * amplitude) * ((beatX - 14) / 3); }
  if (beatX <= 20) { return baseY + 5 * amplitude - (5 * amplitude) * ((beatX - 17) / 3); }
  return baseY;
}

function updateEkgGradient() {
  const gradient = document.getElementById('ekg-gradient');
  if (!gradient) {
    return;
  }

  const trailStart = Math.max(0, ekgPosition - EKG_TRAIL_WIDTH);
  const startPercent = (trailStart / EKG_WIDTH) * 100;
  const endPercent = (ekgPosition / EKG_WIDTH) * 100;

  gradient.innerHTML = `
    <stop offset="0%" stop-color="transparent"/>
    <stop offset="${startPercent}%" stop-color="transparent"/>
    <stop offset="${startPercent + (endPercent - startPercent) * 0.3}%" stop-color="#002200"/>
    <stop offset="${startPercent + (endPercent - startPercent) * 0.7}%" stop-color="#00aa00"/>
    <stop offset="${endPercent}%" stop-color="#33ff33"/>
    <stop offset="${endPercent + 0.1}%" stop-color="transparent"/>
    <stop offset="100%" stop-color="transparent"/>
  `;
}

export function initEkg() {
  const path = $('#ekg-path');
  const trace = $('#ekg-trace');
  const waveform = generateEkgWaveform(ekgAmplitude);

  if (path) {
    path.setAttribute('d', waveform);
  }

  if (trace) {
    trace.setAttribute('d', waveform);
  }
}

function animateEkg(timestamp) {
  const dot = $('#ekg-dot');
  const maskRect = $('#ekg-mask-rect');

  if (!dot || !maskRect) {
    ekgAnimationFrame = requestAnimationFrame(animateEkg);
    return;
  }

  if (!ekgLastTime) {
    ekgLastTime = timestamp;
    ekgAnimationFrame = requestAnimationFrame(animateEkg);
    return;
  }

  const delta = (timestamp - ekgLastTime) / 1000;
  ekgLastTime = timestamp;

  ekgPosition += ekgSpeed * delta;

  if (ekgPosition >= EKG_WIDTH) {
    ekgPosition = 0;
    initEkg();
  }

  maskRect.setAttribute('width', ekgPosition);

  updateEkgGradient();

  const dotY = getEkgYAtX(ekgPosition, ekgAmplitude);
  dot.setAttribute('cx', ekgPosition);
  dot.setAttribute('cy', dotY);

  ekgAnimationFrame = requestAnimationFrame(animateEkg);
}

export function updateEkgDisplay(currentLatency) {
  const monitor = $('#ekg-monitor');
  const latencyEl = $('#ekg-latency');

  if (!monitor || !latencyEl) {
    return;
  }

  monitor.classList.remove('disconnected');
  latencyEl.textContent = `${currentLatency} ms`;
  monitor.classList.toggle('high-latency', currentLatency > 200);

  ekgAmplitude = Math.max(0.3, Math.min(1, 1 - (currentLatency / 400)));
  ekgSpeed = EKG_MAX_SPEED - ((currentLatency / 300) * (EKG_MAX_SPEED - EKG_MIN_SPEED));
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
  const path = $('#ekg-path');
  const trace = $('#ekg-trace');
  const dot = $('#ekg-dot');
  const maskRect = $('#ekg-mask-rect');

  if (!latencyEl || !monitor) {
    return;
  }

  monitor.classList.add('disconnected');
  monitor.classList.remove('high-latency');
  latencyEl.textContent = 'OFFLINE';

  const flatLine = 'M 0 50 L 200 50';

  if (path) {
    path.setAttribute('d', flatLine);
  }

  if (trace) {
    trace.setAttribute('d', flatLine);
  }

  if (dot) {
    dot.setAttribute('cx', '100');
    dot.setAttribute('cy', '50');
  }

  if (maskRect) {
    maskRect.setAttribute('width', '200');
  }

  if (ekgAnimationFrame) {
    cancelAnimationFrame(ekgAnimationFrame);
    ekgAnimationFrame = null;
  }

  ekgPosition = 0;
}
