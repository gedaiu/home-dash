const express = require('express');
const { HTTP_NOT_FOUND } = require('../lib/http-status');
const asyncHandler = require('../lib/async-handler');
const router = express.Router();
const openwrtService = require('../services/openwrt');
const geoip = require('../lib/geoip');

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
  const { mac } = req.params;
  const device = devices.find(candidate => candidate.mac.toLowerCase() === mac.toLowerCase());

  if (!device) {
    return res.status(HTTP_NOT_FOUND).json({
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
  const { mac } = req.params;
  const connections = openwrtService.getConnections();
  const deviceConnections = connections.filter(
    connection => connection.srcMac?.toLowerCase() === mac.toLowerCase()
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
  const ipInfo = await geoip.lookup(req.params.ip);

  if (!ipInfo) {
    return res.status(HTTP_NOT_FOUND).json({
      success: false,
      error: 'IP information not found'
    });
  }

  res.json({
    success: true,
    data: ipInfo
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
