'use strict';

const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db/database');

// ── Key generators ────────────────────────────────────────────────────────────

const SHORT_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const SHORT_LENGTH = 5;

/**
 * Generate a unique key.
 * type "short" → 5-char [A-Z0-9]  (easy to type into OBS)
 * type "uuid"  → 32-char hex UUID  (higher entropy)
 */
function generateKey(type = 'short') {
  const db     = getDb();
  const exists = db.prepare('SELECT 1 FROM stream_keys WHERE key = ?');

  for (let attempt = 0; attempt < 10; attempt++) {
    const key = type === 'uuid'
      ? uuidv4().replace(/-/g, '')
      : Array.from({ length: SHORT_LENGTH },
          () => SHORT_CHARS[Math.floor(Math.random() * SHORT_CHARS.length)]
        ).join('');

    if (!exists.get(key)) return key;
  }
  throw Object.assign(new Error('Failed to generate a unique key, try again'), { status: 500 });
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

function listKeys() {
  return getDb()
    .prepare('SELECT id, key, name, description, is_active, created_at FROM stream_keys ORDER BY created_at DESC')
    .all();
}

function getKey(key) {
  return getDb()
    .prepare('SELECT id, key, name, description, is_active, created_at FROM stream_keys WHERE key = ?')
    .get(key) || null;
}

function createKey({ name, description = '', type = 'short' }) {
  if (!name || typeof name !== 'string' || name.trim() === '') {
    throw new Error('name is required');
  }
  if (type !== 'short' && type !== 'uuid') {
    throw Object.assign(new Error('`type` must be "short" or "uuid"'), { status: 400 });
  }
  const key = generateKey(type);
  getDb()
    .prepare('INSERT INTO stream_keys (key, name, description) VALUES (?, ?, ?)')
    .run(key, name.trim(), description);
  return getKey(key);
}

function updateKey(key, { name, description, is_active }) {
  const row = getKey(key);
  if (!row) return null;

  const newName   = name        !== undefined ? name.trim()          : row.name;
  const newDesc   = description !== undefined ? description           : row.description;
  const newActive = is_active   !== undefined ? (is_active ? 1 : 0)  : row.is_active;

  getDb()
    .prepare('UPDATE stream_keys SET name=?, description=?, is_active=? WHERE key=?')
    .run(newName, newDesc, newActive, key);

  return getKey(key);
}

function deleteKey(key) {
  const result = getDb().prepare('DELETE FROM stream_keys WHERE key = ?').run(key);
  return result.changes > 0;
}

function validateKey(key) {
  const row = getDb()
    .prepare('SELECT is_active FROM stream_keys WHERE key = ?')
    .get(key);
  return row !== undefined && row.is_active === 1;
}

// ── Batch ─────────────────────────────────────────────────────────────────────

/**
 * createKeysBatch(rows, type?)
 * rows: Array of { name, description? }
 * type: "short" (default) | "uuid"
 * Returns: { created: StreamKey[], errors: { index, name?, error }[] }
 */
function createKeysBatch(rows, type = 'short') {
  if (!Array.isArray(rows) || rows.length === 0) {
    throw Object.assign(new Error('`keys` must be a non-empty array'), { status: 400 });
  }
  if (rows.length > 500) {
    throw Object.assign(new Error('Batch size must not exceed 500 stream keys'), { status: 400 });
  }
  if (type !== 'short' && type !== 'uuid') {
    throw Object.assign(new Error('`type` must be "short" or "uuid"'), { status: 400 });
  }

  const db      = getDb();
  const created = [];
  const errors  = [];

  const insert = db.prepare('INSERT INTO stream_keys (key, name, description) VALUES (?, ?, ?)');
  const select = db.prepare('SELECT id, key, name, description, is_active, created_at FROM stream_keys WHERE key = ?');

  db.transaction(() => {
    rows.forEach((row, i) => {
      try {
        if (!row.name || typeof row.name !== 'string' || row.name.trim() === '') {
          throw Object.assign(new Error('`name` is required'), { status: 400 });
        }
        const key  = generateKey(type);
        const desc = typeof row.description === 'string' ? row.description : '';
        insert.run(key, row.name.trim(), desc);
        created.push(select.get(key));
      } catch (err) {
        errors.push({ index: i, name: row.name, error: err.message });
      }
    });
  })();

  return { created, errors };
}

/**
 * generateKeys(count, prefix?, type?)
 * Quickly create `count` keys named "<prefix>-01", "<prefix>-02", …
 * type: "short" (default) | "uuid"
 */
function generateKeys(count, prefix = 'OBS', type = 'short') {
  if (!Number.isInteger(count) || count < 1 || count > 500) {
    throw Object.assign(new Error('`count` must be an integer between 1 and 500'), { status: 400 });
  }
  if (typeof prefix !== 'string' || prefix.trim() === '') {
    throw Object.assign(new Error('`prefix` must be a non-empty string'), { status: 400 });
  }
  if (type !== 'short' && type !== 'uuid') {
    throw Object.assign(new Error('`type` must be "short" or "uuid"'), { status: 400 });
  }

  const pad  = String(count).length;
  const rows = Array.from({ length: count }, (_, i) => ({
    name: `${prefix.trim()}-${String(i + 1).padStart(Math.max(pad, 2), '0')}`,
  }));
  return createKeysBatch(rows, type);
}

module.exports = {
  listKeys, getKey, createKey, updateKey, deleteKey, validateKey,
  createKeysBatch, generateKeys,
};
