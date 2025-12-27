import { html } from 'https://esm.sh/htm@3.1.1/preact';
import { useState, useEffect, useRef } from 'https://esm.sh/preact@10.19.3/hooks';
import { effect } from 'https://esm.sh/@preact/signals@1.2.1';
import { logs, wsConnected, wsLatency } from '../state.js';

function Clock() {
  const [time, setTime] = useState('00:00:00');

  useEffect(() => {
    const update = () => {
      const now = new Date();
      const hours = String(now.getHours()).padStart(2, '0');
      const mins = String(now.getMinutes()).padStart(2, '0');
      const secs = String(now.getSeconds()).padStart(2, '0');
      setTime(`${hours}:${mins}:${secs}`);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  return html`<span class="clock">${time}</span>`;
}

function FooterMessage() {
  const [lastLog, setLastLog] = useState(null);

  useEffect(() => {
    const dispose = effect(() => {
      const logList = logs.value;
      if (logList && logList.length > 0) {
        setLastLog(logList[logList.length - 1]);
      } else {
        setLastLog(null);
      }
    });
    return dispose;
  }, []);

  const message = lastLog?.message || 'READY';
  const time = lastLog?.time || '';

  return html`
    <div class="footer-content">
      <span class="footer-time">${time}</span>
      <span class="footer-msg">${message}</span>
      <span class="blink">_</span>
    </div>
  `;
}

function EkgMonitor() {
  const svgRef = useRef(null);
  const [latency, setLatency] = useState(null);
  const [connected, setConnected] = useState(false);
  const animationRef = useRef(null);
  const positionRef = useRef(0);
  const lastTimeRef = useRef(0);
  const amplitudeRef = useRef(1);
  const speedRef = useRef(25);

  const EKG_WIDTH = 200;
  const EKG_BEAT_WIDTH = 25;
  const EKG_MIN_SPEED = 10;
  const EKG_MAX_SPEED = 35;

  const generateWaveform = (amplitude) => {
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
  };

  const getYAtX = (x, amplitude) => {
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
  };

  useEffect(() => {
    const dispose = effect(() => {
      setLatency(wsLatency.value);
      setConnected(wsConnected.value);

      if (wsLatency.value !== null) {
        amplitudeRef.current = Math.max(0.3, Math.min(1, 1 - (wsLatency.value / 400)));
        speedRef.current = EKG_MAX_SPEED - ((wsLatency.value / 300) * (EKG_MAX_SPEED - EKG_MIN_SPEED));
        speedRef.current = Math.max(EKG_MIN_SPEED, Math.min(EKG_MAX_SPEED, speedRef.current));
      }
    });
    return dispose;
  }, []);

  useEffect(() => {
    if (!connected || !svgRef.current) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      return;
    }

    const svg = svgRef.current;
    const path = svg.querySelector('#ekg-path');
    const trace = svg.querySelector('#ekg-trace');
    const dot = svg.querySelector('#ekg-dot');
    const maskRect = svg.querySelector('#ekg-mask-rect');

    if (!path || !trace || !dot || !maskRect) {
      return;
    }

    const waveform = generateWaveform(amplitudeRef.current);
    path.setAttribute('d', waveform);
    trace.setAttribute('d', waveform);

    const animate = (timestamp) => {
      if (!lastTimeRef.current) {
        lastTimeRef.current = timestamp;
      }

      const delta = (timestamp - lastTimeRef.current) / 1000;
      lastTimeRef.current = timestamp;

      positionRef.current += speedRef.current * delta;

      if (positionRef.current >= EKG_WIDTH) {
        positionRef.current = 0;
        const newWaveform = generateWaveform(amplitudeRef.current);
        path.setAttribute('d', newWaveform);
        trace.setAttribute('d', newWaveform);
      }

      maskRect.setAttribute('width', positionRef.current);

      const dotY = getYAtX(positionRef.current, amplitudeRef.current);
      dot.setAttribute('cx', positionRef.current);
      dot.setAttribute('cy', dotY);

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [connected]);

  const disconnectedClass = !connected ? 'disconnected' : '';
  const highLatencyClass = latency && latency > 200 ? 'high-latency' : '';

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

export function Layout({ children }) {
  return html`
    <div class="scanlines"></div>
    <div class="crt">
      <header class="header">
        <div class="header-left">
          <span class="logo">[ HUE-RASSIC PARK ]</span>
          <span class="version">v2.0.0</span>
        </div>
        <div class="header-right">
          <${Clock} />
        </div>
      </header>
      <main class="main">
        ${children}
      </main>
      <footer class="footer">
        <${FooterMessage} />
        <${EkgMonitor} />
      </footer>
    </div>
  `;
}
