const express = require('express');
const storage = require('../services/storage');

const { HTTP_NOT_FOUND } = require('../lib/http-status');
const router = express.Router();

router.get('/', (req, res) => {
  res.json(storage.getDevices());
});

router.get('/:mac', (req, res) => {
  const { mac } = req.params;
  const device = storage.getDevice(mac);

  if (!device) {
    return res.status(HTTP_NOT_FOUND).json({ error: 'Device not found' });
  }

  res.json(device);
});

router.put('/:mac', (req, res) => {
  const deviceConfig = pickDefinedFields(req.body);
  const device = storage.setDevice(req.params.mac, deviceConfig);
  res.json(device);
});

router.delete('/:mac', (req, res) => {
  const { mac } = req.params;
  storage.deleteDevice(mac);
  res.json({ success: true });
});

function pickDefinedFields(body) {
  const { name, type, color, verified } = body;
  const fields = { name, type, color, verified };

  return Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined));
}

module.exports = router;
