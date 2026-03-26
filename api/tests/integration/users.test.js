'use strict';

process.env.DB_PATH       = ':memory:';
process.env.ADMIN_API_KEY = 'users-test-key';

const request = require('supertest');
const app     = require('../../src/app');

const AUTH = { 'X-Admin-Key': 'users-test-key' };

describe('GET /api/users', () => {
  it('returns 401 without admin key', async () => {
    const res = await request(app).get('/api/users');
    expect(res.status).toBe(401);
  });

  it('returns empty array initially', async () => {
    const res = await request(app).get('/api/users').set(AUTH);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe('POST /api/users', () => {
  it('creates a user', async () => {
    const res = await request(app)
      .post('/api/users')
      .set(AUTH)
      .send({ username: 'testuser', email: 'test@example.com' });
    expect(res.status).toBe(201);
    expect(res.body.username).toBe('testuser');
    expect(res.body.email).toBe('test@example.com');
    expect(res.body.id).toBeGreaterThan(0);
  });

  it('returns 400 for missing username', async () => {
    const res = await request(app).post('/api/users').set(AUTH).send({});
    expect(res.status).toBe(400);
  });

  it('returns 409 for duplicate username', async () => {
    await request(app).post('/api/users').set(AUTH).send({ username: 'dupuser' });
    const res = await request(app).post('/api/users').set(AUTH).send({ username: 'dupuser' });
    expect(res.status).toBe(409);
  });
});

describe('DELETE /api/users/:id', () => {
  it('deletes an existing user', async () => {
    const create = await request(app).post('/api/users').set(AUTH).send({ username: 'todelete' });
    const res = await request(app).delete(`/api/users/${create.body.id}`).set(AUTH);
    expect(res.status).toBe(204);
  });

  it('returns 404 for non-existent user', async () => {
    const res = await request(app).delete('/api/users/999999').set(AUTH);
    expect(res.status).toBe(404);
  });
});

describe('POST /api/users/batch – JSON', () => {
  it('creates multiple users', async () => {
    const res = await request(app)
      .post('/api/users/batch')
      .set(AUTH)
      .send({ users: [{ username: 'batchA' }, { username: 'batchB', email: 'b@b.com' }] });
    expect(res.status).toBe(201);
    expect(res.body.created).toHaveLength(2);
    expect(res.body.errors).toHaveLength(0);
  });

  it('returns 207 on partial success', async () => {
    const res = await request(app)
      .post('/api/users/batch')
      .set(AUTH)
      .send({ users: [{ username: 'partialOk' }, { username: '' }] });
    expect(res.status).toBe(207);
    expect(res.body.created).toHaveLength(1);
    expect(res.body.errors).toHaveLength(1);
  });

  it('returns 400 for missing users array', async () => {
    const res = await request(app).post('/api/users/batch').set(AUTH).send({});
    expect(res.status).toBe(400);
  });
});

describe('POST /api/users/batch – CSV', () => {
  it('creates users from CSV', async () => {
    const csv = 'username,email\ncsvuser1,c1@example.com\ncsvuser2,';
    const res = await request(app)
      .post('/api/users/batch')
      .set(AUTH)
      .set('Content-Type', 'text/csv')
      .send(csv);
    expect(res.status).toBe(201);
    expect(res.body.created).toHaveLength(2);
  });

  it('returns 400 for CSV without username column', async () => {
    const csv = 'name,email\nalice,a@example.com';
    const res = await request(app)
      .post('/api/users/batch')
      .set(AUTH)
      .set('Content-Type', 'text/csv')
      .send(csv);
    expect(res.status).toBe(400);
  });
});
