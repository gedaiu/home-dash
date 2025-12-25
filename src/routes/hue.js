const express = require('express');
const hueService = require('../services/hue');

const router = express.Router();

const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.get('/discover', asyncHandler(async (req, res) => {
  const bridges = await hueService.discover();
  res.json(bridges);
}));

router.get('/bridge', asyncHandler(async (req, res) => {
  const bridge = await hueService.getBridge();
  if (!bridge) {
    return res.json({ configured: false });
  }
  res.json({ configured: true, ...bridge });
}));

router.post('/bridge/pair', asyncHandler(async (req, res) => {
  const { ip } = req.body;
  if (!ip) {
    return res.status(400).json({ error: 'IP address required' });
  }
  const result = await hueService.pair(ip);
  res.json(result);
}));

router.delete('/bridge', (req, res) => {
  hueService.remove();
  res.json({ success: true });
});

router.get('/lights', asyncHandler(async (req, res) => {
  const lights = await hueService.getLights();
  res.json(lights);
}));

router.get('/rooms', asyncHandler(async (req, res) => {
  const rooms = await hueService.getRooms();
  res.json(rooms);
}));

router.get('/lights/:id', asyncHandler(async (req, res) => {
  const light = await hueService.getLight(parseInt(req.params.id, 10));
  if (!light) {
    return res.status(404).json({ error: 'Light not found' });
  }
  res.json(light);
}));

module.exports = router;
