'use strict';

// jest.mock is hoisted – the factory cannot close over variables defined
// in the test file. Instead, store the mock fn as a property of the mock.
jest.mock('@anthropic-ai/sdk', () => {
  const mockCreate = jest.fn();
  function MockAnthropic() {
    this.messages = { create: mockCreate };
  }
  MockAnthropic.default   = MockAnthropic;   // ESM interop path in the service
  MockAnthropic.mockCreate = mockCreate;      // accessor for test assertions
  return MockAnthropic;
});

// Retrieve the mock fn after the mock is in place
const MockSdk     = require('@anthropic-ai/sdk');
const mockCreate  = MockSdk.mockCreate;
const { reviewCode } = require('../../src/services/claudeReviewService');

beforeEach(() => {
  mockCreate.mockReset();
});

describe('claudeReviewService – reviewCode', () => {
  it('throws 503 when ANTHROPIC_API_KEY is not set', async () => {
    const savedKey = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    await expect(reviewCode({ content: 'console.log("hi")' })).rejects.toMatchObject({ status: 503 });
    if (savedKey !== undefined) process.env.ANTHROPIC_API_KEY = savedKey;
  });

  it('calls the Anthropic API and returns review text', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    mockCreate.mockResolvedValue({
      content: [{ type: 'thinking', thinking: 'thinking...' }, { type: 'text', text: '## Summary\nLooks good.' }],
      model: 'claude-opus-4-6',
      usage: { input_tokens: 100, output_tokens: 50 },
    });

    const result = await reviewCode({ content: 'const x = 1;', filename: 'test.js', context: 'test context' });

    expect(result.review).toBe('## Summary\nLooks good.');
    expect(result.model).toBe('claude-opus-4-6');
    expect(result.usage.input_tokens).toBe(100);
  });

  it('passes correct model and thinking config', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'ok' }],
      model: 'claude-opus-4-6',
      usage: { input_tokens: 10, output_tokens: 5 },
    });

    await reviewCode({ content: 'x = 1' });

    const call = mockCreate.mock.calls[0][0];
    expect(call.model).toBe('claude-opus-4-6');
    expect(call.thinking).toEqual({ type: 'adaptive' });
  });

  it('returns empty string when no text block in response', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    mockCreate.mockResolvedValue({
      content: [{ type: 'thinking', thinking: 'just thinking' }],
      model: 'claude-opus-4-6',
      usage: {},
    });

    const result = await reviewCode({ content: 'x = 1' });
    expect(result.review).toBe('');
  });
});
