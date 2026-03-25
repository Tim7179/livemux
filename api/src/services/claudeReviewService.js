'use strict';

const SYSTEM_PROMPT = `You are a senior security and code quality reviewer specializing in Node.js, nginx, and streaming server infrastructure.

When reviewing code, focus on:
1. **Security vulnerabilities** – injection, path traversal, authentication bypasses, insecure defaults, secrets in code
2. **Code quality** – correctness, error handling, edge cases, potential crashes
3. **Performance** – inefficient patterns, memory leaks, blocking operations
4. **nginx/RTMP specifics** – configuration correctness, HLS settings, hook security
5. **Node.js/Express specifics** – middleware order, async error handling, input validation

Format your response as:
## Summary
Brief overall assessment (2-3 sentences).

## Issues Found
List each issue with severity (🔴 Critical / 🟠 High / 🟡 Medium / 🟢 Low):
- **[Severity] Issue title**: Description and recommendation.

## Positive Aspects
What is done well.

## Recommendations
Prioritized list of suggested improvements.

Be concise and actionable. If no issues are found, say so clearly.`;

async function reviewCode({ content, filename = 'code', context = '' }) {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw Object.assign(
      new Error('ANTHROPIC_API_KEY is not configured on this server'),
      { status: 503 }
    );
  }

  // Lazy-require so the service stays testable without the SDK installed
  const sdk = require('@anthropic-ai/sdk');
  // The SDK may export the class directly or under `.default` (ESM interop)
  const AnthropicClass = (sdk && sdk.default) ? sdk.default : sdk;
  const client = new AnthropicClass();

  const userMessage = [
    context ? `**Context:** ${context}\n` : '',
    `**File:** \`${filename}\``,
    '```',
    content,
    '```',
  ].filter(Boolean).join('\n');

  const response = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 8192,
    thinking: { type: 'adaptive' },
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
  });

  const textBlock = response.content.find(b => b.type === 'text');
  return {
    review: textBlock ? textBlock.text : '',
    model: response.model,
    usage: response.usage,
  };
}

module.exports = { reviewCode };
