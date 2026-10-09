const express = require('express');
const airpurifierService = require('../services/airpurifier');

const { HTTP_BAD_REQUEST } = require('../lib/http-status');
const asyncHandler = require('../lib/async-handler');
const router = express.Router();

const MAX_BRIGHTNESS = 100;

function indexedRoute(handle) {
  return asyncHandler(async (req, res) => {
    const index = getIndex(req);

    if (index === null) {
      return res.status(HTTP_BAD_REQUEST).json({ error: 'Invalid device index' });
    }

    return handle(index, req, res);
  });
}

function toggleRoute(applyToggle, responseKey) {
  return indexedRoute(async (index, req, res) => {
    const { on: isOn } = req.body;

    if (typeof isOn !== 'boolean') {
      return res.status(HTTP_BAD_REQUEST).json({ error: 'on (boolean) is required' });
    }

    await applyToggle(index, isOn);

    return res.json({ success: true, [responseKey]: isOn });
  });
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

router.get('/devices/:index/status', indexedRoute(async (index, req, res) => {
  res.json(airpurifierService.getStatus(index));
}));

router.post('/devices', asyncHandler(async (req, res) => {
  const { ip: address, name } = req.body;

  if (!address) {
    return res.status(HTTP_BAD_REQUEST).json({ error: 'IP address is required' });
  }

  const result = await airpurifierService.configure(address, name);
  res.json(result);
}));

router.delete('/devices/:index', indexedRoute(async (index, req, res) => {
  airpurifierService.remove(index);
  res.json({ success: true });
}));

router.post('/devices/:index/connect', indexedRoute(async (index, req, res) => {
  await airpurifierService.connect(index);
  await airpurifierService.startPolling(index);
  res.json({ success: true });
}));

router.post('/devices/:index/disconnect', indexedRoute(async (index, req, res) => {
  airpurifierService.stopPolling(index);
  res.json({ success: true });
}));

router.post('/devices/:index/power', toggleRoute((index, isOn) => airpurifierService.setPower(index, isOn), 'power'));

router.post('/devices/:index/mode', indexedRoute(async (index, req, res) => {
  const { mode } = req.body;

  if (!mode) {
    return res.status(HTTP_BAD_REQUEST).json({ error: 'mode is required (M, AG, AL, T, S)' });
  }

  await airpurifierService.setMode(index, mode);

  return res.json({ success: true, mode });
}));

router.post('/devices/:index/fan', indexedRoute(async (index, req, res) => {
  const { speed } = req.body;

  if (speed === undefined) {
    return res.status(HTTP_BAD_REQUEST).json({ error: 'speed is required (1, 2, 3, s, t)' });
  }

  await airpurifierService.setFanSpeed(index, speed);

  return res.json({ success: true, speed });
}));

router.post('/devices/:index/childlock', toggleRoute((index, isOn) => airpurifierService.setChildLock(index, isOn), 'childLock'));

router.post('/devices/:index/light', indexedRoute(async (index, req, res) => {
  const { brightness } = req.body;

  if (typeof brightness !== 'number' || brightness < 0 || brightness > MAX_BRIGHTNESS) {
    return res.status(HTTP_BAD_REQUEST).json({ error: 'brightness (0-100) is required' });
  }

  await airpurifierService.setLight(index, brightness);

  return res.json({ success: true, brightness });
}));

router.post('/devices/:index/buttonlight', toggleRoute((index, isOn) => airpurifierService.setButtonLight(index, isOn), 'buttonLight'));

module.exports = router;
