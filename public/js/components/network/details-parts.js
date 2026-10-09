import { html } from 'https://esm.sh/htm@3.1.1/preact';
import { selectedDeviceMac, selectedCountry, selectedDestination } from '../../state.js';
import { formatDuration, formatTimeRange } from './format.js';

export const MAX_LISTED_ROWS = 8;

export function applySelection({ mac = null, country = null, destination = null }) {
  selectedDeviceMac.value = mac;
  selectedCountry.value = country;
  selectedDestination.value = destination;
}

export function statTile(value, label) {
  return html`
    <div class="stat">
      <span class="stat-value">${value}</span>
      <span class="stat-label">${label}</span>
    </div>
  `;
}

export function selectableRow({ color, label, value, onSelect }) {
  return html`
    <div class="details-row clickable" onClick=${onSelect}>
      <span class="row-color" style="background: ${color}"></span>
      <span class="row-label">${label}</span>
      <span class="row-value">${value}</span>
    </div>
  `;
}

export function detailsSection(title, rows) {
  return html`
    <div class="details-section">
      <div class="section-title">${title}</div>
      <div class="details-list">${rows}</div>
    </div>
  `;
}

export function dataInfoSection(record) {
  return html`
    <div class="details-section data-info">
      <div class="section-title">Data Info</div>
      <div class="details-list">
        ${infoRow('Time window', formatTimeRange(record.lastSeen - record.firstSeen))}
        ${infoRow('Last seen', formatDuration(Date.now() - record.lastSeen))}
        ${infoRow('Source', 'conntrack')}
      </div>
      <div class="data-info-note">
        Traffic shows bytes from active connections tracked via conntrack. Connections are pruned after 5 min of inactivity. Long-lived connections show cumulative bytes; short-lived connections may under-count total traffic.
      </div>
    </div>
  `;
}

function infoRow(label, value) {
  return html`
    <div class="details-row">
      <span class="row-label">${label}</span>
      <span class="row-value">${value}</span>
    </div>
  `;
}
