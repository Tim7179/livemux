'use strict';

process.env.DB_PATH = ':memory:';

const svc = require('../../src/services/recordingService');

// Ensure DB initialised
beforeAll(() => svc.listRecordings());

describe('recordingService – path traversal protection', () => {
  const BAD = [
    '../etc/passwd',
    '../../secrets',
    '/etc/shadow',
    'foo/bar.mp4',
    'foo\\bar.mp4',
    'file\0name.mp4',
    '..\\windows\\system32',
    '%2e%2e%2fetc',   // URL-encoded (treated as literal filename, still has special chars)
  ];

  BAD.forEach((name) => {
    it(`rejects filename: "${name}"`, () => {
      expect(() => svc.assertSafeFilename(name)).toThrow();
    });
  });

  const GOOD = [
    'abc123.mp4',
    'stream-20240101-120000.mp4',
    'my_stream-key.flv',
    'recording.2024.01.01.mp4',
  ];

  GOOD.forEach((name) => {
    it(`accepts filename: "${name}"`, () => {
      expect(() => svc.assertSafeFilename(name)).not.toThrow();
    });
  });
});

describe('recordingService – registerRecording', () => {
  it('stores a recording with default status "ready"', () => {
    svc.registerRecording('streamkey1', 'test-20240101-120000.mp4');
    const list = svc.listRecordings();
    const rec = list.find(r => r.filename === 'test-20240101-120000.mp4');
    expect(rec).toBeDefined();
    expect(rec.status).toBe('ready');
    expect(rec.stream_key).toBe('streamkey1');
  });

  it('stores a recording with status "failed"', () => {
    svc.registerRecording('streamkey1', 'failed-20240101-130000.flv', 'failed');
    const list = svc.listRecordings();
    const rec = list.find(r => r.filename === 'failed-20240101-130000.flv');
    expect(rec).toBeDefined();
    expect(rec.status).toBe('failed');
  });

  it('rejects path-traversal filenames', () => {
    expect(() => svc.registerRecording('key', '../etc/passwd')).toThrow();
  });
});

describe('recordingService – deleteRecording path safety', () => {
  it('throws on path traversal attempt', () => {
    expect(() => svc.deleteRecording('../etc/passwd')).toThrow();
  });

  it('throws on absolute path', () => {
    expect(() => svc.deleteRecording('/etc/shadow')).toThrow();
  });

  it('returns false for safe but nonexistent filename', () => {
    // Safe filename, but not in DB → should return false (not found)
    const result = svc.deleteRecording('nonexistent-file.mp4');
    expect(result).toBe(false);
  });
});
