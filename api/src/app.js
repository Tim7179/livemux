'use strict';

const express      = require('express');
const morgan       = require('morgan');
const errorHandler = require('./middleware/errorHandler');

const authRoutes       = require('./routes/auth');
const streamKeyRoutes  = require('./routes/streamKeys');
const streamRoutes     = require('./routes/streams');
const recordingRoutes  = require('./routes/recordings');

const app  = express();
const PORT = parseInt(process.env.API_PORT || '3000', 10);

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(morgan('dev'));
app.use(express.json());
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

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ error: 'Not found' }));

// ── Error handler ─────────────────────────────────────────────────────────────
app.use(errorHandler);

// ── Start ─────────────────────────────────────────────────────────────────────
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`[API] listening on port ${PORT}`);
  });
}

module.exports = app;
