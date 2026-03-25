'use strict';

const express   = require('express');
const adminAuth = require('../middleware/adminAuth');
const { getActiveStreams, isActive, getSessionHistory } = require('../services/streamService');

const router = express.Router();
router.use(adminAuth);

// GET /api/streams  – list all currently active streams
router.get('/', (req, res) => {
  res.json(getActiveStreams());
});

// GET /api/streams/:key  – info + session history for one stream
router.get('/:key', (req, res) => {
  const active  = isActive(req.params.key);
  const history = getSessionHistory(req.params.key);
  res.json({ streamKey: req.params.key, active, history });
});

module.exports = router;
