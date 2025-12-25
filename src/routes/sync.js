const express = require('express');
const syncService = require('../services/sync');

const router = express.Router();

router.get('/config', (req, res) => {
  const config = syncService.getConfig();
  res.json(config || {});
});

router.put('/config', (req, res) => {
  const { hueDeviceId, hueDeviceName } = req.body;

  if (!hueDeviceId) {
    return res.status(400).json({ error: 'hueDeviceId required' });
  }

  syncService.setConfig({
    hueDeviceId,
    hueDeviceName: hueDeviceName || `Light ${hueDeviceId}`
  });

  res.json({ success: true });
});

router.post('/start', async (req, res) => {
  const result = await syncService.start();
  res.json(result);
});

router.post('/stop', (req, res) => {
  const result = syncService.stop();
  res.json(result);
});

router.get('/status', (req, res) => {
  res.json(syncService.getStatus());
});

module.exports = router;
