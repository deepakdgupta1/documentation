import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PayloadTooLargeError,
  formatUiMessageSse,
  getClientIp,
  parseChatRequestBody,
  readJsonBody,
  toGeminiContents,
} from '../src/lib/chat';

test('accepts AI SDK UI messages with text parts', () => {
  const parsed = parseChatRequestBody({
    id: 'thread-id',
    messages: [
      {
        id: 'm1',
        role: 'user',
        parts: [{ type: 'text', text: 'Explain the diagram' }],
      },
    ],
    trigger: 'submit-message',
    messageId: 'm1',
  });

  assert.equal(parsed.lastUserMessage, 'Explain the diagram');
  assert.deepEqual(toGeminiContents(parsed.messages), [
    { role: 'user', parts: [{ text: 'Explain the diagram' }] },
  ]);
});

test('keeps backward compatibility with legacy content messages', () => {
  const parsed = parseChatRequestBody({
    messages: [{ role: 'user', content: 'hello' }],
  });

  assert.equal(parsed.lastUserMessage, 'hello');
});

test('formats AI SDK UI message chunks as SSE JSON', () => {
  assert.equal(
    formatUiMessageSse({ type: 'text-delta', id: 'txt_1', delta: 'hello' }),
    'data: {"type":"text-delta","id":"txt_1","delta":"hello"}\n\n'
  );
  assert.equal(formatUiMessageSse('[DONE]'), 'data: [DONE]\n\n');
});

test('enforces payload size while reading streamed request bodies', async () => {
  const encoder = new TextEncoder();
  const request = new Request('http://localhost/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('{"messages":['));
        controller.enqueue(encoder.encode('"this is too large"'));
        controller.close();
      },
    }),
    duplex: 'half',
  } as RequestInit);

  await assert.rejects(() => readJsonBody(request, 10), PayloadTooLargeError);
});

test('does not trust forwarded IP headers unless explicitly enabled', () => {
  const request = new Request('http://localhost/api/chat', {
    headers: { 'x-forwarded-for': '203.0.113.10' },
  });

  assert.equal(getClientIp(request), 'unknown');
  assert.equal(getClientIp(request, '127.0.0.1'), '127.0.0.1');
});
