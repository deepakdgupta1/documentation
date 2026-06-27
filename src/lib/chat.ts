import { randomUUID } from 'node:crypto';
import { z, type ZodIssue } from 'zod';

export const MAX_PAYLOAD_BYTES = 32_768;
export const MAX_CONTEXT_CHARS = 100_000;

const MAX_MESSAGES = 50;
const MAX_MESSAGE_CHARS = 8_000;
const MAX_SYSTEM_CHARS = 16_000;
const MAX_PARTS = 64;

export const UI_MESSAGE_STREAM_HEADERS = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache',
  Connection: 'keep-alive',
  'x-vercel-ai-ui-message-stream': 'v1',
  'x-accel-buffering': 'no',
};

const partSchema = z.object({ type: z.string() }).passthrough();

const chatMessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'model', 'system']),
  content: z.string().max(MAX_MESSAGE_CHARS).optional(),
  parts: z.array(partSchema).max(MAX_PARTS).optional(),
}).passthrough();

export const chatRequestSchema = z.object({
  messages: z.array(chatMessageSchema).min(1).max(MAX_MESSAGES),
  system: z.string().max(MAX_SYSTEM_CHARS).optional(),
}).passthrough();

export interface DocEntry {
  id: string;
  title: string;
  description: string;
  body: string;
}

export interface NormalizedChatMessage {
  role: 'user' | 'assistant' | 'model' | 'system';
  content: string;
}

export interface ParsedChatRequest {
  messages: NormalizedChatMessage[];
  lastUserMessage: string;
  requestSystem: string;
}

export class ChatValidationError extends Error {
  constructor(readonly issues: ZodIssue[]) {
    super('Invalid request format');
    this.name = 'ChatValidationError';
  }
}

export class PayloadTooLargeError extends Error {
  constructor() {
    super('Request payload too large.');
    this.name = 'PayloadTooLargeError';
  }
}

export class MalformedJsonError extends Error {
  constructor() {
    super('Malformed JSON in request body.');
    this.name = 'MalformedJsonError';
  }
}

export async function readJsonBody(request: Request, maxBytes = MAX_PAYLOAD_BYTES): Promise<unknown> {
  const contentLength = Number(request.headers.get('content-length') || 0);
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    throw new PayloadTooLargeError();
  }

  if (!request.body) {
    throw new MalformedJsonError();
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;

    totalBytes += value.byteLength;
    if (totalBytes > maxBytes) {
      try {
        await reader.cancel();
      } catch {
        // Best-effort cancellation only.
      }
      throw new PayloadTooLargeError();
    }
    chunks.push(value);
  }

  const bodyBytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bodyBytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return JSON.parse(new TextDecoder().decode(bodyBytes));
  } catch {
    throw new MalformedJsonError();
  }
}

export function getClientIp(request: Request, clientAddress?: string): string {
  if (clientAddress) return clientAddress;

  if (process.env.TRUST_PROXY_IP_HEADERS === 'true') {
    const forwardedFor = request.headers.get('x-forwarded-for');
    if (forwardedFor) return forwardedFor.split(',')[0]?.trim() || 'unknown';

    const realIp = request.headers.get('x-real-ip');
    if (realIp) return realIp.trim();
  }

  return 'unknown';
}

export function parseChatRequestBody(body: unknown): ParsedChatRequest {
  const parseResult = chatRequestSchema.safeParse(body);

  if (!parseResult.success) {
    throw new ChatValidationError(parseResult.error.issues);
  }

  const messages = parseResult.data.messages
    .map((message) => ({
      role: message.role,
      content: extractMessageText(message).trim(),
    }))
    .filter((message) => message.content.length > 0);

  const lastUserMessage = [...messages].reverse().find((message) => message.role === 'user')?.content;

  if (!lastUserMessage) {
    throw new ChatValidationError([
      {
        code: 'custom',
        path: ['messages'],
        message: 'At least one user text message is required.',
      },
    ]);
  }

  return {
    messages,
    lastUserMessage,
    requestSystem: parseResult.data.system?.trim() || '',
  };
}

export function buildRelevantContext(docs: DocEntry[], query: string): string {
  const keywords = [...new Set(
    query.toLowerCase().split(/\W+/).filter((word) => word.length >= 3)
  )];

  if (keywords.length === 0) {
    return buildManifest(docs);
  }

  const scored = docs.map((doc) => {
    const haystack = `${doc.title} ${doc.description} ${doc.body}`.toLowerCase();
    const score = keywords.reduce((acc, keyword) => (
      acc + (haystack.includes(keyword) ? 1 : 0)
    ), 0);

    return { doc, score };
  });

  scored.sort((a, b) => b.score - a.score);

  let totalChars = 0;
  const chunks: string[] = [];

  for (const { doc, score } of scored) {
    if (score === 0) continue;

    const chunk = `--- FILE: ${doc.id} ---\nTitle: ${doc.title}\nDescription: ${doc.description}\nContent:\n${doc.body}`;
    if (chunk.length > MAX_CONTEXT_CHARS || totalChars + chunk.length > MAX_CONTEXT_CHARS) {
      continue;
    }

    chunks.push(chunk);
    totalChars += chunk.length;
  }

  return chunks.length > 0 ? chunks.join('\n\n') : buildManifest(docs);
}

export function toGeminiContents(messages: NormalizedChatMessage[]) {
  return messages
    .filter((message) => message.role !== 'system')
    .map((message) => ({
      role: message.role === 'user' ? 'user' : 'model',
      parts: [{ text: message.content }],
    }));
}

export function getSystemMessages(messages: NormalizedChatMessage[]): string {
  return messages
    .filter((message) => message.role === 'system')
    .map((message) => message.content)
    .join('\n\n');
}

export function formatUiMessageSse(chunk: Record<string, unknown> | '[DONE]'): string {
  const payload = chunk === '[DONE]' ? '[DONE]' : JSON.stringify(chunk);
  return `data: ${payload}\n\n`;
}

export function createTextStreamIds() {
  return {
    messageId: `msg_${randomUUID()}`,
    textId: `txt_${randomUUID()}`,
  };
}

function extractMessageText(message: z.infer<typeof chatMessageSchema>): string {
  if (typeof message.content === 'string') return message.content;

  return (message.parts ?? [])
    .map((part) => {
      if (part.type !== 'text') return '';
      const text = (part as { text?: unknown }).text;
      return typeof text === 'string' ? text : '';
    })
    .join('');
}

function buildManifest(docs: DocEntry[]): string {
  return docs
    .map((doc) => `- ${doc.id}: ${doc.title}`)
    .join('\n');
}
