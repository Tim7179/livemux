'use strict';

const { getDb } = require('../db/database');

/**
 * In-memory map for real-time active stream tracking.
 * Redis is used as the durable store for cross-container visibility.
 */
const _local = new Map();

// ── Session persistence (SQLite) ────────────────────────────────────────────

function startSession(streamKey, clientIp) {
  const result = getDb()
    .prepare('INSERT INTO stream_sessions (stream_key, client_ip) VALUES (?, ?)')
    .run(streamKey, clientIp || '');
  return result.lastInsertRowid;
}

function endSession(streamKey) {
  getDb()
    .prepare("UPDATE stream_sessions SET end_time = datetime('now') WHERE stream_key = ? AND end_time IS NULL")
    .run(streamKey);
}

function getSessionHistory(streamKey, limit = 20) {
  return getDb()
    .prepare('SELECT * FROM stream_sessions WHERE stream_key = ? ORDER BY start_time DESC LIMIT ?')
    .all(streamKey, limit);
}

// ── In-memory active streams ─────────────────────────────────────────────────

function markActive(streamKey, clientIp) {
  _local.set(streamKey, {
    streamKey,
    clientIp: clientIp || '',
    startTime: new Date().toISOString(),
  });
}

function markInactive(streamKey) {
  _local.delete(streamKey);
}

function getActiveStreams() {
  return Array.from(_local.values());
}

function isActive(streamKey) {
  return _local.has(streamKey);
}

module.exports = {
  startSession,
  endSession,
  getSessionHistory,
  markActive,
  markInactive,
  getActiveStreams,
  isActive,
};
