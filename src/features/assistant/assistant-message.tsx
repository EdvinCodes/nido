'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { UIMessage } from 'ai';
import { getToolName, isToolUIPart } from 'ai';
import { splitCitationText } from '@/features/assistant/lib/citations';
import { toolProgressLabel } from '@/features/assistant/lib/tool-labels';
import {
  extractModelFromUiMessage,
  extractTextFromUiMessage,
} from '@/features/assistant/lib/message-mapper';
import { route } from '@/lib/routes';
import { cn } from '@/lib/utils';

function AssistantMarkdown({ text, spaceId }: { text: string; spaceId: string }) {
  const parts = splitCitationText(text, spaceId);
  return (
    <div className="text-sm leading-relaxed whitespace-pre-wrap">
      {parts.map((part, index) => {
        if (part.kind === 'text') {
          return <span key={index}>{part.value}</span>;
        }
        return (
          <Link
            key={index}
            href={route(part.href)}
            className="mx-0.5 inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary hover:bg-primary/15"
          >
            {part.label}
          </Link>
        );
      })}
    </div>
  );
}

export function AssistantMessage({ message, spaceId }: { message: UIMessage; spaceId: string }) {
  const t = useTranslations('assistant.panel');

  if (message.role === 'user') {
    const text = extractTextFromUiMessage(message);
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl bg-primary px-3 py-2 text-sm text-primary-foreground">
          {text}
        </div>
      </div>
    );
  }

  const textParts = message.parts.filter((part) => part.type === 'text');
  const toolParts = message.parts.filter((part) => isToolUIPart(part));
  const model = extractModelFromUiMessage(message);

  return (
    <div className="space-y-2">
      {toolParts.map((part) => {
        if (!isToolUIPart(part)) return null;
        const label = toolProgressLabel(getToolName(part));
        const stateLabel =
          part.state === 'output-available'
            ? `${label}… done`
            : part.state === 'output-error'
              ? `${label}… failed`
              : `${label}…`;
        return (
          <p key={part.toolCallId} className="text-xs text-muted-foreground">
            {stateLabel}
          </p>
        );
      })}
      {textParts.map((part, index) => (
        <AssistantMarkdown key={index} text={part.text} spaceId={spaceId} />
      ))}
      {model ? <p className="text-[11px] text-muted-foreground">{t('footer', { model })}</p> : null}
    </div>
  );
}

export function AssistantTypingIndicator({ className }: { className?: string }) {
  const t = useTranslations('assistant.panel');
  return (
    <p className={cn('text-sm text-muted-foreground', className)} aria-live="polite">
      {t('thinking')}
    </p>
  );
}
