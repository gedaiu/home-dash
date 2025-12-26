const express = require('express');
const homeconnectService = require('../services/homeconnect');

const router = express.Router();

const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.get('/status', (req, res) => {
  res.json({
    configured: homeconnectService.isConfigured(),
    authenticated: homeconnectService.isAuthenticated()
  });
});

router.post('/configure', (req, res) => {
  const { clientId, clientSecret } = req.body;
  if (!clientId || !clientSecret) {
    return res.status(400).json({ error: 'Client ID and secret required' });
  }
  homeconnectService.configure(clientId, clientSecret);
  res.json({ success: true });
});

router.get('/auth/url', (req, res) => {
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.headers['x-forwarded-host'] || req.get('host');
  const redirectUri = `${protocol}://${host}/api/homeconnect/auth/callback`;

  try {
    const authUrl = homeconnectService.getAuthUrl(redirectUri);
    res.json({ authUrl, redirectUri });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/auth/callback', asyncHandler(async (req, res) => {
  const { code, error } = req.query;

  if (error) {
    return res.redirect('/?homeconnect_error=' + encodeURIComponent(error));
  }

  if (!code) {
    return res.status(400).send('Authorization code missing');
  }

  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.headers['x-forwarded-host'] || req.get('host');
  const redirectUri = `${protocol}://${host}/api/homeconnect/auth/callback`;

  try {
    await homeconnectService.exchangeCode(code, redirectUri);
    homeconnectService.startPolling();
    res.redirect('/?homeconnect_success=1');
  } catch (err) {
    res.redirect('/?homeconnect_error=' + encodeURIComponent(err.message));
  }
}));

router.get('/appliances', asyncHandler(async (req, res) => {
  if (!homeconnectService.isAuthenticated()) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  const appliances = await homeconnectService.getAppliances();
  res.json(appliances);
}));

router.get('/devices', asyncHandler(async (req, res) => {
  const statuses = await homeconnectService.getAllStatuses();
  res.json(statuses);
}));

router.delete('/disconnect', (req, res) => {
  homeconnectService.disconnect();
  res.json({ success: true });
});

module.exports = router;
