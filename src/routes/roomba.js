const express = require('express');
const roombaService = require('../services/roomba');

const asyncHandler = require('../lib/async-handler');
const router = express.Router();

router.get('/status', async (req, res) => {
  try {
    const status = await roombaService.getStatus();

    if (!status) {
      return res.json({ configured: false });
    }

    res.json({ configured: true, ...status });
  } catch (err) {
    res.json({ configured: false, error: err.message });
  }
});

router.post('/start', asyncHandler(async (req, res) => {
  await roombaService.start();
  res.json({ success: true });
}));

router.post('/stop', asyncHandler(async (req, res) => {
  await roombaService.stop();
  res.json({ success: true });
}));

router.post('/pause', asyncHandler(async (req, res) => {
  await roombaService.pause();
  res.json({ success: true });
}));

router.post('/resume', asyncHandler(async (req, res) => {
  await roombaService.resume();
  res.json({ success: true });
}));

router.post('/dock', asyncHandler(async (req, res) => {
  await roombaService.dock();
  res.json({ success: true });
}));

module.exports = router;
