const express = require('express');
const hueService = require('../services/hue');

const { HTTP_BAD_REQUEST, HTTP_NOT_FOUND } = require('../lib/http-status');
const asyncHandler = require('../lib/async-handler');
const router = express.Router();

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
  const { ip: address } = req.body;

  if (!address) {
    return res.status(HTTP_BAD_REQUEST).json({ error: 'IP address required' });
  }

  const result = await hueService.pair(address);
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
    return res.status(HTTP_NOT_FOUND).json({ error: 'Light not found' });
  }

  res.json(light);
}));

module.exports = router;
