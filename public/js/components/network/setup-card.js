import { html } from 'https://esm.sh/htm@3.1.1/preact';

const DEFAULT_SERVER_PORT = '3000';

export function setupCard() {
  const { hostname, port } = window.location;

  return html`
    <div class="network-setup">
      <div class="setup-card">
        <i data-lucide="router"></i>
        <h3>Setup Required</h3>
        <p>Install the OpenWrt agent on your router(s) to start monitoring your network.</p>
        <div class="setup-steps">
          <div class="step">
            <span class="step-number">1</span>
            <span class="step-text">Install <code>luci-app-netmon</code> on your OpenWrt router</span>
          </div>
          <div class="step">
            <span class="step-number">2</span>
            <span class="step-text">Go to Services > Network Monitor in LuCI</span>
          </div>
          <div class="step">
            <span class="step-number">3</span>
            <span class="step-text">Enter this server's URL: <code>ws://${hostname}:${port || DEFAULT_SERVER_PORT}/ws/agent</code></span>
          </div>
          <div class="step">
            <span class="step-number">4</span>
            <span class="step-text">Click Save & Apply</span>
          </div>
        </div>
      </div>
    </div>
  `;
}
