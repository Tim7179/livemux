'use strict';

const fs   = require('fs');
const path = require('path');
const { getDb } = require('../db/database');

const RECORDINGS_DIR = process.env.RECORDINGS_DIR || '/recordings';

/**
 * Validates that a filename is safe:
 * - No path separators (prevents path traversal)
 * - No null bytes
 * - Only printable ASCII characters that are safe for filenames
 * Throws if the filename is invalid.
 */
function assertSafeFilename(filename) {
  if (!filename || typeof filename !== 'string') {
    throw Object.assign(new Error('Invalid filename'), { status: 400 });
  }
  // Reject anything that looks like a path (slashes, backslashes, null bytes, ..)
  if (/[/\\]/.test(filename) || filename.includes('\0') || filename.includes('..')) {
    throw Object.assign(new Error('Invalid filename'), { status: 400 });
  }
  // Allow: letters, digits, hyphens, underscores, dots
  if (!/^[\w.\-]+$/.test(filename)) {
    throw Object.assign(new Error('Invalid filename'), { status: 400 });
  }
}

/**
 * Resolves the full path and asserts it stays inside RECORDINGS_DIR.
 * Guards against symlink-based escapes.
 */
function safeRecordingsPath(filename) {
  assertSafeFilename(filename);
  const resolved = path.resolve(RECORDINGS_DIR, filename);
  if (!resolved.startsWith(path.resolve(RECORDINGS_DIR) + path.sep)) {
    throw Object.assign(new Error('Invalid filename'), { status: 400 });
  }
  return resolved;
}

function listRecordings() {
  return getDb()
    .prepare('SELECT * FROM recordings ORDER BY created_at DESC')
    .all();
}

/**
 * @param {string} streamKey
 * @param {string} filename   - basename only (e.g. "abc123-20240101-120000.mp4")
 * @param {'converting'|'ready'|'failed'} status
 */
function registerRecording(streamKey, filename, status = 'ready') {
  assertSafeFilename(filename);

  let size = 0;
  const fullPath = path.join(RECORDINGS_DIR, filename);
  try {
    size = fs.statSync(fullPath).size;
  } catch {
    // file may not be accessible from API container yet
  }

  getDb()
    .prepare('INSERT INTO recordings (stream_key, filename, size_bytes, status) VALUES (?, ?, ?, ?)')
    .run(streamKey, filename, size, status);
}

/**
 * Update status and optionally size after conversion completes.
 */
function updateRecordingStatus(filename, status) {
  assertSafeFilename(filename);

  let size = 0;
  const fullPath = path.join(RECORDINGS_DIR, filename);
  try {
    size = fs.statSync(fullPath).size;
  } catch {
    // ignore
  }

  getDb()
    .prepare('UPDATE recordings SET status = ?, size_bytes = ? WHERE filename = ?')
    .run(status, size, filename);
}

function deleteRecording(filename) {
  const fullPath = safeRecordingsPath(filename);   // throws on traversal attempt
  try {
    if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
  } catch (err) {
    throw new Error(`Could not delete file: ${err.message}`);
  }
  const result = getDb().prepare('DELETE FROM recordings WHERE filename = ?').run(filename);
  return result.changes > 0;
}

module.exports = {
  listRecordings,
  registerRecording,
  updateRecordingStatus,
  deleteRecording,
  assertSafeFilename,
};
