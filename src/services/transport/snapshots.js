const { resolveStationId, fetchDepartures, fetchJourney } = require('./api');
const {
  emptyGroups,
  groupDepartures,
  groupJourneys,
  categorizeJourney,
  parseDeparture,
  parseJourney
} = require('./parsing');

const POLL_DEPARTURE_LIMIT = 30;

async function buildStationEntry(stationName, walkTime) {
  const station = await resolveStationId(stationName);
  const response = await fetchDepartures(station.id, POLL_DEPARTURE_LIMIT);
  const parsedDepartures = (response.departures || response).map(parseDeparture);

  return {
    name: station.name,
    walkTime,
    grouped: groupDepartures(parsedDepartures, walkTime),
    departures: parsedDepartures
  };
}

function buildStationErrorEntry(stationName, walkTime, error) {
  return {
    name: stationName,
    walkTime,
    grouped: emptyGroups(),
    departures: [],
    error: error.message
  };
}

async function buildRouteEntry(route, walkTime) {
  const journeyData = await fetchJourney(route.from, route.to);
  const parsedJourneys = journeyData.journeys.map(journey => parseCategorizedJourney(journey, walkTime));

  return {
    name: routeName(route),
    from: route.from,
    to: route.to,
    walkTime,
    grouped: groupJourneys(parsedJourneys),
    journeys: parsedJourneys
  };
}

function buildRouteErrorEntry(route, walkTime, error) {
  return {
    name: routeName(route),
    walkTime,
    grouped: emptyGroups(),
    journeys: [],
    error: error.message
  };
}

function parseCategorizedJourney(journey, walkTime) {
  const parsed = parseJourney(journey);

  return { ...parsed, category: categorizeJourney(parsed, walkTime) };
}

function routeName(route) {
  return route.name || `${route.from} to ${route.to}`;
}

module.exports = {
  buildStationEntry,
  buildStationErrorEntry,
  buildRouteEntry,
  buildRouteErrorEntry
};
