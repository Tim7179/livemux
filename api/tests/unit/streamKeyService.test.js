'use strict';

// Use in-memory SQLite for tests
process.env.DB_PATH = ':memory:';

const svc = require('../../src/services/streamKeyService');

// Re-require db to seed fresh for each test file
beforeAll(() => {
  // DB is initialised lazily on first call – trigger it now
  svc.listKeys();
});

describe('streamKeyService', () => {
  let createdKey;

  // ── createKey ─────────────────────────────────────────────────────────────
  describe('createKey', () => {
    it('creates a key with required name', () => {
      const record = svc.createKey({ name: 'Camera 1' });
      expect(record).toMatchObject({ name: 'Camera 1', description: '', is_active: 1 });
      expect(record.key).toMatch(/^[A-Z0-9]{5}$/);  // short mode (default)
      createdKey = record.key;
    });

    it('creates a key with description', () => {
      const record = svc.createKey({ name: 'Camera 2', description: 'Main stage' });
      expect(record.description).toBe('Main stage');
    });

    it('throws when name is missing', () => {
      expect(() => svc.createKey({})).toThrow('name is required');
    });

    it('throws when name is empty string', () => {
      expect(() => svc.createKey({ name: '   ' })).toThrow('name is required');
    });

    it('generates unique keys', () => {
      const a = svc.createKey({ name: 'A' });
      const b = svc.createKey({ name: 'B' });
      expect(a.key).not.toBe(b.key);
    });

    it('creates a uuid-type key (32 hex chars)', () => {
      const record = svc.createKey({ name: 'UUID Key', type: 'uuid' });
      expect(record.key).toMatch(/^[a-f0-9]{32}$/);
    });

    it('throws for invalid type', () => {
      expect(() => svc.createKey({ name: 'X', type: 'bad' })).toThrow('`type` must be');
    });
  });

  // ── listKeys ──────────────────────────────────────────────────────────────
  describe('listKeys', () => {
    it('returns an array', () => {
      const list = svc.listKeys();
      expect(Array.isArray(list)).toBe(true);
      expect(list.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ── getKey ────────────────────────────────────────────────────────────────
  describe('getKey', () => {
    it('returns the key record', () => {
      const record = svc.getKey(createdKey);
      expect(record).not.toBeNull();
      expect(record.key).toBe(createdKey);
    });

    it('returns null for unknown key', () => {
      expect(svc.getKey('nonexistent')).toBeNull();
    });
  });

  // ── validateKey ───────────────────────────────────────────────────────────
  describe('validateKey', () => {
    it('returns true for valid active key', () => {
      expect(svc.validateKey(createdKey)).toBe(true);
    });

    it('returns false for unknown key', () => {
      expect(svc.validateKey('doesnotexist')).toBe(false);
    });

    it('returns false for disabled key', () => {
      svc.updateKey(createdKey, { is_active: 0 });
      expect(svc.validateKey(createdKey)).toBe(false);
      svc.updateKey(createdKey, { is_active: 1 }); // restore
    });
  });

  // ── updateKey ─────────────────────────────────────────────────────────────
  describe('updateKey', () => {
    it('updates name', () => {
      const updated = svc.updateKey(createdKey, { name: 'Updated Name' });
      expect(updated.name).toBe('Updated Name');
    });

    it('updates description', () => {
      const updated = svc.updateKey(createdKey, { description: 'New desc' });
      expect(updated.description).toBe('New desc');
    });

    it('disables and re-enables key', () => {
      svc.updateKey(createdKey, { is_active: 0 });
      expect(svc.getKey(createdKey).is_active).toBe(0);
      svc.updateKey(createdKey, { is_active: 1 });
      expect(svc.getKey(createdKey).is_active).toBe(1);
    });

    it('returns null for unknown key', () => {
      expect(svc.updateKey('nope', { name: 'x' })).toBeNull();
    });
  });

  // ── deleteKey ─────────────────────────────────────────────────────────────
  describe('deleteKey', () => {
    it('deletes an existing key', () => {
      const { key } = svc.createKey({ name: 'ToDelete' });
      expect(svc.deleteKey(key)).toBe(true);
      expect(svc.getKey(key)).toBeNull();
    });

    it('returns false for unknown key', () => {
      expect(svc.deleteKey('ghost')).toBe(false);
    });
  });
});
