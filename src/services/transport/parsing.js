const { MS_PER_MINUTE, SECONDS_PER_MINUTE } = require('./constants');

const PRODUCT_TRANSPORT_TYPES = new Map([
  ['suburban', 's-bahn'],
  ['subway', 'u-bahn'],
  ['tram', 'tram'],
  ['bus', 'bus'],
  ['regional', 'train'],
  ['express', 'train'],
  ['ferry', 'ferry']
]);
const URGENCY_TIERS = [
  { withinMinutes: 2, category: 'hurry' },
  { withinMinutes: 5, category: 'now' }
];

function emptyGroups() {
  return { hurry: [], now: [], upcoming: [] };
}

function groupDepartures(departures, walkTimeMinutes) {
  const groups = emptyGroups();

  for (const departure of departures) {
    const category = categorizeDeparture(departure, walkTimeMinutes);

    if (category === 'missed' || category === 'cancelled') {
      continue;
    }

    departure.category = category;
    groups[category].push(departure);
  }

  return groups;
}

function groupJourneys(journeys) {
  const groups = emptyGroups();

  for (const journey of journeys) {
    if (journey.category === 'missed') {
      continue;
    }

    groups[journey.category].push(journey);
  }

  return groups;
}

function categorizeDeparture(departure, walkTimeMinutes) {
  if (departure.cancelled) {
    return 'cancelled';
  }

  return categorizeByTime(departure.actualTime, walkTimeMinutes);
}

function categorizeJourney(journey, walkTimeMinutes) {
  return categorizeByTime(journey.departure, walkTimeMinutes);
}

function categorizeByTime(departureTimestamp, walkTimeMinutes) {
  const minutesUntilDeparture = (new Date(departureTimestamp).getTime() - Date.now()) / MS_PER_MINUTE;

  if (minutesUntilDeparture < 0 || minutesUntilDeparture < walkTimeMinutes) {
    return 'missed';
  }

  const tier = URGENCY_TIERS.find(candidate => minutesUntilDeparture < walkTimeMinutes + candidate.withinMinutes);

  return tier ? tier.category : 'upcoming';
}

function parseDeparture(departure) {
  const plannedTime = new Date(departure.plannedWhen || departure.when);
  const actualTime = departure.when ? new Date(departure.when) : plannedTime;

  return {
    line: departure.line?.name || 'Unknown',
    direction: departure.direction,
    plannedTime: plannedTime.toISOString(),
    actualTime: actualTime.toISOString(),
    delay: toMinutes(departure.delay),
    transportType: parseTransportType(departure.line),
    ...departureFlags(departure)
  };
}

function departureFlags(departure) {
  return {
    platform: departure.platform || null,
    cancelled: departure.cancelled || false
  };
}

function parseJourney(journey) {
  const rawLegs = journey.legs;
  const legs = rawLegs.map(parseLeg);
  const firstLeg = rawLegs[0];
  const lastLeg = rawLegs.at(-1);
  const lineLegCount = rawLegs.filter(leg => leg.line).length;

  return {
    departure: firstLeg?.departure,
    arrival: lastLeg?.arrival,
    duration: Math.round((new Date(lastLeg?.arrival) - new Date(firstLeg?.departure)) / MS_PER_MINUTE),
    transfers: lineLegCount - 1,
    totalDelay: legs.reduce((sum, leg) => sum + (leg.delay || 0), 0),
    legs
  };
}

function parseLeg(leg) {
  return {
    origin: leg.origin?.name,
    destination: leg.destination?.name,
    departure: leg.departure,
    arrival: leg.arrival,
    line: leg.line?.name || 'Walk',
    transportType: legTransportType(leg),
    delay: toMinutes(leg.departureDelay)
  };
}

function legTransportType(leg) {
  return leg.line ? parseTransportType(leg.line) : 'walk';
}

function parseTransportType(line) {
  if (!line) {
    return 'unknown';
  }

  return PRODUCT_TRANSPORT_TYPES.get(line.product) || 'unknown';
}

function toMinutes(seconds) {
  return Math.round((seconds || 0) / SECONDS_PER_MINUTE);
}

function getStationName(stationConfig) {
  return typeof stationConfig === 'string' ? stationConfig : stationConfig.name;
}

function getStationWalkTime(stationConfig) {
  return typeof stationConfig === 'string' ? 0 : stationConfig.walkTime || 0;
}

module.exports = {
  emptyGroups,
  groupDepartures,
  groupJourneys,
  categorizeJourney,
  parseDeparture,
  parseJourney,
  getStationName,
  getStationWalkTime
};
