import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import {
  ChatValidationError,
  MalformedJsonError,
  PayloadTooLargeError,
  UI_MESSAGE_STREAM_HEADERS,
  buildRelevantContext,
  createTextStreamIds,
  formatUiMessageSse,
  getClientIp,
  getGlmCredentials,
  getSystemMessages,
  parseChatRequestBody,
  readJsonBody,
  toGlmMessages,
  type DocEntry,
} from '../../lib/chat';

export const prerender = false;

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 20;

const requestLog = new Map<string, number[]>();

const cleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [ip, timestamps] of requestLog) {
    const recent = timestamps.filter((timestamp) => now - timestamp < RATE_LIMIT_WINDOW_MS);
    if (recent.length === 0) {
      requestLog.delete(ip);
    } else {
      requestLog.set(ip, recent);
    }
  }
}, RATE_LIMIT_WINDOW_MS);

cleanupInterval.unref?.();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const timestamps = requestLog.get(ip) ?? [];
  const recent = timestamps.filter((timestamp) => now - timestamp < RATE_LIMIT_WINDOW_MS);

  recent.push(now);
  requestLog.set(ip, recent);

  return recent.length > RATE_LIMIT_MAX_REQUESTS;
}

function jsonError(message: string, status: number, headers?: HeadersInit, details?: unknown) {
  return new Response(JSON.stringify({ error: message, ...(details ? { details } : {}) }), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  });
}

function enqueueSse(
  controller: ReadableStreamDefaultController<Uint8Array>,
  encoder: TextEncoder,
  chunk: Record<string, unknown> | '[DONE]'
) {
  controller.enqueue(encoder.encode(formatUiMessageSse(chunk)));
}

function streamTextResponse(text: string, delayMs = 35): Response {
  const encoder = new TextEncoder();
  const { messageId, textId } = createTextStreamIds();
  const reasoningId = `rsn_${randomUUID()}`;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      enqueueSse(controller, encoder, { type: 'start', messageId });
      
      // Simulated reasoning stream
      enqueueSse(controller, encoder, { type: 'reasoning-start', id: reasoningId });
      enqueueSse(controller, encoder, { type: 'reasoning-delta', id: reasoningId, delta: 'Analyzing ingested architecture documents & context...' });
      if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, 250));
      enqueueSse(controller, encoder, { type: 'reasoning-delta', id: reasoningId, delta: '\nSynthesizing optimal response structure.' });
      if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, 250));
      enqueueSse(controller, encoder, { type: 'reasoning-end', id: reasoningId });

      enqueueSse(controller, encoder, { type: 'text-start', id: textId });

      const chunks = text.match(/\S+\s*/g) ?? [text];
      for (const chunk of chunks) {
        enqueueSse(controller, encoder, { type: 'text-delta', id: textId, delta: chunk });
        if (delayMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
      }

      enqueueSse(controller, encoder, { type: 'text-end', id: textId });
      enqueueSse(controller, encoder, { type: 'finish', finishReason: 'stop' });
      enqueueSse(controller, encoder, '[DONE]');
      controller.close();
    },
  });

  return new Response(stream, { headers: UI_MESSAGE_STREAM_HEADERS });
}

