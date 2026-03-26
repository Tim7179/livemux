'use strict';

process.env.DB_PATH       = ':memory:';
process.env.ADMIN_API_KEY = 'rec-test-key';
process.env.INTERNAL_TOKEN = 'internal-secret';

const request = require('supertest');
const app     = require('../../src/app');

const AUTH     = { 'X-Admin-Key': 'rec-test-key' };
const INTERNAL = { 'X-Internal-Token': 'internal-secret' };

describe('POST /api/recordings/notify (internal hook)', () => {
  it('registers an mp4 recording with status=ready', async () => {
    const res = await request(app)
      .post('/api/recordings/notify')
      .set(INTERNAL)
      .send('name=abc123&path=/recordings/abc123-20240101-120000.mp4&status=ready')
      .set('Content-Type', 'application/x-www-form-urlencoded');
    expect(res.status).toBe(200);
  });

  it('registers a failed recording', async () => {
    const res = await request(app)
      .post('/api/recordings/notify')
      .set(INTERNAL)
      .send('name=abc123&path=/recordings/abc123-fail.flv&orig=abc123-fail.flv&status=failed')
      .set('Content-Type', 'application/x-www-form-urlencoded');
    expect(res.status).toBe(200);
  });

  it('returns 403 without internal token', async () => {
    const res = await request(app)
      .post('/api/recordings/notify')
      .send('name=abc&path=/recordings/abc.mp4&status=ready')
      .set('Content-Type', 'application/x-www-form-urlencoded');
    expect(res.status).toBe(403);
  });

  it('returns 403 with wrong internal token', async () => {
    const res = await request(app)
      .post('/api/recordings/notify')
      .set('X-Internal-Token', 'wrongtoken')
      .send('name=abc&path=/recordings/abc.mp4&status=ready')
      .set('Content-Type', 'application/x-www-form-urlencoded');
    expect(res.status).toBe(403);
  });
});

describe('GET /api/recordings', () => {
  it('lists recordings with status field', async () => {
    const res = await request(app).get('/api/recordings').set(AUTH);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    // All recordings registered above should be present
    const mp4 = res.body.find(r => r.filename === 'abc123-20240101-120000.mp4');
    expect(mp4).toBeDefined();
    expect(mp4.status).toBe('ready');
    const failed = res.body.find(r => r.filename === 'abc123-fail.flv');
    expect(failed).toBeDefined();
    expect(failed.status).toBe('failed');
  });

  it('returns 401 without admin key', async () => {
    const res = await request(app).get('/api/recordings');
    expect(res.status).toBe(401);
  });
});

describe('DELETE /api/recordings – path traversal protection', () => {
  it('returns 400 for path traversal attempt (../)', async () => {
    const res = await request(app)
      .delete('/api/recordings/..%2Fetc%2Fpasswd')
      .set(AUTH);
    expect(res.status).toBe(400);
  });

  it('returns 400 for absolute path attempt', async () => {
    const res = await request(app)
      .delete('/api/recordings/%2Fetc%2Fshadow')
      .set(AUTH);
    expect(res.status).toBe(400);
  });

  it('returns 404 for safe but nonexistent filename', async () => {
    const res = await request(app)
      .delete('/api/recordings/nonexistent.mp4')
      .set(AUTH);
    expect(res.status).toBe(404);
  });
});

describe('adminAuth – timing-safe comparison', () => {
  it('returns 401 for empty X-Admin-Key', async () => {
    const res = await request(app)
      .get('/api/recordings')
      .set('X-Admin-Key', '');
    expect(res.status).toBe(401);
  });

  it('returns 401 for key that is a prefix of the real key', async () => {
    const res = await request(app)
      .get('/api/recordings')
      .set('X-Admin-Key', 'rec-test');  // prefix of 'rec-test-key'
    expect(res.status).toBe(401);
  });

  it('returns 401 for key that is a superset of the real key', async () => {
    const res = await request(app)
      .get('/api/recordings')
      .set('X-Admin-Key', 'rec-test-key-extra');
    expect(res.status).toBe(401);
  });
});
