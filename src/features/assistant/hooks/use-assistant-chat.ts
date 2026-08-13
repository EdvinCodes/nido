'use client';

import {
  generateId,
  parseJsonEventStream,
  readUIMessageStream,
  uiMessageChunkSchema,
  type UIMessage,
} from 'ai';
import { useCallback, useRef, useState } from 'react';
import { createUserUiMessage, dbMessagesToUi } from '../lib/message-mapper';
import { dropLastUserTurn } from '../lib/retry-messages';
import type { AiConversationRow, AiMessageRow } from '../queries';

export type ChatStatus = 'ready' | 'submitted' | 'streaming' | 'error';

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { message?: string; error?: string };
    return body.message ?? body.error ?? `Request failed (${response.status})`;
  } catch {
    return `Request failed (${response.status})`;
  }
}

function bodyToChunkStream(
  body: ReadableStream<Uint8Array>,
): ReadableStream<import('ai').UIMessageChunk> {
  return parseJsonEventStream({ stream: body, schema: uiMessageChunkSchema }).pipeThrough(
    new TransformStream({
      transform(chunk, controller) {
        if (!chunk.success) throw chunk.error;
        controller.enqueue(chunk.value);
      },
    }),
  );
}

export function useAssistantChat({
  spaceId,
  initialConversationId,
  initialMessages = [],
  modelLabel,
}: {
  spaceId: string;
  initialConversationId?: string | null;
  initialMessages?: AiMessageRow[];
  modelLabel: string | null;
}) {
  const [messages, setMessages] = useState<UIMessage[]>(() => dbMessagesToUi(initialMessages));
  const [status, setStatus] = useState<ChatStatus>('ready');
  const [error, setError] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(
    initialConversationId ?? null,
  );
  const abortRef = useRef<AbortController | null>(null);
  const lastPromptRef = useRef<string>('');

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStatus('ready');
  }, []);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || status === 'streaming' || status === 'submitted') return;

      lastPromptRef.current = trimmed;
      setError(null);
      setStatus('submitted');

      const userMessage = createUserUiMessage(trimmed);
      setMessages((prev) => [...prev, userMessage]);

      const abortController = new AbortController();
      abortRef.current = abortController;

      try {
        const response = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            spaceId,
            conversationId: conversationId ?? undefined,
            message: trimmed,
          }),
          signal: abortController.signal,
        });

        if (!response.ok) {
          throw new Error(await readErrorMessage(response));
        }

        const convHeader = response.headers.get('X-Conversation-Id');
        if (convHeader) setConversationId(convHeader);

        if (!response.body) {
          throw new Error('Empty response body');
        }

        setStatus('streaming');
        const assistantId = generateId();
        const assistantSeed: UIMessage = {
          id: assistantId,
          role: 'assistant',
          parts: [],
          metadata: modelLabel ? { model: modelLabel } : undefined,
        };

        for await (const uiMessage of readUIMessageStream({
          message: assistantSeed,
          stream: bodyToChunkStream(response.body),
          terminateOnError: true,
        })) {
          if (abortController.signal.aborted) break;
          setMessages((prev) => [...prev.filter((m) => m.id !== assistantId), uiMessage]);
        }

        if (!abortController.signal.aborted) {
          setStatus('ready');
        }
      } catch (err) {
        if (abortController.signal.aborted) {
          setStatus('ready');
          return;
        }
        const message = err instanceof Error ? err.message : 'Request failed';
        setError(message);
        setStatus('error');
      } finally {
        abortRef.current = null;
      }
    },
    [conversationId, modelLabel, spaceId, status],
  );

  const retry = useCallback(async () => {
    if (!lastPromptRef.current) return;
    setMessages((prev) => dropLastUserTurn(prev));
    await send(lastPromptRef.current);
  }, [send]);

  const reset = useCallback((nextConversationId: string | null, rows: AiMessageRow[] = []) => {
    setConversationId(nextConversationId);
    setMessages(dbMessagesToUi(rows));
    setError(null);
    setStatus('ready');
  }, []);

  const newConversation = useCallback(() => {
    setConversationId(null);
    setMessages([]);
    setError(null);
    setStatus('ready');
  }, []);

  return {
    messages,
    status,
    error,
    conversationId,
    send,
    stop,
    retry,
    reset,
    newConversation,
  };
}

export type ConversationListItem = AiConversationRow;
