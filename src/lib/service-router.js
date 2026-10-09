const express = require('express');
const asyncHandler = require('./async-handler');
const { HTTP_BAD_REQUEST } = require('./http-status');

function createServiceRouter(service) {
  const router = express.Router();

  router.get('/status', asyncHandler(async (req, res) => {
    res.json({ configured: service.isConfigured(), data: service.getStatus() });
  }));

  return router;
}

function requireConfigured(service, label) {
  return (req, res, next) => {
    if (!service.isConfigured()) {
      return res.status(HTTP_BAD_REQUEST).json({ error: `${label} not configured` });
    }

    return next();
  };
}

module.exports = { createServiceRouter, requireConfigured };
