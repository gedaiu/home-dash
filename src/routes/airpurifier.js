const express = require('express');
const airpurifierService = require('../services/airpurifier');

const router = express.Router();

function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

function getIndex(req) {
  const index = parseInt(req.params.index, 10);
  if (isNaN(index) || index < 0) {
    return null;
  }
  return index;
}

router.get('/devices', asyncHandler(async (req, res) => {
  const statuses = airpurifierService.getAllStatuses();
  res.json(statuses);
}));

router.get('/devices/:index/status', asyncHandler(async (req, res) => {
  const index = getIndex(req);
  if (index === null) {
    return res.status(400).json({ error: 'Invalid device index' });
  }

  const status = airpurifierService.getStatus(index);
  res.json(status);
}));

router.post('/devices', asyncHandler(async (req, res) => {
  const { ip, name } = req.body;

  if (!ip) {
    return res.status(400).json({ error: 'IP address is required' });
  }

  const result = await airpurifierService.configure(ip, name);
  res.json(result);
}));

router.delete('/devices/:index', asyncHandler(async (req, res) => {
  const index = getIndex(req);
  if (index === null) {
    return res.status(400).json({ error: 'Invalid device index' });
  }

  airpurifierService.remove(index);
  res.json({ success: true });
}));

router.post('/devices/:index/connect', asyncHandler(async (req, res) => {
  const index = getIndex(req);
  if (index === null) {
    return res.status(400).json({ error: 'Invalid device index' });
  }

  await airpurifierService.connect(index);
  await airpurifierService.startPolling(index);
  res.json({ success: true });
}));

router.post('/devices/:index/disconnect', asyncHandler(async (req, res) => {
  const index = getIndex(req);
  if (index === null) {
    return res.status(400).json({ error: 'Invalid device index' });
  }

  airpurifierService.stopPolling(index);
  res.json({ success: true });
}));

router.post('/devices/:index/power', asyncHandler(async (req, res) => {
  const index = getIndex(req);
  if (index === null) {
    return res.status(400).json({ error: 'Invalid device index' });
  }

  const { on } = req.body;
  if (typeof on !== 'boolean') {
    return res.status(400).json({ error: 'on (boolean) is required' });
  }

  await airpurifierService.setPower(index, on);
  res.json({ success: true, power: on });
}));

router.post('/devices/:index/mode', asyncHandler(async (req, res) => {
  const index = getIndex(req);
  if (index === null) {
    return res.status(400).json({ error: 'Invalid device index' });
  }

  const { mode } = req.body;
  if (!mode) {
    return res.status(400).json({ error: 'mode is required (M, AG, AL, T, S)' });
  }

  await airpurifierService.setMode(index, mode);
  res.json({ success: true, mode });
}));

router.post('/devices/:index/fan', asyncHandler(async (req, res) => {
  const index = getIndex(req);
  if (index === null) {
    return res.status(400).json({ error: 'Invalid device index' });
  }

  const { speed } = req.body;
  if (speed === undefined) {
    return res.status(400).json({ error: 'speed is required (1, 2, 3, s, t)' });
  }

  await airpurifierService.setFanSpeed(index, speed);
  res.json({ success: true, speed });
}));

router.post('/devices/:index/childlock', asyncHandler(async (req, res) => {
  const index = getIndex(req);
  if (index === null) {
    return res.status(400).json({ error: 'Invalid device index' });
  }

  const { on } = req.body;
  if (typeof on !== 'boolean') {
    return res.status(400).json({ error: 'on (boolean) is required' });
  }

  await airpurifierService.setChildLock(index, on);
  res.json({ success: true, childLock: on });
}));

router.post('/devices/:index/light', asyncHandler(async (req, res) => {
  const index = getIndex(req);
  if (index === null) {
    return res.status(400).json({ error: 'Invalid device index' });
  }

  const { brightness } = req.body;
  if (typeof brightness !== 'number' || brightness < 0 || brightness > 100) {
    return res.status(400).json({ error: 'brightness (0-100) is required' });
  }

  await airpurifierService.setLight(index, brightness);
  res.json({ success: true, brightness });
}));

router.post('/devices/:index/buttonlight', asyncHandler(async (req, res) => {
  const index = getIndex(req);
  if (index === null) {
    return res.status(400).json({ error: 'Invalid device index' });
  }

  const { on } = req.body;
  if (typeof on !== 'boolean') {
    return res.status(400).json({ error: 'on (boolean) is required' });
  }

  await airpurifierService.setButtonLight(index, on);
  res.json({ success: true, buttonLight: on });
}));

module.exports = router;
