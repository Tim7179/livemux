'use strict';

const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../../data/streaming.db');

let _db = null;

function getDb() {
  if (_db) return _db;

  _db = new Database(DB_PATH);
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');

  _db.exec(`
    CREATE TABLE IF NOT EXISTS stream_keys (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      key         TEXT    UNIQUE NOT NULL,
      name        TEXT    NOT NULL,
      description TEXT    DEFAULT '',
      is_active   INTEGER DEFAULT 1,
      created_at  TEXT    DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS stream_sessions (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      stream_key  TEXT    NOT NULL,
      client_ip   TEXT,
      start_time  TEXT    DEFAULT (datetime('now')),
      end_time    TEXT,
      FOREIGN KEY (stream_key) REFERENCES stream_keys(key) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS recordings (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      stream_key  TEXT    NOT NULL,
      filename    TEXT    NOT NULL,
      size_bytes  INTEGER DEFAULT 0,
      status      TEXT    DEFAULT 'ready',
      created_at  TEXT    DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS users (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      username   TEXT    UNIQUE NOT NULL,
      email      TEXT    UNIQUE,
      note       TEXT    DEFAULT '',
      created_at TEXT    DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  return _db;
}

function closeDb() {
  if (_db) {
    _db.close();
    _db = null;
  }
}

module.exports = { getDb, closeDb };
