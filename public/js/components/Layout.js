import { html } from 'https://esm.sh/htm@3.1.1/preact';
import { useState, useEffect } from 'https://esm.sh/preact@10.19.3/hooks';
import { effect } from 'https://esm.sh/@preact/signals@1.2.1';
import { logs, currentPage, navigateTo } from '../state.js';
import { ekgMonitor } from './EkgMonitor.js';

const CLOCK_INTERVAL_MS = 1000;
const NAV_TABS = [
  { page: 'home', icon: 'home', label: 'Home' },
  { page: 'network', icon: 'network', label: 'Network' },
  { page: 'outside', icon: 'sun', label: 'Outside' }
];

function layout({ children }) {
  return html`
    <div class="scanlines"></div>
    <div class="crt">
      <header class="header">
        <div class="header-left">
          <span class="logo">[ HUE-RASSIC PARK ]</span>
          <${navTabs} />
        </div>
        <div class="header-right">
          <${clock} />
        </div>
      </header>
      <main class="main">
        ${children}
      </main>
      <footer class="footer">
        <${footerMessage} />
        <${ekgMonitor} />
      </footer>
    </div>
  `;
}

function navTabs() {
  const [page, setPage] = useState(currentPage.value);

  useEffect(() => effect(() => {
    setPage(currentPage.value);
  }), []);

  return html`
    <nav class="nav-tabs">
      ${NAV_TABS.map((tab) => renderNavTab(tab, page))}
    </nav>
  `;
}

function renderNavTab({ page, icon, label }, activePage) {
  return html`
    <button
      class="nav-tab ${page === activePage ? 'active' : ''}"
      onClick=${() => navigateTo(page)}
    >
      <i data-lucide=${icon}></i>
      <span>${label}</span>
    </button>
  `;
}

function clock() {
  const [time, setTime] = useState('00:00:00');

  useEffect(() => {
    const update = () => setTime(formatClockTime(new Date()));

    update();
    const interval = setInterval(update, CLOCK_INTERVAL_MS);

    return () => clearInterval(interval);
  }, []);

  return html`<span class="clock">${time}</span>`;
}

function formatClockTime(now) {
  const hours = String(now.getHours()).padStart(2, '0');
  const mins = String(now.getMinutes()).padStart(2, '0');
  const secs = String(now.getSeconds()).padStart(2, '0');

  return `${hours}:${mins}:${secs}`;
}

function footerMessage() {
  const [lastLog, setLastLog] = useState(null);

  useEffect(() => effect(() => {
    const logList = logs.value;
    setLastLog(logList && logList.length > 0 ? logList[logList.length - 1] : null);
  }), []);

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

export { layout as Layout };
