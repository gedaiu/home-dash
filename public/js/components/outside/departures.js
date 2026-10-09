import { html } from 'https://esm.sh/htm@3.1.1/preact';
import { BVG_COLORS, WALK_ICON, WALK_TIME_ICON } from './transport-icons.js';

const FALLBACK_LINE_COLOR = '#666';

export function walkTimeBadge(walkTime) {
  if (!(walkTime > 0)) { return null; }

  return html`<span class="walk-time">${WALK_TIME_ICON} ${walkTime}m</span>`;
}

export function departureGroup({ title, departures, category }) {
  if (!departures || departures.length === 0) {
    return null;
  }

  return html`
    <div class="departure-group ${category}">
      <div class="departure-group-header">${title}</div>
      <div class="departure-list">
        ${departures.map((dep, i) => html`<${departureRow} departure=${dep} key=${i} />`)}
      </div>
    </div>
  `;
}

export function journeyGroup({ title, journeys, category }) {
  if (!journeys || journeys.length === 0) {
    return null;
  }

  return html`
    <div class="journey-group ${category}">
      <div class="journey-group-header">${title}</div>
      <div class="journey-options">
        ${journeys.map((journey, i) => html`<${journeyOption} journey=${journey} key=${i} />`)}
      </div>
    </div>
  `;
}

function departureRow({ departure }) {
  return html`
    <div class="departure-row ${departure.cancelled ? 'cancelled' : ''}">
      <${lineBadge} line=${departure.line} type=${departure.transportType} />
      <div class="departure-direction">${departure.direction}</div>
      <div class="departure-time">
        ${formatTime(departure.actualTime)}
        ${delayBadge(departure.delay)}
      </div>
    </div>
  `;
}

function delayBadge(delay) {
  if (!delay) { return null; }

  const delayClass = delay > 0 ? 'late' : 'early';
  const delayText = delay > 0 ? `+${delay}` : `${delay}`;

  return html`<span class="delay ${delayClass}">${delayText}</span>`;
}

function journeyOption({ journey }) {
  const lastIndex = journey.legs.length - 1;

  return html`
    <div class="journey-option ${journey.category || ''}">
      <div class="journey-summary">
        <span class="journey-time">${formatTime(journey.departure)}</span>
        <span class="journey-duration">${journey.duration} min</span>
      </div>
      <div class="journey-legs">
        ${journey.legs.map((leg, i) => html`<${journeyLeg} leg=${leg} isLast=${i === lastIndex} key=${i} />`)}
      </div>
      <div class="journey-meta">
        <span class="journey-time">${formatTime(journey.arrival)}</span>
        ${transfersBadge(journey.transfers)}
        ${journey.totalDelay > 0 ? html`<span class="journey-delay">+${journey.totalDelay} min</span>` : null}
      </div>
    </div>
  `;
}

function transfersBadge(transfers) {
  if (!(transfers > 0)) { return null; }

  return html`<span class="journey-transfers">${transfers} ${transfers === 1 ? 'change' : 'changes'}</span>`;
}

function journeyLeg({ leg, isLast }) {
  return html`
    <div class="journey-leg">
      <${lineBadge} line=${leg.line} type=${leg.transportType} />
      ${!isLast && html`<span class="leg-destination">${leg.destination}</span>`}
    </div>
  `;
}

function lineBadge({ line, type }) {
  if (type === 'walk') {
    return html`
      <div class="line-badge walk">
        ${WALK_ICON}
      </div>
    `;
  }

  if (!Object.hasOwn(BVG_COLORS, type)) {
    return html`
      <div class="line-badge unknown" style="background: ${FALLBACK_LINE_COLOR}">
        <span class="line-text">${line || '?'}</span>
      </div>
    `;
  }

  return html`
    <div class="line-badge ${type}" style="background: ${BVG_COLORS[type]}">
      <span class="line-text">${line}</span>
    </div>
  `;
}

function formatTime(isoString) {
  if (!isoString) { return '--:--'; }
  const date = new Date(isoString);

  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}
