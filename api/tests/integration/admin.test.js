'use strict';

process.env.DB_PATH       = ':memory:';
process.env.ADMIN_API_KEY = 'admin-test-key';

// jest.mock is hoisted – factory cannot close over file-scope vars.
jest.mock('@anthropic-ai/sdk', () => {
  const mockCreate = jest.fn();
  function MockAnthropic() {
    this.messages = { create: mockCreate };
  }
  MockAnthropic.default    = MockAnthropic;
  MockAnthropic.mockCreate = mockCreate;
  return MockAnthropic;
});

const MockSdk   = require('@anthropic-ai/sdk');
const mockCreate = MockSdk.mockCreate;
const request   = require('supertest');
const app       = require('../../src/app');

const AUTH = { 'X-Admin-Key': 'admin-test-key' };

beforeEach(() => {
  mockCreate.mockReset();
});

describe('POST /api/admin/review – auth', () => {
  it('returns 401 without admin key', async () => {
    const res = await request(app).post('/api/admin/review').send({ content: 'x=1' });
    expect(res.status).toBe(401);
  });

  it('returns 400 for missing content', async () => {
    const res = await request(app).post('/api/admin/review').set(AUTH).send({});
    expect(res.status).toBe(400);
  });

  it('returns 400 for empty content', async () => {
    const res = await request(app).post('/api/admin/review').set(AUTH).send({ content: '  ' });
    expect(res.status).toBe(400);
  });

  it('returns 400 for content over 100k chars', async () => {
    const res = await request(app).post('/api/admin/review').set(AUTH).send({ content: 'x'.repeat(100_001) });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/admin/review – Claude integration', () => {
  it('returns 503 when ANTHROPIC_API_KEY is not set', async () => {
    const saved = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;

    const res = await request(app).post('/api/admin/review').set(AUTH).send({ content: 'const x = 1;' });
    expect(res.status).toBe(503);

    if (saved !== undefined) process.env.ANTHROPIC_API_KEY = saved;
  });

  it('returns review result from Claude', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: '## Summary\nNo issues found.' }],
      model: 'claude-opus-4-6',
      usage: { input_tokens: 200, output_tokens: 30 },
    });

    const res = await request(app)
      .post('/api/admin/review')
      .set(AUTH)
      .send({ content: 'const x = 1;', filename: 'test.js', context: 'unit test' });

    expect(res.status).toBe(200);
    expect(res.body.review).toBe('## Summary\nNo issues found.');
    expect(res.body.model).toBe('claude-opus-4-6');
  });

  it('propagates Claude API errors as 500', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    mockCreate.mockRejectedValue(new Error('Claude API error'));

    const res = await request(app)
      .post('/api/admin/review')
      .set(AUTH)
      .send({ content: 'const x = 1;' });
    expect(res.status).toBe(500);
  });
});

describe('POST /api/stream-keys/batch', () => {
  it('returns 401 without admin key', async () => {
    const res = await request(app).post('/api/stream-keys/batch').send({ keys: [{ name: 'Cam 1' }] });
    expect(res.status).toBe(401);
  });

  it('creates multiple stream keys', async () => {
    const res = await request(app)
      .post('/api/stream-keys/batch')
      .set(AUTH)
      .send({ keys: [{ name: 'Cam 1' }, { name: 'Cam 2', description: 'Garden' }] });
    expect(res.status).toBe(201);
    expect(res.body.created).toHaveLength(2);
    expect(res.body.errors).toHaveLength(0);
    res.body.created.forEach(k => {
      expect(k.key).toMatch(/^[A-Z0-9]{5}$/);
    });
  });

  it('returns 207 for partial success', async () => {
    const res = await request(app)
      .post('/api/stream-keys/batch')
      .set(AUTH)
      .send({ keys: [{ name: 'Good Key' }, { name: '' }] });
    expect(res.status).toBe(207);
    expect(res.body.created).toHaveLength(1);
    expect(res.body.errors).toHaveLength(1);
    expect(res.body.errors[0].index).toBe(1);
  });

  it('returns 400 for missing keys array', async () => {
    const res = await request(app).post('/api/stream-keys/batch').set(AUTH).send({});
    expect(res.status).toBe(400);
  });
});
