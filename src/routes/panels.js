const express = require('express');
const storage = require('../services/storage');

const router = express.Router();

router.get('/names', (req, res) => {
  res.json(storage.getPanelNames());
});

router.put('/names/:key', (req, res) => {
  const { key } = req.params;
  const { name } = req.body;

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({ error: 'Name is required' });
  }

  storage.setPanelName(key, name.trim());
  res.json({ success: true, key, name: name.trim() });
});

router.delete('/names/:key', (req, res) => {
  const { key } = req.params;
  storage.deletePanelName(key);
  res.json({ success: true });
});

module.exports = router;
