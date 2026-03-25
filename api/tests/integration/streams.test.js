'use strict';

process.env.DB_PATH       = ':memory:';
process.env.ADMIN_API_KEY = 'streams-test-key';

const request = require('supertest');
const app     = require('../../src/app');
const skSvc   = require('../../src/services/streamKeyService');

const AUTH = { 'X-Admin-Key': 'streams-test-key' };
let streamKey;

beforeAll(() => {
  streamKey = skSvc.createKey({ name: 'Stream Test' }).key;
});

describe('Streams API – integration', () => {

  describe('GET /api/streams (no active streams)', () => {
    it('returns empty array initially', async () => {
      const res = await request(app).get('/api/streams').set(AUTH);
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });
  });

  describe('Auth + stream lifecycle', () => {
    it('publish with valid key marks stream as active', async () => {
      await request(app)
        .post('/api/auth/publish')
        .send(`name=${streamKey}&addr=10.0.0.1`)
        .set('Content-Type', 'application/x-www-form-urlencoded');

      const res = await request(app).get('/api/streams').set(AUTH);
      expect(res.status).toBe(200);
      expect(res.body.some(s => s.streamKey === streamKey)).toBe(true);
    });

    it('GET /api/streams/:key shows stream as active', async () => {
      const res = await request(app).get(`/api/streams/${streamKey}`).set(AUTH);
      expect(res.status).toBe(200);
      expect(res.body.active).toBe(true);
    });

    it('publish-done marks stream as inactive', async () => {
      await request(app)
        .post('/api/auth/publish-done')
        .send(`name=${streamKey}`)
        .set('Content-Type', 'application/x-www-form-urlencoded');

      const res = await request(app).get('/api/streams').set(AUTH);
      expect(res.body.some(s => s.streamKey === streamKey)).toBe(false);
    });

    it('GET /api/streams/:key shows history after stream ends', async () => {
      const res = await request(app).get(`/api/streams/${streamKey}`).set(AUTH);
      expect(res.body.active).toBe(false);
      expect(res.body.history.length).toBeGreaterThan(0);
    });
  });

  describe('Security', () => {
    it('returns 401 on GET /api/streams without key', async () => {
      const res = await request(app).get('/api/streams');
      expect(res.status).toBe(401);
    });

    it('returns 401 on GET /api/streams with wrong key', async () => {
      const res = await request(app).get('/api/streams').set('X-Admin-Key', 'wrongkey');
      expect(res.status).toBe(401);
    });
  });
});

describe('Health endpoint', () => {
  it('GET /api/health returns ok', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});

describe('404 handler', () => {
  it('returns 404 for unknown routes', async () => {
    const res = await request(app).get('/api/nonexistent');
    expect(res.status).toBe(404);
  });
});
