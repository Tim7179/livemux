'use strict';

const express   = require('express');
const adminAuth = require('../middleware/adminAuth');
const svc       = require('../services/userService');

const router = express.Router();
router.use(adminAuth);

// GET /api/users
router.get('/', (req, res) => {
  res.json(svc.listUsers());
});

// POST /api/users  { username, email?, note? }
router.post('/', (req, res, next) => {
  try {
    const user = svc.createUser(req.body);
    res.status(201).json(user);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/users/batch
 * JSON body:  { users: [ { username, email?, note? }, ... ] }
 * CSV body:   raw CSV text with Content-Type: text/csv
 *             header row: username[,email][,note]
 */
router.post('/batch', (req, res, next) => {
  try {
    let rows;
    const ct = (req.headers['content-type'] || '').toLowerCase();

    if (ct.includes('text/csv')) {
      // Raw CSV body (express.text middleware used below)
      rows = svc.parseCSV(req.body);
    } else {
      // JSON body: { users: [...] }
      const body = req.body || {};
      if (!Array.isArray(body.users)) {
        return res.status(400).json({ error: '`users` array is required in JSON body, or send raw CSV with Content-Type: text/csv' });
      }
      rows = body.users;
    }

    const result = svc.createUsersBatch(rows);
    const status = result.errors.length === 0 ? 201 : (result.created.length === 0 ? 400 : 207);
    res.status(status).json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/users/:id
router.get('/:id', (req, res) => {
  const user = svc.getUser(parseInt(req.params.id, 10));
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

// DELETE /api/users/:id
router.delete('/:id', (req, res) => {
  const deleted = svc.deleteUser(parseInt(req.params.id, 10));
  if (!deleted) return res.status(404).json({ error: 'User not found' });
  res.status(204).end();
});

module.exports = router;
