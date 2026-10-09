import { html } from 'https://esm.sh/htm@3.1.1/preact';
import { getDeviceColor, getDeviceDisplayName } from '../../state.js';
import { formatBytes } from './format.js';
import { sortedByBytes } from './connection-stats.js';
import { getCountryColor } from './country-colors.js';
import { applySelection, statTile, selectableRow, detailsSection, dataInfoSection, MAX_LISTED_ROWS } from './details-parts.js';

const EDIT_ADDRESS_FIELD = 'ip';

export function deviceDetails({ mac, device, onEditDevice }) {
  const countries = sortedByBytes(device.countries);
  const destinations = sortedByBytes(device.destinations);

  return html`
    <div class="details-header">
      <span class="details-name device-color" style="color: ${getDeviceColor(mac, device.hostname)}">${getDeviceDisplayName(mac, device.hostname, device.hostname)}</span>
      <span class="details-subtitle">${device.ipAddress}</span>
      <span class="details-subtitle mono">${mac}</span>
    </div>
    <div class="details-stats">
      ${statTile(formatBytes(device.totalBytes), 'Traffic')}
      ${statTile(device.connectionCount, 'Connections')}
    </div>
    ${countries.length > 0 && countriesSection(countries)}
    ${destinations.length > 0 && destinationsSection(destinations)}
    ${device.connectionCount === 0 ? noTrafficNote() : dataInfoSection(device)}
    <button class="btn btn-secondary btn-block" onClick=${() => onEditDevice(editableDevice(mac, device))}>
      <i data-lucide="settings"></i>
      Customize Device
    </button>
  `;
}

function countriesSection(countries) {
  const rows = countries.slice(0, MAX_LISTED_ROWS).map(country => selectableRow({
    color: getCountryColor(country.code),
    label: country.code,
    value: formatBytes(country.bytes),
    onSelect: () => applySelection({ country: country.code })
  }));

  return detailsSection('Countries', rows);
}

function destinationsSection(destinations) {
  const rows = destinations.slice(0, MAX_LISTED_ROWS).map(destination => selectableRow({
    color: getCountryColor(destination.country),
    label: destination.label,
    value: formatBytes(destination.bytes),
    onSelect: () => applySelection({ country: destination.country, destination: destination.label })
  }));

  return detailsSection('Top Destinations', rows);
}

function noTrafficNote() {
  return html`
    <div class="details-section">
      <div class="data-info-note">
        No traffic data available. This device hasn't made any tracked outbound connections recently, or it may act as a gateway/router.
      </div>
    </div>
  `;
}

function editableDevice(mac, device) {
  return { mac, hostname: device.hostname, [EDIT_ADDRESS_FIELD]: device.ipAddress };
}
