const express = require('express');
const storage = require('../services/storage');

const router = express.Router();

router.get('/', (req, res) => {
  res.json(storage.getDevices());
});

router.get('/:mac', (req, res) => {
  const { mac } = req.params;
  const device = storage.getDevice(mac);

  if (!device) {
    return res.status(404).json({ error: 'Device not found' });
  }

  res.json(device);
});

router.put('/:mac', (req, res) => {
  const { mac } = req.params;
  const { name, type, color, verified } = req.body;

  const deviceConfig = {};

  if (name !== undefined) {
    deviceConfig.name = name;
  }

  if (type !== undefined) {
    deviceConfig.type = type;
  }

  if (color !== undefined) {
    deviceConfig.color = color;
  }

  if (verified !== undefined) {
    deviceConfig.verified = verified;
  }

  const device = storage.setDevice(mac, deviceConfig);
  res.json(device);
});

router.delete('/:mac', (req, res) => {
  const { mac } = req.params;
  storage.deleteDevice(mac);
  res.json({ success: true });
});

module.exports = router;
