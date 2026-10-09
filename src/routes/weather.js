const weatherService = require('../services/weather');
const storage = require('../services/storage');

const { HTTP_BAD_REQUEST } = require('../lib/http-status');
const asyncHandler = require('../lib/async-handler');
const { createServiceRouter, requireConfigured } = require('../lib/service-router');
const router = createServiceRouter(weatherService);


router.get('/config', asyncHandler(async (req, res) => {
  const config = weatherService.getConfig();

  if (!config) {
    return res.json({ configured: false });
  }

  const { apiKey, ...safeConfig } = config;
  res.json({ configured: !!apiKey, ...safeConfig });
}));

router.post('/config', asyncHandler(async (req, res) => {
  const { apiKey, location, lat, lon, pollInterval } = req.body;

  if (!apiKey) {
    return res.status(HTTP_BAD_REQUEST).json({ error: 'API key is required' });
  }

  storage.setWeather({ apiKey, location, lat, lon, pollInterval });
  weatherService.stopPolling();
  weatherService.startPolling();

  res.json({ success: true });
}));

router.post('/refresh', requireConfigured(weatherService, 'Weather'), asyncHandler(async (req, res) => {
  const forecast = await weatherService.fetchForecast();
  res.json(forecast);
}));

module.exports = router;
