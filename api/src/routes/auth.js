'use strict';

const express      = require('express');
const { validateKey }  = require('../services/streamKeyService');
const { startSession, endSession, markActive, markInactive } = require('../services/streamService');
const redis        = require('../services/redisService');

const router = express.Router();

/**
 * POST /api/auth/publish
 * Called by nginx-rtmp on_publish hook.
 * Body (application/x-www-form-urlencoded):
 *   name  – stream key (the RTMP stream name)
 *   addr  – client IP
 */
router.post('/publish', (req, res) => {
  const { name: streamKey, addr: clientIp } = req.body;

  if (!streamKey) {
    return res.status(400).send('Bad Request');
  }

  const valid = validateKey(streamKey);
  if (!valid) {
    console.log(`[AUTH] rejected stream key: ${streamKey.substring(0, 8)}… from ${clientIp}`);
    return res.status(403).send('Forbidden');
  }

  // Persist session + mark active (fire and forget Redis)
  try {
    startSession(streamKey, clientIp);
    markActive(streamKey, clientIp);
  } catch (err) {
    console.error('[AUTH] Failed to initialize session:', err.message);
    markInactive(streamKey);
    return res.status(500).send('Session initialization failed');
  }
  redis.setActive(streamKey, { clientIp }).catch(() => {});

  console.log(`[AUTH] accepted stream key: ${streamKey.substring(0, 8)}… from ${clientIp}`);
  res.status(200).send('OK');
});

/**
 * POST /api/auth/publish-done
 * Called by nginx-rtmp on_publish_done hook.
 */
router.post('/publish-done', (req, res) => {
  const { name: streamKey } = req.body;

  if (streamKey) {
    try {
      endSession(streamKey);
      markInactive(streamKey);
    } catch (err) {
      console.error('[AUTH] Failed to end session:', err.message);
    }
    redis.setInactive(streamKey).catch(() => {});
    console.log(`[AUTH] stream ended: ${streamKey.substring(0, 8)}…`);
  }

  res.status(200).send('OK');
});

module.exports = router;
