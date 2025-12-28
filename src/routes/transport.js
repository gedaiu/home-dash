const express = require('express');
const transportService = require('../services/transport');
const storage = require('../services/storage');

const router = express.Router();

function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

router.get('/status', asyncHandler(async (req, res) => {
  const status = transportService.getStatus();
  res.json({
    configured: transportService.isConfigured(),
    data: status
  });
}));

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

router.get('/departures/:stationName', asyncHandler(async (req, res) => {
  const { stationName } = req.params;
  const limit = parseInt(req.query.limit, 10) || 10;

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
    return res.status(400).json({ error: 'from and to are required' });
  }

  const journey = await transportService.fetchJourney(from, to);
  res.json(journey);
}));

router.post('/refresh', asyncHandler(async (req, res) => {
  if (!transportService.isConfigured()) {
    return res.status(400).json({ error: 'Transport not configured' });
  }

  transportService.stopPolling();
  transportService.startPolling();
  res.json({ success: true, data: transportService.getStatus() });
}));

module.exports = router;
