'use strict';

const express      = require('express');
const morgan       = require('morgan');
const errorHandler = require('./middleware/errorHandler');

const authRoutes       = require('./routes/auth');
const streamKeyRoutes  = require('./routes/streamKeys');
const streamRoutes     = require('./routes/streams');
const recordingRoutes  = require('./routes/recordings');
const adminRoutes      = require('./routes/admin');
const userRoutes       = require('./routes/users');

const app  = express();
const PORT = parseInt(process.env.API_PORT || '3000', 10);

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(morgan('dev'));
app.use(express.json());
app.use(express.text({ type: 'text/csv', limit: '2mb' }));  // for CSV batch imports
app.use(express.urlencoded({ extended: false }));   // for nginx-rtmp form hooks

// ── Health ────────────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/auth',        authRoutes);
app.use('/api/stream-keys', streamKeyRoutes);
app.use('/api/streams',     streamRoutes);
app.use('/api/recordings',  recordingRoutes);
app.use('/api/admin',       adminRoutes);
app.use('/api/users',       userRoutes);

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ error: 'Not found' }));

// ── Error handler ─────────────────────────────────────────────────────────────
app.use(errorHandler);

// ── Startup security checks ───────────────────────────────────────────────────
const WEAK_KEYS = new Set(['change_me_in_production', 'secret', 'admin', 'password', '']);
if (require.main === module) {
  const adminKey = process.env.ADMIN_API_KEY || '';
  if (!adminKey || WEAK_KEYS.has(adminKey.toLowerCase())) {
    console.warn('[SECURITY] WARNING: ADMIN_API_KEY is not set or is a weak default value.');
    console.warn('[SECURITY] Set a strong, random ADMIN_API_KEY in your .env file before production use.');
  }
}

// ── Start ─────────────────────────────────────────────────────────────────────
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`[API] listening on port ${PORT}`);
  });
}

module.exports = app;
