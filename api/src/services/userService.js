'use strict';

const { getDb } = require('../db/database');

// ── Helpers ──────────────────────────────────────────────────────────────────

function validateUsername(username) {
  if (!username || typeof username !== 'string') throw Object.assign(new Error('`username` is required'), { status: 400 });
  const trimmed = username.trim();
  if (trimmed.length === 0) throw Object.assign(new Error('`username` must not be empty'), { status: 400 });
  if (trimmed.length > 64) throw Object.assign(new Error('`username` must not exceed 64 characters'), { status: 400 });
  if (!/^[\w.\-@]+$/.test(trimmed)) throw Object.assign(new Error('`username` contains invalid characters'), { status: 400 });
  return trimmed;
}

function validateEmail(email) {
  if (email === undefined || email === null || email === '') return null;
  if (typeof email !== 'string') throw Object.assign(new Error('`email` must be a string'), { status: 400 });
  const trimmed = email.trim();
  if (trimmed.length > 254) throw Object.assign(new Error('`email` is too long'), { status: 400 });
  // Basic structural check only
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) throw Object.assign(new Error('`email` format is invalid'), { status: 400 });
  return trimmed;
}

// ── CRUD ─────────────────────────────────────────────────────────────────────

function listUsers() {
  const db = getDb();
  return db.prepare('SELECT id, username, email, note, created_at FROM users ORDER BY created_at DESC').all();
}

function getUser(id) {
  const db = getDb();
  return db.prepare('SELECT id, username, email, note, created_at FROM users WHERE id = ?').get(id) || null;
}

function getUserByUsername(username) {
  const db = getDb();
  return db.prepare('SELECT id, username, email, note, created_at FROM users WHERE username = ?').get(username) || null;
}

function createUser({ username, email, note }) {
  const db = getDb();
  const uname = validateUsername(username);
  const mail  = validateEmail(email);
  const n     = typeof note === 'string' ? note.trim().substring(0, 500) : '';

  try {
    const stmt = db.prepare('INSERT INTO users (username, email, note) VALUES (?, ?, ?)');
    const info  = stmt.run(uname, mail, n);
    return db.prepare('SELECT id, username, email, note, created_at FROM users WHERE id = ?').get(info.lastInsertRowid);
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      throw Object.assign(new Error('username or email already exists'), { status: 409 });
    }
    throw err;
  }
}

function deleteUser(id) {
  const db = getDb();
  const info = db.prepare('DELETE FROM users WHERE id = ?').run(id);
  return info.changes > 0;
}

// ── Batch creation ────────────────────────────────────────────────────────────

/**
 * createUsersBatch(rows)
 * rows: Array of { username, email?, note? }
 * Returns: { created: User[], errors: { index, username?, error }[] }
 */
function createUsersBatch(rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    throw Object.assign(new Error('`users` must be a non-empty array'), { status: 400 });
  }
  if (rows.length > 1000) {
    throw Object.assign(new Error('Batch size must not exceed 1000 users'), { status: 400 });
  }

  const db      = getDb();
  const created = [];
  const errors  = [];

  const insert = db.prepare('INSERT INTO users (username, email, note) VALUES (?, ?, ?)');
  const select = db.prepare('SELECT id, username, email, note, created_at FROM users WHERE id = ?');

  const runBatch = db.transaction(() => {
    rows.forEach((row, i) => {
      try {
        const uname = validateUsername(row.username);
        const mail  = validateEmail(row.email);
        const n     = typeof row.note === 'string' ? row.note.trim().substring(0, 500) : '';
        const info  = insert.run(uname, mail, n);
        created.push(select.get(info.lastInsertRowid));
      } catch (err) {
        errors.push({
          index: i,
          username: row.username,
          error: err.code === 'SQLITE_CONSTRAINT_UNIQUE'
            ? 'username or email already exists'
            : err.message,
        });
      }
    });
  });

  runBatch();
  return { created, errors };
}

/**
 * parseCSV(csvText)
 * Parses a CSV string with header row: username[,email][,note]
 * Returns array of objects for createUsersBatch.
 */
function parseCSV(csvText) {
  if (typeof csvText !== 'string') throw Object.assign(new Error('CSV must be a string'), { status: 400 });
  const lines = csvText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) throw Object.assign(new Error('CSV must have a header row and at least one data row'), { status: 400 });

  const header = lines[0].split(',').map(h => h.trim().toLowerCase());
  if (!header.includes('username')) throw Object.assign(new Error('CSV header must include `username` column'), { status: 400 });

  return lines.slice(1).map(line => {
    const cols = line.split(',').map(c => c.trim());
    const obj  = {};
    header.forEach((h, i) => { obj[h] = cols[i] || ''; });
    return obj;
  });
}

module.exports = { listUsers, getUser, getUserByUsername, createUser, deleteUser, createUsersBatch, parseCSV };
