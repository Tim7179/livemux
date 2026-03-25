'use strict';

const express    = require('express');
const adminAuth  = require('../middleware/adminAuth');
const svc        = require('../services/streamKeyService');

const router = express.Router();
router.use(adminAuth);

// GET /api/stream-keys
router.get('/', (req, res) => {
  res.json(svc.listKeys());
});

// POST /api/stream-keys  { name, description }
router.post('/', (req, res, next) => {
  try {
    const record = svc.createKey(req.body);
    res.status(201).json(record);
  } catch (err) {
    err.status = 400;
    next(err);
  }
});

// GET /api/stream-keys/:key
router.get('/:key', (req, res) => {
  const record = svc.getKey(req.params.key);
  if (!record) return res.status(404).json({ error: 'Stream key not found' });
  res.json(record);
});

// PATCH /api/stream-keys/:key  { name?, description?, is_active? }
router.patch('/:key', (req, res) => {
  const record = svc.updateKey(req.params.key, req.body);
  if (!record) return res.status(404).json({ error: 'Stream key not found' });
  res.json(record);
});

// DELETE /api/stream-keys/:key
router.delete('/:key', (req, res) => {
  const deleted = svc.deleteKey(req.params.key);
  if (!deleted) return res.status(404).json({ error: 'Stream key not found' });
  res.status(204).end();
});

module.exports = router;
