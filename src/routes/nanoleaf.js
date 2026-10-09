const express = require('express');
const nanoleafService = require('../services/nanoleaf');

const { HTTP_BAD_REQUEST } = require('../lib/http-status');
const asyncHandler = require('../lib/async-handler');
const DEFAULT_MIN_BRIGHTNESS = 5;
const DEFAULT_MAX_BRIGHTNESS = 100;

const router = express.Router();

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
  const { ip: address, port } = req.body;

  if (!address) {
    return res.status(HTTP_BAD_REQUEST).json({ error: 'IP address required' });
  }

  const result = await nanoleafService.pair(address, port);
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
    minBrightness: config.minBrightness ?? DEFAULT_MIN_BRIGHTNESS,
    maxBrightness: config.maxBrightness ?? DEFAULT_MAX_BRIGHTNESS,
    roomId: config.roomId ?? null
  });
});

router.put('/config', asyncHandler(async (req, res) => {
  const { minBrightness, maxBrightness, roomId } = req.body;
  const updates = {};

  if (minBrightness !== undefined) {
    updates.minBrightness = minBrightness;
  }

  if (maxBrightness !== undefined) {
    updates.maxBrightness = maxBrightness;
  }

  if (roomId !== undefined) {
    updates.roomId = roomId;
  }

  nanoleafService.updateConfig(updates);
  res.json({ success: true, ...updates });
}));

module.exports = router;
