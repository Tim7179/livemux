'use strict';

process.env.DB_PATH    = ':memory:';
process.env.ADMIN_API_KEY = 'test-admin-key';

const request = require('supertest');
const app     = require('../../src/app');
const skSvc   = require('../../src/services/streamKeyService');

let validKey;

beforeAll(() => {
  validKey = skSvc.createKey({ name: 'Auth Test' }).key;
});

describe('POST /api/auth/publish', () => {
  it('returns 200 for valid active stream key', async () => {
    const res = await request(app)
      .post('/api/auth/publish')
      .send(`name=${validKey}&addr=127.0.0.1`)
      .set('Content-Type', 'application/x-www-form-urlencoded');
    expect(res.status).toBe(200);
  });

  it('returns 403 for unknown stream key', async () => {
    const res = await request(app)
      .post('/api/auth/publish')
      .send('name=unknownkey&addr=127.0.0.1')
      .set('Content-Type', 'application/x-www-form-urlencoded');
    expect(res.status).toBe(403);
  });

  it('returns 403 for disabled stream key', async () => {
    skSvc.updateKey(validKey, { is_active: 0 });
    const res = await request(app)
      .post('/api/auth/publish')
      .send(`name=${validKey}&addr=127.0.0.1`)
      .set('Content-Type', 'application/x-www-form-urlencoded');
    expect(res.status).toBe(403);
    skSvc.updateKey(validKey, { is_active: 1 }); // restore
  });

  it('returns 400 when name is missing', async () => {
    const res = await request(app)
      .post('/api/auth/publish')
      .send('addr=127.0.0.1')
      .set('Content-Type', 'application/x-www-form-urlencoded');
    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/publish-done', () => {
  it('returns 200 for any key (no validation needed)', async () => {
    const res = await request(app)
      .post('/api/auth/publish-done')
      .send(`name=${validKey}`)
      .set('Content-Type', 'application/x-www-form-urlencoded');
    expect(res.status).toBe(200);
  });

  it('returns 200 even with empty body', async () => {
    const res = await request(app)
      .post('/api/auth/publish-done')
      .send('')
      .set('Content-Type', 'application/x-www-form-urlencoded');
    expect(res.status).toBe(200);
  });
});
