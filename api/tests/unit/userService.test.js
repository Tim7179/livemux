'use strict';

process.env.DB_PATH = ':memory:';

const svc = require('../../src/services/userService');

beforeAll(() => svc.listUsers());

describe('userService – createUser validation', () => {
  it('rejects missing username', () => {
    expect(() => svc.createUser({})).toThrow();
  });

  it('rejects empty username', () => {
    expect(() => svc.createUser({ username: '   ' })).toThrow();
  });

  it('rejects username with invalid characters', () => {
    expect(() => svc.createUser({ username: 'bad name!' })).toThrow();
  });

  it('rejects invalid email', () => {
    expect(() => svc.createUser({ username: 'valid', email: 'not-an-email' })).toThrow();
  });

  it('creates a user with only username', () => {
    const u = svc.createUser({ username: 'alice' });
    expect(u).toBeDefined();
    expect(u.username).toBe('alice');
    expect(u.email).toBeNull();
    expect(u.id).toBeGreaterThan(0);
  });

  it('creates a user with email and note', () => {
    const u = svc.createUser({ username: 'bob', email: 'bob@example.com', note: 'test' });
    expect(u.email).toBe('bob@example.com');
    expect(u.note).toBe('test');
  });

  it('rejects duplicate username', () => {
    svc.createUser({ username: 'carol' });
    expect(() => svc.createUser({ username: 'carol' })).toThrow(/already exists/);
  });
});

describe('userService – getUser / deleteUser', () => {
  it('returns null for non-existent id', () => {
    expect(svc.getUser(999999)).toBeNull();
  });

  it('retrieves a created user by id', () => {
    const u = svc.createUser({ username: 'dave' });
    const found = svc.getUser(u.id);
    expect(found).toBeDefined();
    expect(found.username).toBe('dave');
  });

  it('deletes a user and returns true', () => {
    const u = svc.createUser({ username: 'eve' });
    expect(svc.deleteUser(u.id)).toBe(true);
    expect(svc.getUser(u.id)).toBeNull();
  });

  it('returns false when deleting non-existent user', () => {
    expect(svc.deleteUser(999999)).toBe(false);
  });
});

describe('userService – createUsersBatch', () => {
  it('creates multiple users at once', () => {
    const { created, errors } = svc.createUsersBatch([
      { username: 'batch1' },
      { username: 'batch2', email: 'b2@example.com' },
    ]);
    expect(created).toHaveLength(2);
    expect(errors).toHaveLength(0);
  });

  it('reports errors for invalid rows but creates valid ones', () => {
    const { created, errors } = svc.createUsersBatch([
      { username: 'batchgood' },
      { username: '' },          // invalid
      { username: 'batchgood' }, // duplicate
    ]);
    expect(created).toHaveLength(1);
    expect(errors).toHaveLength(2);
    expect(errors[0].index).toBe(1);
    expect(errors[1].index).toBe(2);
  });

  it('throws for empty array', () => {
    expect(() => svc.createUsersBatch([])).toThrow();
  });

  it('throws for batch size over 1000', () => {
    const rows = Array.from({ length: 1001 }, (_, i) => ({ username: `u${i}` }));
    expect(() => svc.createUsersBatch(rows)).toThrow(/1000/);
  });
});

describe('userService – parseCSV', () => {
  it('parses a valid CSV', () => {
    const csv = 'username,email,note\nalice,alice@example.com,admin\nbob,,viewer';
    const rows = svc.parseCSV(csv);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ username: 'alice', email: 'alice@example.com', note: 'admin' });
    expect(rows[1]).toMatchObject({ username: 'bob', email: '', note: 'viewer' });
  });

  it('throws if header missing username column', () => {
    expect(() => svc.parseCSV('name,email\nalice,a@b.com')).toThrow(/username/);
  });

  it('throws if only one line (no data rows)', () => {
    expect(() => svc.parseCSV('username')).toThrow();
  });
});
