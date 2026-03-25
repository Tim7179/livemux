'use strict';

process.env.DB_PATH = ':memory:';

const svc = require('../../src/services/streamService');
const skSvc = require('../../src/services/streamKeyService');

// Seed a stream key for session FK
let testKey;
beforeAll(() => {
  skSvc.listKeys(); // init DB
  testKey = skSvc.createKey({ name: 'Test Stream' }).key;
});

describe('streamService – in-memory active tracking', () => {
  it('marks a stream as active', () => {
    svc.markActive(testKey, '127.0.0.1');
    expect(svc.isActive(testKey)).toBe(true);
  });

  it('returns active streams list', () => {
    const list = svc.getActiveStreams();
    expect(list.some(s => s.streamKey === testKey)).toBe(true);
  });

  it('marks a stream as inactive', () => {
    svc.markInactive(testKey);
    expect(svc.isActive(testKey)).toBe(false);
  });

  it('active streams list is empty after all are marked inactive', () => {
    expect(svc.getActiveStreams()).toHaveLength(0);
  });
});

describe('streamService – session persistence', () => {
  it('creates a session', () => {
    const id = svc.startSession(testKey, '10.0.0.1');
    expect(typeof id).toBe('number');
    expect(id).toBeGreaterThan(0);
  });

  it('retrieves session history', () => {
    const history = svc.getSessionHistory(testKey);
    expect(Array.isArray(history)).toBe(true);
    expect(history.length).toBeGreaterThan(0);
    expect(history[0].stream_key).toBe(testKey);
  });

  it('ends session (sets end_time)', () => {
    svc.endSession(testKey);
    const history = svc.getSessionHistory(testKey);
    expect(history[0].end_time).not.toBeNull();
  });
});
