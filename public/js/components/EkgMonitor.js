import { html } from 'https://esm.sh/htm@3.1.1/preact';
import { useState, useEffect, useRef } from 'https://esm.sh/preact@10.19.3/hooks';
import { effect } from 'https://esm.sh/@preact/signals@1.2.1';
import { wsConnected, wsLatency } from '../state.js';
import { EKG_WIDTH, generateWaveform, getYAtX } from './ekgWaveform.js';

const EKG_MIN_SPEED = 10;
const EKG_MAX_SPEED = 35;
const EKG_INITIAL_SPEED = 25;
const MIN_AMPLITUDE = 0.3;
const AMPLITUDE_LATENCY_RANGE_MS = 400;
const SPEED_LATENCY_RANGE_MS = 300;
const HIGH_LATENCY_MS = 200;
const MS_PER_SECOND = 1000;

export function ekgMonitor() {
  const svgRef = useRef(null);
  const [latency, setLatency] = useState(null);
  const [connected, setConnected] = useState(false);
  const animationState = {
    animationRef: useRef(null),
    positionRef: useRef(0),
    lastTimeRef: useRef(0),
    amplitudeRef: useRef(1),
    speedRef: useRef(EKG_INITIAL_SPEED)
  };

  useEffect(() => effect(() => {
    syncLatency({ setLatency, setConnected, ...animationState });
  }), []);

  useEffect(() => {
    if (!connected || !svgRef.current) {
      stopAnimation(animationState.animationRef);

      return;
    }

    const elements = queryEkgElements(svgRef.current);

    if (!elements) {
      return;
    }

    return startAnimation(elements, animationState);
  }, [connected]);

  return renderEkg({ svgRef, latency, connected });
}

function syncLatency({ setLatency, setConnected, amplitudeRef, speedRef }) {
  const latencyMs = wsLatency.value;
  setLatency(latencyMs);
  setConnected(wsConnected.value);

  if (latencyMs === null) {
    return;
  }

  amplitudeRef.current = Math.max(MIN_AMPLITUDE, Math.min(1, 1 - (latencyMs / AMPLITUDE_LATENCY_RANGE_MS)));
  const rawSpeed = EKG_MAX_SPEED - ((latencyMs / SPEED_LATENCY_RANGE_MS) * (EKG_MAX_SPEED - EKG_MIN_SPEED));
  speedRef.current = Math.max(EKG_MIN_SPEED, Math.min(EKG_MAX_SPEED, rawSpeed));
}

function stopAnimation(animationRef) {
  if (animationRef.current) {
    cancelAnimationFrame(animationRef.current);
    animationRef.current = null;
  }
}

function queryEkgElements(svg) {
  const elements = {
    path: svg.querySelector('#ekg-path'),
    trace: svg.querySelector('#ekg-trace'),
    dot: svg.querySelector('#ekg-dot'),
    maskRect: svg.querySelector('#ekg-mask-rect')
  };

  return Object.values(elements).every(Boolean) ? elements : null;
}

function startAnimation(elements, animationState) {
  const { animationRef, positionRef, amplitudeRef } = animationState;
  drawWaveform(elements, amplitudeRef.current);

  const animate = (timestamp) => {
    advancePosition(animationState, timestamp);

    if (positionRef.current >= EKG_WIDTH) {
      positionRef.current = 0;
      drawWaveform(elements, amplitudeRef.current);
    }

    moveMarker(elements, positionRef.current, amplitudeRef.current);
    animationRef.current = requestAnimationFrame(animate);
  };

  animationRef.current = requestAnimationFrame(animate);

  return () => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
  };
}

function drawWaveform({ path, trace }, amplitude) {
  const waveform = generateWaveform(amplitude);
  path.setAttribute('d', waveform);
  trace.setAttribute('d', waveform);
}

function advancePosition({ lastTimeRef, positionRef, speedRef }, timestamp) {
  if (!lastTimeRef.current) {
    lastTimeRef.current = timestamp;
  }

  const deltaSeconds = (timestamp - lastTimeRef.current) / MS_PER_SECOND;
  lastTimeRef.current = timestamp;
  positionRef.current += speedRef.current * deltaSeconds;
}

function moveMarker({ maskRect, dot }, position, amplitude) {
  maskRect.setAttribute('width', position);
  dot.setAttribute('cx', position);
  dot.setAttribute('cy', getYAtX(position, amplitude));
}

function renderEkg({ svgRef, latency, connected }) {
  const disconnectedClass = connected ? '' : 'disconnected';
  const highLatencyClass = latency && latency > HIGH_LATENCY_MS ? 'high-latency' : '';

  return html`
    <div class="ekg-monitor ${disconnectedClass} ${highLatencyClass}">
      <span class="ekg-bracket">[</span>
      <svg ref=${svgRef} viewBox="0 0 200 100" preserveAspectRatio="none">
        <defs>
          <mask id="ekg-mask">
            <rect id="ekg-mask-rect" x="0" y="0" width="0" height="100" fill="white"/>
          </mask>
        </defs>
        <path id="ekg-trace" fill="none" stroke="rgba(255, 140, 0, 0.2)" stroke-width="2" d="M 0 50 L 200 50"/>
        <path id="ekg-path" fill="none" stroke="#ff8c00" stroke-width="2" mask="url(#ekg-mask)" d="M 0 50 L 200 50"/>
        <circle id="ekg-dot" r="4" cx="0" cy="50" fill="#ff8c00"/>
      </svg>
      <span class="ekg-bracket">]</span>
      <span class="ekg-latency">${connected ? `${latency || 0} ms` : 'OFFLINE'}</span>
    </div>
  `;
}
