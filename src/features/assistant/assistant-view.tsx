'use client';

import {
  Download,
  MessageSquarePlus,
  RotateCcw,
  SendHorizontal,
  Square,
  Trash2,
} from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState, useTransition } from 'react';
import { AssistantMessage, AssistantTypingIndicator } from '@/features/assistant/assistant-message';
import {
  deleteConversationAction,
  exportConversationAction,
  renameConversationAction,
} from '@/features/assistant/actions';
import { useAssistantChat } from '@/features/assistant/hooks/use-assistant-chat';
import {
  buildSuggestedPrompts,
  type SuggestedPrompt,
} from '@/features/assistant/lib/suggested-prompts';
import type { AiConversationRow, AiMessageRow } from '@/features/assistant/queries';
import type { AiProviderName } from '@/lib/ai/provider-names';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { route } from '@/lib/routes';
import { cn } from '@/lib/utils';

export function AssistantView({
  spaceId,
  consentActive,
  modelLabel,
  configuredProviders = [],
  conversations,
  initialConversationId,
  initialMessages,
  suggestedContext,
  variant = 'panel',
}: {
  spaceId: string;
  consentActive: boolean;
  modelLabel: string | null;
  configuredProviders?: AiProviderName[];
  conversations: AiConversationRow[];
  initialConversationId?: string | null;
  initialMessages?: AiMessageRow[];
  suggestedContext: { hasBudgets: boolean; hasGoals: boolean; hasSubscriptions: boolean };
  variant?: 'panel' | 'page';
}) {
  const t = useTranslations('assistant.panel');
  const tHistory = useTranslations('assistant.history');
  const [input, setInput] = useState('');
  const [historyOpen, setHistoryOpen] = useState(variant === 'page');
  const [retryProvider, setRetryProvider] = useState<AiProviderName | ''>(
    configuredProviders[0] ?? '',
  );
  const [pending, startTransition] = useTransition();
  const bottomRef = useRef<HTMLDivElement>(null);

  const chat = useAssistantChat({
    spaceId,
    ...(initialConversationId !== undefined ? { initialConversationId } : {}),
    ...(initialMessages !== undefined ? { initialMessages } : {}),
    modelLabel,
  });

  const prompts = buildSuggestedPrompts(suggestedContext);
  const isBusy = chat.status === 'streaming' || chat.status === 'submitted';

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chat.messages, chat.status]);

  function submit(): void {
    const text = input.trim();
    if (!text || isBusy) return;
    setInput('');
    void chat.send(text);
  }

  function loadConversation(conversation: AiConversationRow): void {
    startTransition(async () => {
      const res = await fetch(`/api/ai/conversations/${conversation.id}?spaceId=${spaceId}`);
      if (!res.ok) return;
      const data = (await res.json()) as { messages: AiMessageRow[] };
      chat.reset(conversation.id, data.messages);
      if (variant === 'panel') setHistoryOpen(false);
    });
  }

  function handleRename(conversationId: string, title: string): void {
    startTransition(async () => {
      await renameConversationAction({ spaceId, conversationId, title });
    });
  }

  function handleDelete(conversationId: string): void {
    startTransition(async () => {
      await deleteConversationAction({ spaceId, conversationId });
      if (chat.conversationId === conversationId) {
        chat.newConversation();
      }
    });
  }

  function handleExport(conversationId: string): void {
    startTransition(async () => {
      const result = await exportConversationAction({ spaceId, conversationId });
      if (!result.ok) return;
      const blob = new Blob([result.data.markdown], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `nido-assistant-${conversationId.slice(0, 8)}.md`;
      anchor.click();
      URL.revokeObjectURL(url);
    });
  }

  if (!consentActive) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center text-sm text-muted-foreground">
        <p>{t('consentRequired')}</p>
        <Button asChild size="sm" variant="outline">
          <Link href={route(`/s/${spaceId}/settings/ai`)}>{tHistory('openSettings')}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex min-h-0 flex-1',
        variant === 'page' ? 'flex-col lg:flex-row' : 'flex-col',
      )}
    >
      {historyOpen ? (
        <aside
          className={cn(
            'flex min-h-0 flex-col border-border bg-surface',
            variant === 'page'
              ? 'w-full border-b lg:w-56 lg:border-r lg:border-b-0'
              : 'max-h-40 border-b',
          )}
        >
          <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {tHistory('title')}
            </p>
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              onClick={() => {
                chat.newConversation();
              }}
              aria-label={tHistory('new')}
            >
              <MessageSquarePlus className="size-4" />
            </Button>
          </div>
          <ul className="min-h-0 flex-1 overflow-y-auto p-2 text-sm">
            {conversations.length === 0 ? (
              <li className="px-2 py-3 text-muted-foreground">{tHistory('empty')}</li>
            ) : (
              conversations.map((conversation) => (
                <li
                  key={conversation.id}
                  className="group rounded-md px-2 py-1.5 hover:bg-muted/60"
                >
                  <button
                    type="button"
                    className="w-full text-left"
                    onClick={() => {
                      loadConversation(conversation);
                    }}
                  >
                    <span className="line-clamp-2">
                      {conversation.title ?? tHistory('untitled')}
                    </span>
                  </button>
                  <div className="mt-1 hidden gap-1 group-hover:flex">
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      aria-label={tHistory('export')}
                      onClick={() => {
                        handleExport(conversation.id);
                      }}
                    >
                      <Download className="size-3.5" />
                    </Button>
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      aria-label={tHistory('delete')}
                      onClick={() => {
                        handleDelete(conversation.id);
                      }}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </li>
              ))
            )}
          </ul>
        </aside>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setHistoryOpen((v) => !v);
              }}
            >
              {tHistory('title')}
            </Button>
            {chat.conversationId ? (
              <ConversationTitleEditor
                conversationId={chat.conversationId}
                conversations={conversations}
                onRename={handleRename}
              />
            ) : null}
          </div>
          <div className="flex items-center gap-1">
            {chat.status === 'error' ? (
              <>
                {configuredProviders.length > 1 ? (
                  <select
                    className="h-8 max-w-36 rounded-md border border-border bg-background px-2 text-xs"
                    aria-label={t('retryProvider')}
                    value={retryProvider}
                    onChange={(event) => {
                      setRetryProvider(event.target.value as AiProviderName);
                    }}
                  >
                    {configuredProviders.map((name) => {
                      const label =
                        name === 'openai'
                          ? t('provider.openai')
                          : name === 'anthropic'
                            ? t('provider.anthropic')
                            : name === 'google'
                              ? t('provider.google')
                              : t('provider.ollama');
                      return (
                        <option key={name} value={name}>
                          {label}
                        </option>
                      );
                    })}
                  </select>
                ) : null}
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => void chat.retry(retryProvider === '' ? undefined : retryProvider)}
                >
                  <RotateCcw className="size-4" />
                  {t('retry')}
                </Button>
              </>
            ) : null}
            {isBusy ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  chat.stop();
                }}
              >
                <Square className="size-4" />
                {t('stop')}
              </Button>
            ) : null}
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-3 py-4">
          {chat.messages.length === 0 ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">{t('empty')}</p>
              <div className="flex flex-wrap gap-2">
                {prompts.map((prompt: SuggestedPrompt) => (
                  <button
                    key={prompt.id}
                    type="button"
                    className="rounded-full border border-border bg-surface px-3 py-1.5 text-left text-xs hover:bg-muted/60"
                    onClick={() => void chat.send(prompt.text)}
                  >
                    {prompt.text}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            chat.messages.map((message) => (
              <AssistantMessage key={message.id} message={message} spaceId={spaceId} />
            ))
          )}
          {isBusy ? <AssistantTypingIndicator /> : null}
          {chat.error ? <p className="text-sm text-destructive">{chat.error}</p> : null}
          <div ref={bottomRef} />
        </div>

        <form
          className="flex items-end gap-2 border-t border-border p-3"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <Input
            value={input}
            onChange={(event) => {
              setInput(event.target.value);
            }}
            placeholder={t('placeholder')}
            disabled={isBusy || pending}
            className="min-h-11 flex-1"
          />
          <Button
            type="submit"
            size="icon"
            disabled={!input.trim() || isBusy || pending}
            aria-label={t('send')}
          >
            <SendHorizontal className="size-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}

function ConversationTitleEditor({
  conversationId,
  conversations,
  onRename,
}: {
  conversationId: string;
  conversations: AiConversationRow[];
  onRename: (conversationId: string, title: string) => void;
}) {
  const t = useTranslations('assistant.history');
  const current = conversations.find((c) => c.id === conversationId);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(current?.title ?? '');

  if (!editing) {
    return (
      <button
        type="button"
        className="max-w-[12rem] truncate text-sm text-muted-foreground hover:text-foreground"
        onClick={() => {
          setEditing(true);
        }}
      >
        {current?.title ?? t('untitled')}
      </button>
    );
  }

  return (
    <Input
      value={title}
      className="h-8 max-w-[12rem] text-sm"
      onChange={(event) => {
        setTitle(event.target.value);
      }}
      onBlur={() => {
        setEditing(false);
        if (title.trim()) onRename(conversationId, title.trim());
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.currentTarget.blur();
        }
      }}
    />
  );
}
