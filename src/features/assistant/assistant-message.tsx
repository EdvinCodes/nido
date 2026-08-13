'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import type { UIMessage } from 'ai';
import { getToolName, isToolUIPart } from 'ai';
import { splitCitationText } from '@/features/assistant/lib/citations';
import { comparisonSeriesFromToolParts } from '@/features/assistant/lib/inline-chart-series';
import { AssistantInlineChart } from '@/features/assistant/assistant-inline-chart';
import { toolProgressLabel } from '@/features/assistant/lib/tool-labels';
import {
  extractModelFromUiMessage,
  extractTextFromUiMessage,
} from '@/features/assistant/lib/message-mapper';
import { route } from '@/lib/routes';
import { cn } from '@/lib/utils';

function renderInline(text: string, spaceId: string, keyPrefix: string): ReactNode[] {
  const parts = splitCitationText(text, spaceId);
  return parts.flatMap((part, index) => {
    if (part.kind === 'cite') {
      return (
        <Link
          key={`${keyPrefix}-c-${index}`}
          href={route(part.href)}
          className="mx-0.5 inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary hover:bg-primary/15"
        >
          {part.label}
        </Link>
      );
    }
    // Bold **segments**
    const chunks = part.value.split(/(\*\*[^*]+\*\*)/g);
    return chunks.map((chunk: string, chunkIndex: number) => {
      if (chunk.startsWith('**') && chunk.endsWith('**')) {
        return <strong key={`${keyPrefix}-b-${index}-${chunkIndex}`}>{chunk.slice(2, -2)}</strong>;
      }
      return <span key={`${keyPrefix}-t-${index}-${chunkIndex}`}>{chunk}</span>;
    });
  });
}

function AssistantMarkdown({ text, spaceId }: { text: string; spaceId: string }) {
  const lines = text.split('\n');
  const blocks: ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i] ?? '';
    if (line.includes('|') && line.trim().startsWith('|')) {
      const tableLines: string[] = [];
      while (i < lines.length && (lines[i] ?? '').includes('|')) {
        tableLines.push(lines[i] ?? '');
        i += 1;
      }
      const rows = tableLines
        .filter((row) => !/^\|?\s*:?-{3,}/.test(row.replace(/\|/g, '').trim() ? row : ''))
        .filter((row) => !/^[\s|:-]+$/.test(row))
        .map((row) =>
          row
            .split('|')
            .slice(1, -1)
            .map((cell) => cell.trim()),
        )
        .filter((cells) => cells.length > 0 && !cells.every((c) => /^:?-{3,}:?$/.test(c)));

      if (rows.length > 0) {
        blocks.push(
          <div key={`table-${i}`} className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <tbody>
                {rows.map((cells, rowIndex) => (
                  <tr key={rowIndex} className="border-b border-border">
                    {cells.map((cell, cellIndex) => (
                      <td key={cellIndex} className="px-2 py-1 align-top">
                        {renderInline(cell, spaceId, `tbl-${rowIndex}-${cellIndex}`)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>,
        );
      }
      continue;
    }

    blocks.push(
      <p key={`p-${i}`} className="whitespace-pre-wrap">
        {renderInline(line, spaceId, `p-${i}`)}
      </p>,
    );
    i += 1;
  }

  return <div className="space-y-2 text-sm leading-relaxed">{blocks}</div>;
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
  const chartSeries = comparisonSeriesFromToolParts(
    toolParts.map((part) => ({
      type: part.type,
      state: part.state,
      output: 'output' in part ? part.output : undefined,
    })),
  );

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
      {chartSeries ? <AssistantInlineChart series={chartSeries} /> : null}
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
