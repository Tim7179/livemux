'use strict';

const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db/database');

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

function createKey({ name, description = '' }) {
  if (!name || typeof name !== 'string' || name.trim() === '') {
    throw new Error('name is required');
  }
  const key = uuidv4().replace(/-/g, '');
  getDb()
    .prepare('INSERT INTO stream_keys (key, name, description) VALUES (?, ?, ?)')
    .run(key, name.trim(), description);
  return getKey(key);
}

function updateKey(key, { name, description, is_active }) {
  const row = getKey(key);
  if (!row) return null;

  const newName       = name        !== undefined ? name.trim()   : row.name;
  const newDesc       = description !== undefined ? description    : row.description;
  const newActive     = is_active   !== undefined ? (is_active ? 1 : 0) : row.is_active;

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

module.exports = { listKeys, getKey, createKey, updateKey, deleteKey, validateKey };
