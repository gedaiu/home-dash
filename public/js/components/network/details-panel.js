import { html } from 'https://esm.sh/htm@3.1.1/preact';
import { applySelection } from './details-parts.js';
import { deviceDetails } from './device-details.js';
import { countryDetails, destinationDetails } from './place-details.js';

export function detailsPanel({ selection, selectedRecords, stats, onEditDevice }) {
  const heading = detailsHeading(selection);

  return html`
    <section class="panel details-panel">
      <div class="panel-header details-header-bar">
        <i data-lucide="${heading.icon}"></i>
        <span>${heading.title}</span>
        <button class="close-btn" onClick=${() => applySelection({})} title="Close"></button>
      </div>
      <div class="panel-content details-content">
        ${detailsBody({ selection, selectedRecords, stats, onEditDevice })}
      </div>
    </section>
  `;
}

function detailsBody({ selection, selectedRecords, stats, onEditDevice }) {
  const { mac, country, destination } = selection;
  const { device, countryRecord, destinationRecord } = selectedRecords;

  return html`
    ${mac && device && deviceDetails({ mac, device, onEditDevice })}

    ${countryRecord && countryDetails({ countryCode: country, country: countryRecord, stats })}

    ${destinationRecord && destinationDetails({ destLabel: destination, destination: destinationRecord, stats })}
  `;
}

function detailsHeading({ mac, destination }) {
  if (mac) return { icon: 'smartphone', title: 'Device Details' };
  if (destination) return { icon: 'server', title: 'Destination Details' };

  return { icon: 'globe', title: 'Country Details' };
}
