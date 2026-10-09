const transportService = require('../services/transport');
const storage = require('../services/storage');

const { HTTP_BAD_REQUEST } = require('../lib/http-status');
const asyncHandler = require('../lib/async-handler');
const { createServiceRouter, requireConfigured } = require('../lib/service-router');
const router = createServiceRouter(transportService);


router.get('/config', asyncHandler(async (req, res) => {
  const config = transportService.getConfig();
  res.json(config || { stations: [], routes: [] });
}));

router.post('/config', asyncHandler(async (req, res) => {
  const { stations, routes, pollInterval } = req.body;

  storage.setTransport({ stations, routes, pollInterval });
  transportService.clearStationCache();
  transportService.stopPolling();
  transportService.startPolling();

  res.json({ success: true });
}));

const DEFAULT_DEPARTURE_LIMIT = 10;

router.get('/departures/:stationName', asyncHandler(async (req, res) => {
  const { stationName } = req.params;
  const limit = parseInt(req.query.limit, 10) || DEFAULT_DEPARTURE_LIMIT;

  const station = await transportService.resolveStationId(stationName);
  const departures = await transportService.fetchDepartures(station.id, limit);
  res.json({
    station: station.name,
    departures: departures.departures || departures
  });
}));

router.get('/journey', asyncHandler(async (req, res) => {
  const { from, to } = req.query;

  if (!from || !to) {
    return res.status(HTTP_BAD_REQUEST).json({ error: 'from and to are required' });
  }

  const journey = await transportService.fetchJourney(from, to);
  res.json(journey);
}));

router.post('/refresh', requireConfigured(transportService, 'Transport'), asyncHandler(async (req, res) => {
  transportService.stopPolling();
  transportService.startPolling();
  res.json({ success: true, data: transportService.getStatus() });
}));

module.exports = router;
