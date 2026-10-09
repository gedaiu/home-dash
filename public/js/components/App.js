import { html } from 'https://esm.sh/htm@3.1.1/preact';
import { useEffect, useState } from 'https://esm.sh/preact@10.19.3/hooks';
import { effect } from 'https://esm.sh/@preact/signals@1.2.1';
import { Layout } from './Layout.js';
import { Roomba } from './Roomba.js';
import { AirPurifiers } from './AirPurifier.js';
import { HomeConnect } from './HomeConnect.js';
import { Sensors } from './Sensors.js';
import { Rooms } from './Rooms.js';
import { SyncControl } from './SyncControl.js';
import { Hue } from './Hue.js';
import { Nanoleaf } from './Nanoleaf.js';
import { Log } from './Log.js';
import { NetworkPage } from './NetworkPage.js';
import { OutsidePage } from './OutsidePage.js';
import { loadPanelNames, addLog, currentPage } from '../state.js';
import { initWebSocket } from '../websocket-preact.js';

function app() {
  const [page, setPage] = useState(currentPage.value);

  useEffect(() => {
    loadPanelNames();
    initWebSocket();

    // Create lucide icons after render
    setTimeout(() => {
      if (window.lucide) {
        window.lucide.createIcons();
      }
    }, 0);

    addLog('System ready');

    const dispose = effect(() => {
      setPage(currentPage.value);
    });

    return dispose;
  }, []);

  // Re-create icons when components update
  useEffect(() => {
    if (window.lucide) {
      window.lucide.createIcons();
    }
  });

  return html`
    <${Layout}>
      ${page === 'home' && html`<${homePage} />`}
      ${page === 'network' && html`<${NetworkPage} />`}
      ${page === 'outside' && html`<${OutsidePage} />`}
    <//>
  `;
}

function homePage() {
  return html`
    <div class="panel-row" id="devices-row">
      <${Roomba} />
      <${AirPurifiers} />
      <${HomeConnect} />
    </div>

    <div class="crt-divider"></div>

    <div class="sensors-row" id="sensors-content">
      <${Sensors} />
    </div>

    <div class="crt-divider"></div>

    <div class="rooms-grid" id="rooms-content">
      <${Rooms} />
    </div>

    <div class="crt-divider"></div>

    <div class="bottom-grid">
      <${SyncControl} />
      <${Log} />
      <${Hue} />
      <${Nanoleaf} />
    </div>
  `;
}

export { app as App };
