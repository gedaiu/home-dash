const express = require('express');
const nanoleafService = require('../services/nanoleaf');

const router = express.Router();

const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.get('/discover', asyncHandler(async (req, res) => {
  const devices = await nanoleafService.discover();
  res.json(devices);
}));

router.get('/device', asyncHandler(async (req, res) => {
  const device = await nanoleafService.getDevice();
  if (!device) {
    return res.json({ configured: false });
  }
  res.json({ configured: true, ...device });
}));

router.post('/device/pair', asyncHandler(async (req, res) => {
  const { ip, port } = req.body;
  if (!ip) {
    return res.status(400).json({ error: 'IP address required' });
  }
  const result = await nanoleafService.pair(ip, port);
  res.json(result);
}));

router.delete('/device', (req, res) => {
  nanoleafService.remove();
  res.json({ success: true });
});

router.get('/config', (req, res) => {
  const config = nanoleafService.getConfig();
  if (!config) {
    return res.json({ configured: false });
  }
  res.json({
    configured: true,
    minBrightness: config.minBrightness ?? 5,
    maxBrightness: config.maxBrightness ?? 100
  });
});

router.put('/config', asyncHandler(async (req, res) => {
  const { minBrightness, maxBrightness } = req.body;
  const updates = {};

  if (minBrightness !== undefined) {
    updates.minBrightness = minBrightness;
  }
  if (maxBrightness !== undefined) {
    updates.maxBrightness = maxBrightness;
  }

  nanoleafService.updateConfig(updates);
  res.json({ success: true, ...updates });
}));

module.exports = router;
