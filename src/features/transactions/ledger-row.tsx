'use client';

import { Paperclip } from 'lucide-react';
import { useRef } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Amount, toneForKind } from '@/components/money/amount';
import type { TransactionView } from '@/features/transactions/types';
import { cn } from '@/lib/utils';

const LONG_PRESS_MS = 420;
const SWIPE_THRESHOLD = 72;

export function LedgerRow({
  tx,
  highlighted,
  selectionMode,
  selected,
  onOpen,
  onToggleSelect,
  onEnterSelection,
  onSwipeDelete,
  onSwipeEdit,
}: {
  tx: TransactionView;
  highlighted: boolean;
  selectionMode: boolean;
  selected: boolean;
  onOpen: () => void;
  onToggleSelect: () => void;
  onEnterSelection: () => void;
  onSwipeDelete: () => void;
  onSwipeEdit: () => void;
}) {
  const tTx = useTranslations('transactions');
  const tLedger = useTranslations('ledger');
  const locale = useLocale();
  const pointerStartX = useRef<number | null>(null);
  const dragX = useRef(0);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didLongPress = useRef(false);
  const rowRef = useRef<HTMLDivElement>(null);

  function clearLongPress(): void {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }

  function setTranslate(x: number): void {
    dragX.current = x;
    if (rowRef.current) {
      rowRef.current.style.transform = `translateX(${String(x)}px)`;
    }
  }

  return (
    <div className="relative overflow-hidden rounded-lg">
      <div
        className="pointer-events-none absolute inset-y-0 right-0 flex w-20 items-center justify-center bg-danger text-xs font-medium text-danger-foreground"
        aria-hidden
      >
        {tTx('delete')}
      </div>
      <div
        className="pointer-events-none absolute inset-y-0 left-0 flex w-20 items-center justify-center bg-primary text-xs font-medium text-primary-foreground"
        aria-hidden
      >
        {tTx('edit')}
      </div>
      <div
        ref={rowRef}
        className={cn(
          'relative touch-pan-y bg-background transition-colors',
          highlighted && 'animate-ledger-highlight',
          selected && 'bg-primary/10',
        )}
        onPointerDown={(e) => {
          if (selectionMode) return;
          // Swipe actions are touch-only — mouse drag must not soft-delete.
          if (e.pointerType !== 'touch') {
            didLongPress.current = false;
            return;
          }
          pointerStartX.current = e.clientX;
          didLongPress.current = false;
          clearLongPress();
          longPressTimer.current = setTimeout(() => {
            didLongPress.current = true;
            onEnterSelection();
          }, LONG_PRESS_MS);
        }}
        onPointerMove={(e) => {
          if (selectionMode || pointerStartX.current == null) return;
          if (e.pointerType !== 'touch') return;
          const delta = e.clientX - pointerStartX.current;
          if (Math.abs(delta) > 8) clearLongPress();
          setTranslate(Math.max(-112, Math.min(112, delta)));
        }}
        onPointerUp={() => {
          clearLongPress();
          if (pointerStartX.current == null) return;
          const delta = dragX.current;
          pointerStartX.current = null;
          setTranslate(0);
          if (didLongPress.current) return;
          if (delta <= -SWIPE_THRESHOLD) {
            onSwipeDelete();
            return;
          }
          if (delta >= SWIPE_THRESHOLD) {
            onSwipeEdit();
          }
        }}
        onPointerCancel={() => {
          clearLongPress();
          pointerStartX.current = null;
          setTranslate(0);
        }}
        onPointerLeave={() => {
          if (pointerStartX.current == null) return;
          clearLongPress();
          pointerStartX.current = null;
          setTranslate(0);
        }}
      >
        <button
          type="button"
          className="flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left transition-colors hover:bg-surface-raised"
          aria-pressed={selectionMode ? selected : undefined}
          onClick={() => {
            if (selectionMode) {
              onToggleSelect();
              return;
            }
            if (didLongPress.current) return;
            onOpen();
          }}
        >
          {selectionMode ? (
            <span
              className={cn(
                'flex size-5 shrink-0 items-center justify-center rounded border text-[10px]',
                selected
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-input bg-background',
              )}
              aria-hidden
            >
              {selected ? '✓' : ''}
            </span>
          ) : null}
          <span
            className="flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-medium"
            style={{
              backgroundColor: tx.category_color ? `${tx.category_color}33` : undefined,
              color: tx.category_color ?? undefined,
            }}
            aria-hidden
          >
            {(tx.category_name ?? tx.kind).slice(0, 1).toUpperCase()}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">
              {tx.merchant || tx.description || tTx(`kind.${tx.kind}`)}
            </span>
            <span className="block truncate text-xs text-muted-foreground">
              {tx.category_name ?? tTx(`kind.${tx.kind}`)}
              {tx.payer_name ? ` · ${tx.payer_name}` : ''}
              {tx.sync_status === 'pending' ? (
                <span className="ml-1 text-warning" data-testid="pending-sync-row">
                  · {tLedger('pendingSync')}
                </span>
              ) : null}
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-1.5">
            {(tx.attachment_count || 0) > 0 ? (
              <Paperclip
                className="size-3.5 text-muted-foreground"
                aria-label={tLedger('hasAttachment')}
              />
            ) : null}
            <Amount
              minor={tx.amount_minor}
              currency={tx.currency}
              locale={locale}
              tone={toneForKind(tx.kind)}
              className="text-sm font-medium"
            />
            <span className="sr-only">{tTx(`kind.${tx.kind}`)}</span>
          </span>
        </button>
      </div>
    </div>
  );
}
