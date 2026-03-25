'use strict';

const express    = require('express');
const adminAuth  = require('../middleware/adminAuth');
const svc        = require('../services/recordingService');

const router = express.Router();

/**
 * POST /api/recordings/notify
 * Called by nginx-rtmp on_record_done (internal).
 * Body (form): path=/recordings/mykey-20240101-120000.flv
 */
router.post('/notify', (req, res) => {
  const { path: filePath, name: streamKey } = req.body;
  if (filePath && streamKey) {
    const filename = filePath.split('/').pop();
    svc.registerRecording(streamKey, filename);
    console.log(`[REC] registered: ${filename} for stream ${streamKey}`);
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
    err.status = 500;
    next(err);
  }
});

module.exports = router;
