'use strict';

const fs   = require('fs');
const path = require('path');
const { getDb } = require('../db/database');

const RECORDINGS_DIR = process.env.RECORDINGS_DIR || '/recordings';

function listRecordings() {
  return getDb()
    .prepare('SELECT * FROM recordings ORDER BY created_at DESC')
    .all();
}

function registerRecording(streamKey, filename) {
  let size = 0;
  const fullPath = path.join(RECORDINGS_DIR, filename);
  try {
    size = fs.statSync(fullPath).size;
  } catch {
    // file may not be accessible from API container
  }

  getDb()
    .prepare('INSERT INTO recordings (stream_key, filename, size_bytes) VALUES (?, ?, ?)')
    .run(streamKey, filename, size);
}

function deleteRecording(filename) {
  const fullPath = path.join(RECORDINGS_DIR, filename);
  try {
    if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
  } catch (err) {
    throw new Error(`Could not delete file: ${err.message}`);
  }
  const result = getDb().prepare('DELETE FROM recordings WHERE filename = ?').run(filename);
  return result.changes > 0;
}

module.exports = { listRecordings, registerRecording, deleteRecording };
