'use strict';

process.env.DB_PATH       = ':memory:';
process.env.ADMIN_API_KEY = 'integration-key';

const request = require('supertest');
const app     = require('../../src/app');

const AUTH = { 'X-Admin-Key': 'integration-key' };

describe('Stream Keys API – integration', () => {
  let keyRecord;

  // ── POST /api/stream-keys ────────────────────────────────────────────────
  describe('POST /api/stream-keys', () => {
    it('creates a stream key with name', async () => {
      const res = await request(app)
        .post('/api/stream-keys')
        .set(AUTH)
        .send({ name: 'Integration Cam', description: 'Test camera' });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ name: 'Integration Cam', description: 'Test camera', is_active: 1 });
      expect(res.body.key).toBeDefined();
      keyRecord = res.body;
    });

    it('rejects missing name', async () => {
      const res = await request(app)
        .post('/api/stream-keys')
        .set(AUTH)
        .send({});
      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    it('returns 401 without admin key', async () => {
      const res = await request(app)
        .post('/api/stream-keys')
        .send({ name: 'No Auth' });
      expect(res.status).toBe(401);
    });
  });

  // ── GET /api/stream-keys ─────────────────────────────────────────────────
  describe('GET /api/stream-keys', () => {
    it('lists all stream keys', async () => {
      const res = await request(app).get('/api/stream-keys').set(AUTH);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
    });

    it('returns 401 without admin key', async () => {
      const res = await request(app).get('/api/stream-keys');
      expect(res.status).toBe(401);
    });
  });

  // ── GET /api/stream-keys/:key ────────────────────────────────────────────
  describe('GET /api/stream-keys/:key', () => {
    it('retrieves a single key', async () => {
      const res = await request(app).get(`/api/stream-keys/${keyRecord.key}`).set(AUTH);
      expect(res.status).toBe(200);
      expect(res.body.key).toBe(keyRecord.key);
    });

    it('returns 404 for unknown key', async () => {
      const res = await request(app).get('/api/stream-keys/doesnotexist').set(AUTH);
      expect(res.status).toBe(404);
    });
  });

  // ── PATCH /api/stream-keys/:key ──────────────────────────────────────────
  describe('PATCH /api/stream-keys/:key', () => {
    it('updates the name', async () => {
      const res = await request(app)
        .patch(`/api/stream-keys/${keyRecord.key}`)
        .set(AUTH)
        .send({ name: 'Updated Cam' });
      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Updated Cam');
    });

    it('disables the key', async () => {
      const res = await request(app)
        .patch(`/api/stream-keys/${keyRecord.key}`)
        .set(AUTH)
        .send({ is_active: 0 });
      expect(res.status).toBe(200);
      expect(res.body.is_active).toBe(0);
    });

    it('returns 404 for unknown key', async () => {
      const res = await request(app)
        .patch('/api/stream-keys/ghost')
        .set(AUTH)
        .send({ name: 'x' });
      expect(res.status).toBe(404);
    });
  });

  // ── DELETE /api/stream-keys/:key ─────────────────────────────────────────
  describe('DELETE /api/stream-keys/:key', () => {
    it('deletes the key', async () => {
      const res = await request(app)
        .delete(`/api/stream-keys/${keyRecord.key}`)
        .set(AUTH);
      expect(res.status).toBe(204);
    });

    it('returns 404 after deletion', async () => {
      const res = await request(app)
        .get(`/api/stream-keys/${keyRecord.key}`)
        .set(AUTH);
      expect(res.status).toBe(404);
    });
  });
});
