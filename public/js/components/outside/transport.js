import { html } from 'https://esm.sh/htm@3.1.1/preact';
import { departureGroup, journeyGroup, walkTimeBadge } from './departures.js';

const MAX_UPCOMING_DEPARTURES = 5;
const MAX_UPCOMING_JOURNEYS = 3;

export function transportSection({ transport }) {
  const { stationEntries, routes } = transportEntries(transport);

  if (stationEntries.length === 0 && routes.length === 0) {
    return transportSetupPanel();
  }

  return html`
    <div class="transport-section">
      ${stationList(stationEntries)}

      ${stationEntries.length > 0 && routes.length > 0 && html`<div class="transport-divider"></div>`}

      ${routeList(routes)}
    </div>
  `;
}

function transportEntries(transport) {
  return {
    stationEntries: Object.entries(transport?.departures ?? {}),
    routes: transport?.routes ?? []
  };
}

function transportSetupPanel() {
  return html`
    <section class="panel transport-panel">
      <div class="panel-header">
        <i data-lucide="train"></i>
        <span>PUBLIC TRANSPORT</span>
      </div>
      <div class="panel-content">
        <div class="setup-message">
          <p>Transport not configured. Add stations to network-config.json:</p>
          <code>{ "transport": { "stations": ["Alexanderplatz"], "routes": [...] } }</code>
        </div>
      </div>
    </section>
  `;
}

function stationList(stationEntries) {
  if (stationEntries.length === 0) { return null; }

  return html`
    <div class="transport-stations">
      ${stationEntries.map(([stationKey, station]) =>
        html`<${stationDepartures} stationKey=${stationKey} stationData=${station} key=${stationKey} />`
      )}
    </div>
  `;
}

function routeList(routes) {
  if (routes.length === 0) { return null; }

  return html`
    <div class="transport-routes">
      ${routes.map((route, i) =>
        html`<${routeJourneys} route=${route} key=${i} />`
      )}
    </div>
  `;
}

function stationDepartures({ stationKey, stationData }) {
  const stationName = cleanStationName(stationData?.name) || stationKey;

  if (!stationData || stationData.error) {
    return stationErrorPanel(stationName, stationData);
  }

  return transportPanel({
    panelClass: 'station-panel',
    icon: 'map-pin',
    title: stationName,
    walkTime: stationData.walkTime,
    body: stationBody(stationData.grouped)
  });
}

function stationErrorPanel(stationName, stationData) {
  return transportPanel({
    panelClass: 'station-panel',
    icon: 'map-pin',
    title: stationName,
    body: html`<div class="station-error">${stationData?.error || 'No data'}</div>`
  });
}

function stationBody(grouped) {
  if (!hasAnyEntries(grouped)) {
    return html`<div class="no-departures">No catchable departures</div>`;
  }

  return html`
    <div class="departure-groups">
      <${departureGroup} title="RUN!" departures=${grouped.hurry} category="hurry" />
      <${departureGroup} title="LEAVE NOW" departures=${grouped.now} category="now" />
      <${departureGroup} title="UPCOMING" departures=${upcomingOf(grouped, MAX_UPCOMING_DEPARTURES)} category="upcoming" />
    </div>
  `;
}

function routeJourneys({ route }) {
  const grouped = route.grouped;

  return transportPanel({
    panelClass: 'route-panel',
    icon: 'navigation',
    title: route.name,
    walkTime: route.walkTime,
    body: routeBody(route, grouped)
  });
}

function routeBody(route, grouped) {
  if (!hasAnyEntries(grouped)) {
    return html`<div class="route-error">${route.error || 'No connections available'}</div>`;
  }

  return html`
    <div class="journey-groups">
      <${journeyGroup} title="RUN!" journeys=${grouped.hurry} category="hurry" />
      <${journeyGroup} title="LEAVE NOW" journeys=${grouped.now} category="now" />
      <${journeyGroup} title="UPCOMING" journeys=${upcomingOf(grouped, MAX_UPCOMING_JOURNEYS)} category="upcoming" />
    </div>
  `;
}

function transportPanel({ panelClass, icon, title, walkTime, body }) {
  return html`
    <section class="panel ${panelClass}">
      <div class="panel-header">
        <i data-lucide="${icon}"></i>
        <span>${title}</span>
        ${walkTimeBadge(walkTime)}
      </div>
      <div class="panel-content">${body}</div>
    </section>
  `;
}

function hasAnyEntries(grouped) {
  if (!grouped) { return false; }

  return ['hurry', 'now', 'upcoming'].some(category => grouped[category]?.length > 0);
}

function upcomingOf(grouped, limit) {
  return grouped.upcoming?.slice(0, limit);
}

function cleanStationName(name) {
  if (!name) return name;

  return name.replace(/\s*\(Berlin\)\s*/gi, '').trim();
}
