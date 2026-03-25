'use strict';

const crypto  = require('crypto');
const express = require('express');
const adminAuth = require('../middleware/adminAuth');
const svc       = require('../services/recordingService');

const router = express.Router();

/**
 * Shared secret for internal hooks (nginx → API).
 * nginx passes this as X-Internal-Token header in every hook call.
 * Falls back to ADMIN_API_KEY so single-secret setups still work.
 */
const INTERNAL_TOKEN = process.env.INTERNAL_TOKEN || process.env.ADMIN_API_KEY || '';

function assertInternalToken(req, res) {
  const provided = req.headers['x-internal-token'] || '';
  const expected = INTERNAL_TOKEN;
  let valid = false;
  try {
    const a = Buffer.from(provided);
    const b = Buffer.from(expected);
    valid = a.length > 0 && b.length > 0 && a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch {
    valid = false;
  }
  if (!valid) {
    res.status(403).send('Forbidden');
    return false;
  }
  return true;
}

/**
 * POST /api/recordings/notify
 * Called by nginx convert.sh after FLV→MP4 conversion.
 * Body (form):
 *   name   – stream key
 *   path   – full path to the new .mp4 file
 *   status – "ready" | "failed"
 *   orig   – original .flv basename (for failed case)
 */
router.post('/notify', (req, res) => {
  if (!assertInternalToken(req, res)) return;

  const { path: filePath, name: streamKey, status = 'ready', orig } = req.body;

  if (!streamKey) return res.status(200).send('OK');  // ignore malformed hooks

  try {
    if (status === 'failed') {
      // Conversion failed – register the original FLV as-is with failed status
      const flvName = orig || (filePath && filePath.split('/').pop());
      if (flvName) {
        svc.registerRecording(streamKey, flvName, 'failed');
        console.warn(`[REC] conversion failed for ${streamKey}: ${flvName}`);
      }
    } else {
      const filename = filePath && filePath.split('/').pop();
      if (filename) {
        svc.registerRecording(streamKey, filename, 'ready');
        console.log(`[REC] registered mp4: ${filename} for ${streamKey}`);
      }
    }
  } catch (err) {
    console.error('[REC] notify error:', err.message);
  }

  res.status(200).send('OK');
});

// All management routes require admin auth
router.use(adminAuth);

// GET /api/recordings
router.get('/', (req, res) => {
  res.json(svc.listRecordings());
});

// DELETE /api/recordings/:filename
router.delete('/:filename', (req, res, next) => {
  try {
    const deleted = svc.deleteRecording(req.params.filename);
    if (!deleted) return res.status(404).json({ error: 'Recording not found' });
    res.status(204).end();
  } catch (err) {
    if (!err.status) err.status = 500;
    next(err);
  }
});

module.exports = router;