function streamGlmResponse(responseBody: ReadableStream<Uint8Array>): Response {
  const reader = responseBody.getReader();
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const { messageId, textId } = createTextStreamIds();
  const reasoningId = `rsn_${randomUUID()}`;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      enqueueSse(controller, encoder, { type: 'start', messageId });

      let buffer = '';
      let isReasoningActive = false;
      let isTextActive = false;

      const processLine = (line: string) => {
        const cleanLine = line.trim();
        if (!cleanLine.startsWith('data:')) return;

        const dataStr = cleanLine.slice(5).trim();
        if (!dataStr || dataStr === '[DONE]') return;

        try {
          const parsed = JSON.parse(dataStr);
          const delta = parsed.choices?.[0]?.delta;
          const reasoningContent = delta?.reasoning_content;
          const textContent = delta?.content;

          if (typeof reasoningContent === 'string' && reasoningContent.length > 0) {
            if (!isReasoningActive) {
              enqueueSse(controller, encoder, { type: 'reasoning-start', id: reasoningId });
              isReasoningActive = true;
            }
            enqueueSse(controller, encoder, { type: 'reasoning-delta', id: reasoningId, delta: reasoningContent });
          }

          if (typeof textContent === 'string' && textContent.length > 0) {
            if (isReasoningActive) {
              enqueueSse(controller, encoder, { type: 'reasoning-end', id: reasoningId });
              isReasoningActive = false;
            }
            if (!isTextActive) {
              enqueueSse(controller, encoder, { type: 'text-start', id: textId });
              isTextActive = true;
            }
            enqueueSse(controller, encoder, { type: 'text-delta', id: textId, delta: textContent });
          }
        } catch (parseErr: unknown) {
          const message = parseErr instanceof Error ? parseErr.message : String(parseErr);
          console.warn(`[chat] GLM SSE parse error: ${message}`);
        }
      };

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            processLine(line);
          }
        }

        buffer += decoder.decode();
        if (buffer.trim()) {
          processLine(buffer);
        }

        if (isReasoningActive) {
          enqueueSse(controller, encoder, { type: 'reasoning-end', id: reasoningId });
        }
        if (isTextActive) {
          enqueueSse(controller, encoder, { type: 'text-start', id: textId });
          enqueueSse(controller, encoder, { type: 'text-end', id: textId });
        }
        enqueueSse(controller, encoder, { type: 'finish', finishReason: 'stop' });
        enqueueSse(controller, encoder, '[DONE]');
        controller.close();
      } catch (streamErr: unknown) {
        const message = streamErr instanceof Error ? streamErr.message : String(streamErr);
        console.error('[chat] GLM stream error:', message);
        enqueueSse(controller, encoder, { type: 'error', errorText: 'The upstream stream ended unexpectedly.' });
        controller.close();
      } finally {
        reader.releaseLock();
      }
    },
  });

  return new Response(stream, { headers: UI_MESSAGE_STREAM_HEADERS });
}

export const POST: APIRoute = async ({ request, clientAddress }) => {
  const clientIp = getClientIp(request, clientAddress);

  if (isRateLimited(clientIp)) {
    return jsonError(
      'Too many requests. Please wait before trying again.',
      429,
      { 'Retry-After': '60' }
    );
  }

  let body: unknown;
  try {
    body = await readJsonBody(request);
  } catch (err: unknown) {
    if (err instanceof PayloadTooLargeError) {
      return jsonError(err.message, 413);
    }

    if (err instanceof MalformedJsonError) {
      return jsonError(err.message, 400);
    }

    throw err;
  }

  try {
    const { messages, lastUserMessage, requestSystem } = parseChatRequestBody(body);

    const docs = await getCollection('docs');
    const docEntries: DocEntry[] = docs.map((doc) => ({
      id: doc.id,
      title: doc.data.title,
      description: doc.data.description || '',
      body: doc.body ?? '',
    }));
    const contextString = buildRelevantContext(docEntries, lastUserMessage);
    const systemMessages = getSystemMessages(messages);
    const callerSystemContext = [requestSystem, systemMessages].filter(Boolean).join('\n\n');

    const systemInstruction = `You are GLM-5.2, the built-in AI architecture companion for the SOTA Docs-as-Code Engine.
You have access to relevant documentation from this workspace (injected below based on query relevance).
Utilize this context to provide architectural guidance, answer queries accurately, and explain system diagrams or ADRs.

${callerSystemContext ? `Additional caller/system context:\n${callerSystemContext}\n\n` : ''}Here is the relevant documentation context:
${contextString}

Provide high-fidelity responses. When the user asks about diagrams, walk them through the flows step-by-step.`;

    const { apiKey, baseUrl } = getGlmCredentials();

    if (!apiKey) {
      const simulatedText = `[Simulated GLM-5.2 Response (No GLM_API_KEY found)]

I have loaded the documentation containing ${docs.length} active files. Here is what I found regarding your query:

1. **Context Ingested**: Retrieved the most relevant docs for the current question.
2. **Query Received**: "${lastUserMessage}"

To connect me to live GLM model, configure GLM credentials in MacOS Keychain or set \`GLM_API_KEY\` environment variable.`;

      return streamTextResponse(simulatedText);
    }

    const glmMessages = [
      { role: 'system', content: systemInstruction },
      ...toGlmMessages(messages),
    ];

    const targetUrl = `${baseUrl.replace(/\/+$/, '')}/chat/completions`;

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'glm-5.2',
        messages: glmMessages,
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[chat] GLM API error (${response.status}):`, errorText.slice(0, 500));
      return jsonError('Upstream API error. Please try again later.', 502);
    }

    if (!response.body) {
      return jsonError('Upstream API returned an empty response.', 502);
    }

    return streamGlmResponse(response.body);
  } catch (err: unknown) {
    if (err instanceof ChatValidationError) {
      return jsonError('Invalid request format', 400, undefined, err.issues);
    }

    const message = err instanceof Error ? err.message : 'Internal server error';
    console.error('[chat] Unhandled error:', message);
    return jsonError('An internal error occurred.', 500);
  }
};
