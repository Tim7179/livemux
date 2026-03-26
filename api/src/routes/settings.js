'use strict';

const express   = require('express');
const adminAuth = require('../middleware/adminAuth');
const svc       = require('../services/settingsService');

const router = express.Router();

// GET /api/settings/network  – list current allowed networks
router.get('/network', adminAuth, (req, res) => {
  res.json({ networks: svc.getNetworks() });
});

// PUT /api/settings/network  – replace the full list
// Body: { "networks": ["10.0.0.0/8", "192.168.1.0/24"] }
router.put('/network', adminAuth, (req, res, next) => {
  try {
    const networks = svc.setNetworks(req.body?.networks);
    res.json({ networks });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
