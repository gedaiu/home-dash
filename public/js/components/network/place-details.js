import { html } from 'https://esm.sh/htm@3.1.1/preact';
import { getDeviceColor, getDeviceDisplayName } from '../../state.js';
import { formatBytes } from './format.js';
import { devicesForCountry, devicesForDestination } from './connection-stats.js';
import { getCountryColor } from './country-colors.js';
import { applySelection, statTile, selectableRow, detailsSection, dataInfoSection, MAX_LISTED_ROWS } from './details-parts.js';

const MAX_LISTED_DESTINATION_DEVICES = 10;

export function countryDetails({ countryCode, country, stats }) {
  const devices = devicesForCountry(stats, countryCode).slice(0, MAX_LISTED_ROWS);
  const rows = devices.map(device => deviceRow(device, device.bytesToCountry));

  return html`
    <div class="details-header">
      <span class="details-name" style="color: ${getCountryColor(countryCode)}">${countryCode}</span>
    </div>
    <div class="details-stats">
      ${statTile(formatBytes(country.totalBytes), 'Traffic')}
      ${statTile(country.devices.size, 'Devices')}
      ${statTile(country.destinations.size, 'Destinations')}
    </div>
    ${detailsSection('Local Devices', rows)}
  `;
}

export function destinationDetails({ destLabel, destination, stats }) {
  const devices = devicesForDestination(stats, destLabel).slice(0, MAX_LISTED_DESTINATION_DEVICES);
  const rows = devices.map(device => deviceRow(device, device.bytesToDest));

  return html`
    <div class="details-header">
      <span class="details-name" style="color: ${getCountryColor(destination.country)}">${destination.label}</span>
      <span class="details-subtitle">${destination.country || 'Unknown'}</span>
      ${hasDistinctHostname(destination) && html`
        <span class="details-subtitle mono">${destination.hostname}</span>
      `}
      ${destination.ipAddress && html`
        <span class="details-subtitle mono">${destination.ipAddress}</span>
      `}
    </div>
    <div class="details-stats">
      ${statTile(formatBytes(destination.totalBytes), 'Traffic')}
      ${statTile(destination.connectionCount, 'Connections')}
      ${statTile(destination.devices.size, 'Devices')}
    </div>
    ${detailsSection('Local Devices', rows)}
    ${dataInfoSection(destination)}
  `;
}

function hasDistinctHostname(destination) {
  return destination.hostname && destination.hostname !== destination.label;
}

function deviceRow(device, bytes) {
  return selectableRow({
    color: getDeviceColor(device.mac, device.hostname),
    label: getDeviceDisplayName(device.mac, device.hostname, device.hostname),
    value: formatBytes(bytes),
    onSelect: () => applySelection({ mac: device.mac })
  });
}
