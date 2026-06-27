import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { z } from 'zod';

export const prerender = false;

const chatRequestSchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(['user', 'assistant', 'model', 'system']),
      content: z.string(),
    })
  ).min(1),
});

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const parseResult = chatRequestSchema.safeParse(body);
    
    if (!parseResult.success) {
      return new Response(JSON.stringify({ error: 'Invalid request format', details: parseResult.error.errors }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { messages } = parseResult.data;
    const lastUserMessage = messages[messages.length - 1]?.content || '';

    // 1. Context Injection: Query Astro Starlight's content collection
    const docs = await getCollection('docs');
    const contextString = docs
      .map((doc) => `--- FILE: ${doc.id} (slug: ${doc.slug}) ---\nTitle: ${doc.data.title}\nDescription: ${doc.data.description || ''}\nContent:\n${doc.body}`)
      .join('\n\n');

    // 2. Token Strategy: Exploit GLM-5.2's 1M-token window by injecting complete content collections
    const systemInstruction = `You are GLM-5.2, the built-in AI architecture companion for the SOTA Docs-as-Code Engine.
You have direct access to the entire documentation repository of this workspace (which has been injected below).
Utilize the complete context to provide architectural guidance, answer queries accurately, and explain systems diagrams or ADRs.

Here is the complete documentation context:
${contextString}

Provide high-fidelity responses. When the user asks about diagrams, walk them through the flows step-by-step.`;


    const apiKey = process.env.GEMINI_API_KEY || process.env.GLM_API_KEY;

    if (!apiKey) {
      // Graceful fallback: Stream a simulated typing response if no API key is set
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          const simulatedText = `[Simulated GLM-5.2 Response (No GEMINI_API_KEY set)]\n\nI have loaded the documentation containing ${docs.length} active files. Here is what I found regarding your query:\n\n1. **Context Ingested**: Natively ingested ${docs.length} files into my 1M-token context window.\n2. **Query Received**: "${lastUserMessage}"\n\nTo connect me to a live Gemini model, please configure the \`GEMINI_API_KEY\` or \`GLM_API_KEY\` environment variable. Let me know how else I can assist you with this Docs-as-Code project!`;
          
          const words = simulatedText.split(' ');
          for (const word of words) {
            const chunk = word + ' ';
            controller.enqueue(encoder.encode(`0:${JSON.stringify(chunk)}\n`));
            await new Promise((r) => setTimeout(r, 35));
          }
          controller.close();
        }
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'x-vercel-ai-data-stream': 'v1',
        }
      });
    }

    // 4. API Request Construction & Streaming
    // Map LangChain messages to Gemini contents structure
    const apiContents = messages.map((m: any) => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }]
    }));

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?key=${apiKey}&alt=sse`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: apiContents,
        systemInstruction: {
          parts: [{ text: systemInstruction }]
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      return new Response(JSON.stringify({ error: `Gemini API error: ${errorText}` }), {
        status: response.status,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const reader = response.body?.getReader();
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const stream = new ReadableStream({
      async start(controller) {
        if (!reader) {
          controller.close();
          return;
        }

        let buffer = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            controller.close();
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const cleanLine = line.trim();
            if (cleanLine.startsWith('data:')) {
              const dataStr = cleanLine.slice(5).trim();
              if (dataStr === '[DONE]') continue;
              try {
                const parsed = JSON.parse(dataStr);
                const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
                if (text) {
                  // Forward content chunk in Vercel AI SDK Data Stream protocol format
                  controller.enqueue(encoder.encode(`0:${JSON.stringify(text)}\n`));
                }
              } catch (e) {
                // Ignore parse errors on incomplete chunk lines
              }
            }
          }
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'x-vercel-ai-data-stream': 'v1',
      }
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
