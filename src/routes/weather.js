const express = require('express');
const weatherService = require('../services/weather');
const storage = require('../services/storage');

const router = express.Router();

function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

router.get('/status', asyncHandler(async (req, res) => {
  const status = weatherService.getStatus();
  res.json({
    configured: weatherService.isConfigured(),
    data: status
  });
}));

router.get('/config', asyncHandler(async (req, res) => {
  const config = weatherService.getConfig();
  if (config) {
    const { apiKey, ...safeConfig } = config;
    res.json({ configured: !!apiKey, ...safeConfig });
  } else {
    res.json({ configured: false });
  }
}));

router.post('/config', asyncHandler(async (req, res) => {
  const { apiKey, location, lat, lon, pollInterval } = req.body;

  if (!apiKey) {
    return res.status(400).json({ error: 'API key is required' });
  }

  storage.setWeather({ apiKey, location, lat, lon, pollInterval });
  weatherService.stopPolling();
  weatherService.startPolling();

  res.json({ success: true });
}));

router.post('/refresh', asyncHandler(async (req, res) => {
  if (!weatherService.isConfigured()) {
    return res.status(400).json({ error: 'Weather not configured' });
  }

  const data = await weatherService.fetchForecast();
  res.json(data);
}));

module.exports = router;
