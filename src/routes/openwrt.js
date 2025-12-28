const express = require('express');
const router = express.Router();
const openwrtService = require('../services/openwrt');
const geoip = require('../lib/geoip');

// Helper for async route handlers
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Get all router statuses
router.get('/status', asyncHandler(async (req, res) => {
  const routers = openwrtService.getRouters();
  res.json({
    success: true,
    data: routers
  });
}));

// Get all connected devices
router.get('/devices', asyncHandler(async (req, res) => {
  const devices = openwrtService.getDevices();
  res.json({
    success: true,
    data: devices
  });
}));

// Get device by MAC
router.get('/devices/:mac', asyncHandler(async (req, res) => {
  const devices = openwrtService.getDevices();
  const device = devices.find(d => d.mac.toLowerCase() === req.params.mac.toLowerCase());

  if (!device) {
    return res.status(404).json({
      success: false,
      error: 'Device not found'
    });
  }

  res.json({
    success: true,
    data: device
  });
}));

// Get all active connections
router.get('/connections', asyncHandler(async (req, res) => {
  const connections = openwrtService.getConnections();
  res.json({
    success: true,
    data: connections
  });
}));

// Get connections for a specific device
router.get('/connections/:mac', asyncHandler(async (req, res) => {
  const connections = openwrtService.getConnections();
  const deviceConnections = connections.filter(
    c => c.srcMac?.toLowerCase() === req.params.mac.toLowerCase()
  );

  res.json({
    success: true,
    data: deviceConnections
  });
}));

// Get graph data for visualization
router.get('/graph', asyncHandler(async (req, res) => {
  const graphData = openwrtService.getGraphData();
  res.json({
    success: true,
    data: graphData
  });
}));

// Get IP information
router.get('/ip/:ip', asyncHandler(async (req, res) => {
  const info = await geoip.lookup(req.params.ip);

  if (!info) {
    return res.status(404).json({
      success: false,
      error: 'IP information not found'
    });
  }

  res.json({
    success: true,
    data: info
  });
}));

// Get full state
router.get('/state', asyncHandler(async (req, res) => {
  const state = openwrtService.getState();
  res.json({
    success: true,
    data: state
  });
}));

module.exports = router;
