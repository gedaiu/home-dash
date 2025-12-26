const express = require('express');
const airpurifierService = require('../services/airpurifier');

const router = express.Router();

const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.get('/discover', asyncHandler(async (req, res) => {
  const devices = await airpurifierService.discover();
  res.json(devices);
}));

router.get('/devices', asyncHandler(async (req, res) => {
  const statuses = await airpurifierService.getAllStatuses();
  res.json(statuses);
}));

router.get('/devices/:id', asyncHandler(async (req, res) => {
  const status = await airpurifierService.getStatus(req.params.id);
  if (!status) {
    return res.status(404).json({ error: 'Purifier not found' });
  }
  res.json(status);
}));

router.post('/devices/pair', asyncHandler(async (req, res) => {
  const { ip } = req.body;
  if (!ip) {
    return res.status(400).json({ error: 'IP address required' });
  }
  const result = await airpurifierService.pair(ip);
  res.json(result);
}));

router.delete('/devices/:id', (req, res) => {
  airpurifierService.remove(req.params.id);
  res.json({ success: true });
});

router.put('/devices/:id/name', asyncHandler(async (req, res) => {
  const { name } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Name required' });
  }
  airpurifierService.updateName(req.params.id, name);
  res.json({ success: true });
}));

router.post('/devices/:id/power', asyncHandler(async (req, res) => {
  const { on } = req.body;
  await airpurifierService.setPower(req.params.id, on);
  res.json({ success: true });
}));

router.post('/devices/:id/mode', asyncHandler(async (req, res) => {
  const { mode } = req.body;
  await airpurifierService.setMode(req.params.id, mode);
  res.json({ success: true });
}));

router.post('/devices/:id/fan', asyncHandler(async (req, res) => {
  const { speed } = req.body;
  await airpurifierService.setFanSpeed(req.params.id, speed);
  res.json({ success: true });
}));

module.exports = router;
