import React from 'react';
import {
  AssistantRuntimeProvider,
  ThreadPrimitive,
  MessagePrimitive,
  ComposerPrimitive,
  AssistantModalPrimitive,
  AuiIf,
} from '@assistant-ui/react';
import { useChatRuntime } from '@assistant-ui/react-ai-sdk';
import { MessageSquare, X, Send, Bot, Sparkles } from 'lucide-react';

function CustomThread() {
  return (
    <ThreadPrimitive.Root className="flex h-full flex-col bg-slate-950/80 backdrop-blur-xl border border-slate-800/80 rounded-2xl overflow-hidden shadow-2xl">
      {/* Thread Header */}
      <div className="flex items-center justify-between border-b border-slate-800/80 px-4 py-3 bg-slate-900/40">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <Bot className="size-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-1.5">
              GLM-5.2 Architect
              <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded-full font-medium">Online</span>
            </h3>
            <p className="text-[10px] text-slate-400">1M Token Window Context</p>
          </div>
        </div>
        <AssistantModalPrimitive.Trigger asChild>
          <button className="text-slate-400 hover:text-slate-200 transition-colors p-1 rounded-lg hover:bg-slate-800/50 cursor-pointer">
            <X className="size-4" />
          </button>
        </AssistantModalPrimitive.Trigger>
      </div>

      {/* Messages Viewport */}
      <ThreadPrimitive.Viewport className="flex-1 overflow-y-auto px-4 py-4 space-y-4 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
        {/* Empty State */}
        <AuiIf condition={(s) => s.thread.isEmpty}>
          <div className="flex flex-col items-center justify-center h-full text-center px-4 py-8 space-y-3">
            <div className="p-3 rounded-full bg-blue-600/10 text-blue-400 border border-blue-500/20 animate-pulse">
              <Sparkles className="size-8" />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-semibold text-slate-200">Docs-as-Code Copilot</h4>
              <p className="text-xs text-slate-400 max-w-[250px]">
                I can explain our system diagram, draft ADRs, or reference the ingested OpenAPI schema.
              </p>
            </div>
            <div className="flex flex-col w-full gap-2 pt-2">
              <button
                onClick={() => {
                  /* trigger pre-filled message if needed */
                }}
                className="text-xs bg-slate-900 border border-slate-800 hover:bg-slate-800/80 text-slate-300 py-2 px-3 rounded-lg transition-all text-left cursor-pointer"
              >
                Explain the System Architecture
              </button>
            </div>
          </div>
        </AuiIf>

        {/* Message Rendering */}
        <ThreadPrimitive.Messages>
          {({ message }) => {
            const isUser = message.role === 'user';
            return (
              <MessagePrimitive.Root
                key={message.id}
                className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                {!isUser && (
                  <div className="size-7 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 flex-shrink-0 self-end mb-1">
                    <Bot className="size-4" />
                  </div>
                )}
                <div
                  className={`relative max-w-[80%] rounded-2xl px-4 py-2.5 text-sm shadow-md border ${
                    isUser
                      ? 'bg-blue-600/10 border-blue-500/30 text-slate-100 rounded-tr-none'
                      : 'bg-slate-900/60 border-slate-800 text-slate-200 rounded-tl-none'
                  }`}
                >
                  <MessagePrimitive.Content />
                </div>
              </MessagePrimitive.Root>
            );
          }}
        </ThreadPrimitive.Messages>
      </ThreadPrimitive.Viewport>

      {/* Input Composer */}
      <div className="p-3 border-t border-slate-800/80 bg-slate-950">
        <ComposerPrimitive.Root className="flex items-center gap-2 bg-slate-900/80 border border-slate-800 rounded-full px-3.5 py-1.5 focus-within:border-blue-500/50 transition-colors">
          <ComposerPrimitive.Input
            placeholder="Ask GLM-5.2..."
            className="flex-1 bg-transparent text-slate-100 text-xs focus:outline-none placeholder-slate-500 min-h-[24px] max-h-[100px] resize-none"
          />
          <ComposerPrimitive.Send asChild>
            <button className="p-1.5 rounded-full bg-blue-600 hover:bg-blue-500 text-white transition-colors duration-150 cursor-pointer disabled:opacity-50">
              <Send className="size-3.5" />
            </button>
          </ComposerPrimitive.Send>
        </ComposerPrimitive.Root>
      </div>
    </ThreadPrimitive.Root>
  );
}

export default function ChatAssistant() {
  const runtime = useChatRuntime({
    api: '/api/chat',
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <AssistantModalPrimitive.Root>
        <AssistantModalPrimitive.Anchor className="fixed right-6 bottom-6 z-50">
          <AssistantModalPrimitive.Trigger asChild>
            <button
              className="flex items-center justify-center size-12 rounded-full bg-linear-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/25 hover:shadow-indigo-500/35 hover:scale-105 active:scale-95 transition-all duration-300 cursor-pointer border border-blue-400/20"
              aria-label="Ask AI Assistant"
            >
              <MessageSquare className="size-5" />
            </button>
          </AssistantModalPrimitive.Trigger>
        </AssistantModalPrimitive.Anchor>

        <AssistantModalPrimitive.Content
          sideOffset={12}
          className="fixed right-6 bottom-20 z-50 w-[380px] h-[520px] max-w-[calc(100vw-2rem)] max-h-[calc(100vh-6rem)] animate-in slide-in-from-bottom-2 fade-in duration-200"
        >
          <CustomThread />
        </AssistantModalPrimitive.Content>
      </AssistantModalPrimitive.Root>
    </AssistantRuntimeProvider>
  );
}
