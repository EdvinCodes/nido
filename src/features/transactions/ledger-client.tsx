'use client';

import { useMemo, useRef, useEffect, useOptimistic, useState, useTransition } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useLocale, useTranslations } from 'next-intl';
import {
  useQueryStates,
  parseAsString,
  parseAsArrayOf,
  parseAsInteger,
  parseAsBoolean,
} from 'nuqs';
import { toast } from 'sonner';
import { Amount, toneForKind } from '@/components/money/amount';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { deleteTransaction, restoreTransaction } from '@/features/transactions/actions';
import { useInfiniteTransactions } from '@/features/transactions/hooks';
import type { TransactionsPage } from '@/features/transactions/queries';
import type { TransactionFilters } from '@/features/transactions/schemas';
import type { TagRow, TransactionView } from '@/features/transactions/types';
import { parseLedgerFilters } from '@/features/transactions/lib/parse-ledger-filters';
import { useLedgerRealtime } from '@/features/transactions/use-ledger-realtime';
import { useSpaceContext } from '@/features/spaces/space-context';
import { useTransactionComposerOptional } from '@/features/transactions/composer-context';
import { formatMoney, money, parseMoney } from '@/lib/money';
import { cn } from '@/lib/utils';

type ListItem =
  | { type: 'header'; day: string; subtotal: number; currency: string }
  | { type: 'row'; tx: TransactionView };

function groupRows(rows: TransactionView[]): ListItem[] {
  const items: ListItem[] = [];
  const byDay = new Map<string, TransactionView[]>();
  for (const tx of rows) {
    const list = byDay.get(tx.booked_on) ?? [];
    list.push(tx);
    byDay.set(tx.booked_on, list);
  }

  for (const [day, dayRows] of byDay) {
    const currency = dayRows[0]?.currency ?? 'EUR';
    const subtotal = dayRows.reduce((sum, tx) => {
      if (tx.kind === 'expense') return sum - tx.amount_minor;
      if (tx.kind === 'income') return sum + tx.amount_minor;
      return sum;
    }, 0);
    items.push({ type: 'header', day, subtotal, currency });
    for (const tx of dayRows) {
      items.push({ type: 'row', tx });
    }
  }
  return items;
}

export function LedgerClient({
  spaceId,
  initialPage,
  initialFilters,
  tags,
}: {
  spaceId: string;
  initialPage: TransactionsPage;
  initialFilters: TransactionFilters;
  tags: TagRow[];
}) {
  const t = useTranslations('ledger');
  const tTx = useTranslations('transactions');
  const locale = useLocale();
  const { space, participantId } = useSpaceContext();
  const composer = useTransactionComposerOptional();
  const [detail, setDetail] = useState<TransactionView | null>(null);
  const [pending, startTransition] = useTransition();

  const [urlState, setUrlState] = useQueryStates({
    q: parseAsString.withDefault(''),
    kind: parseAsString.withDefault(''),
    from: parseAsString.withDefault(''),
    to: parseAsString.withDefault(''),
    tags: parseAsArrayOf(parseAsString).withDefault([]),
    min: parseAsInteger,
    max: parseAsInteger,
    shared: parseAsBoolean.withDefault(false),
    mine: parseAsBoolean.withDefault(false),
  });

  const filters: TransactionFilters = useMemo(
    () =>
      parseLedgerFilters(
        {
          q: urlState.q,
          kind: urlState.kind,
          from: urlState.from,
          to: urlState.to,
          tags: urlState.tags,
          amountMin: urlState.min,
          amountMax: urlState.max,
          shared: urlState.shared,
          mine: urlState.mine,
        },
        participantId,
      ),
    [urlState, participantId],
  );

  const queryArgs = {
    spaceId,
    filters: { ...initialFilters, ...filters },
    ...(JSON.stringify(filters) === JSON.stringify(initialFilters) ? { initialPage } : {}),
  };
  const query = useInfiniteTransactions(queryArgs);
  const highlightedIds = useLedgerRealtime(spaceId);

  const fetchedRows = useMemo(() => query.data?.pages.flatMap((p) => p.rows) ?? [], [query.data]);
  const [rows, applyOptimistic] = useOptimistic(
    fetchedRows,
    (current, pendingTx: TransactionView | null) => {
      if (!pendingTx) return current;
      if (current.some((row) => row.id === pendingTx.id)) return current;
      return [pendingTx, ...current];
    },
  );

  useEffect(() => {
    if (!composer?.optimisticTransaction) return;
    startTransition(() => {
      applyOptimistic(composer.optimisticTransaction);
    });
  }, [composer?.optimisticTransaction, applyOptimistic]);

  const items = useMemo(() => groupRows(rows), [rows]);

  const parentRef = useRef<HTMLDivElement>(null);
  // TanStack Virtual returns unstable function identities; React Compiler skips this hook.
  // eslint-disable-next-line react-hooks/incompatible-library -- required for 10k-row ledger
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => (items[index]?.type === 'header' ? 40 : 64),
    overscan: 12,
  });

  useEffect(() => {
    const [last] = virtualizer.getVirtualItems().slice(-1);
    if (!last) return;
    if (last.index >= items.length - 8 && query.hasNextPage && !query.isFetchingNextPage) {
      void query.fetchNextPage();
    }
  });

  function clearFilters(): void {
    void setUrlState({
      q: '',
      kind: '',
      from: '',
      to: '',
      tags: [],
      min: null,
      max: null,
      shared: false,
      mine: false,
    });
  }

  function onDelete(tx: TransactionView): void {
    startTransition(async () => {
      const requestId = crypto.randomUUID();
      const result = await deleteTransaction({
        spaceId,
        requestId,
        transactionId: tx.id,
      });
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      setDetail(null);
      toast(tTx('deleted'), {
        duration: 8000,
        action: {
          label: tTx('undo'),
          onClick: () => {
            void restoreTransaction({
              spaceId,
              requestId: crypto.randomUUID(),
              transactionId: tx.id,
            }).then((r) => {
              if (!r.ok) toast.error(r.error.message);
              else toast.success(tTx('restored'));
            });
          },
        },
      });
      void query.refetch();
    });
  }

  const hasFilters = Boolean(
    filters.search ||
    filters.kind ||
    filters.dateFrom ||
    filters.dateTo ||
    filters.tagIds?.length ||
    filters.amountMin != null ||
    filters.amountMax != null ||
    filters.sharedOnly ||
    filters.mineOnly,
  );

  function majorToMinorInput(value: string): number | null {
    const parsed = parseMoney(value, { locale, currency: space.base_currency });
    if (!parsed.ok) return parsed.error === 'empty' ? null : null;
    return Number(parsed.value.minor);
  }

  function minorToMajorInput(minor: number | null): string {
    if (minor == null) return '';
    return formatMoney(money(minor, space.base_currency), {
      locale,
      showCurrency: false,
    });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex flex-col gap-2 px-4 pt-4 lg:px-8">
        <div className="flex items-center justify-between gap-3">
          <h1 className="font-display text-2xl tracking-tight">{t('title')}</h1>
          <Button
            type="button"
            className="hidden lg:inline-flex"
            onClick={() => {
              composer?.openCreate();
            }}
          >
            {t('add')}
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={urlState.q}
            onChange={(e) => {
              void setUrlState({ q: e.target.value });
            }}
            placeholder={t('searchPlaceholder')}
            className="max-w-xs"
            aria-label={t('searchPlaceholder')}
          />
          <select
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
            value={urlState.kind || 'all'}
            onChange={(e) => {
              void setUrlState({
                kind: e.target.value === 'all' ? '' : e.target.value,
              });
            }}
            aria-label={t('filterKind')}
          >
            <option value="all">{t('allKinds')}</option>
            <option value="expense">{tTx('kind.expense')}</option>
            <option value="income">{tTx('kind.income')}</option>
            <option value="transfer">{tTx('kind.transfer')}</option>
          </select>
          <Input
            type="date"
            value={urlState.from}
            onChange={(e) => {
              void setUrlState({ from: e.target.value });
            }}
            aria-label={t('dateFrom')}
            className="w-auto"
          />
          <Input
            type="date"
            value={urlState.to}
            onChange={(e) => {
              void setUrlState({ to: e.target.value });
            }}
            aria-label={t('dateTo')}
            className="w-auto"
          />
          {tags.length > 0 ? (
            <select
              className="h-9 max-w-[10rem] rounded-md border border-input bg-background px-2 text-sm"
              value={urlState.tags[0] ?? ''}
              onChange={(e) => {
                const id = e.target.value;
                void setUrlState({ tags: id ? [id] : [] });
              }}
              aria-label={t('filterTags')}
            >
              <option value="">{t('allTags')}</option>
              {tags.map((tag) => (
                <option key={tag.id} value={tag.id}>
                  {tag.name}
                </option>
              ))}
            </select>
          ) : null}
          <Input
            type="text"
            inputMode="decimal"
            placeholder={t('amountMin')}
            value={minorToMajorInput(urlState.min)}
            onChange={(e) => {
              void setUrlState({ min: majorToMinorInput(e.target.value) });
            }}
            aria-label={t('amountMin')}
            className="w-24"
          />
          <Input
            type="text"
            inputMode="decimal"
            placeholder={t('amountMax')}
            value={minorToMajorInput(urlState.max)}
            onChange={(e) => {
              void setUrlState({ max: majorToMinorInput(e.target.value) });
            }}
            aria-label={t('amountMax')}
            className="w-24"
          />
          <label className="flex items-center gap-1.5 text-sm">
            <input
              type="checkbox"
              checked={urlState.shared}
              onChange={(e) => {
                void setUrlState({ shared: e.target.checked });
              }}
              className="size-4 rounded border-input"
            />
            {t('sharedOnly')}
          </label>
          <label className="flex items-center gap-1.5 text-sm">
            <input
              type="checkbox"
              checked={urlState.mine}
              onChange={(e) => {
                void setUrlState({ mine: e.target.checked });
              }}
              className="size-4 rounded border-input"
            />
            {t('mineOnly')}
          </label>
          {hasFilters ? (
            <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>
              {t('clearFilters')}
            </Button>
          ) : null}
        </div>
      </div>

      {query.isError ? (
        <div className="flex flex-col items-center gap-2 px-4 py-16 text-center">
          <p className="text-muted-foreground">{t('error')}</p>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              void query.refetch();
            }}
          >
            {t('retry')}
          </Button>
        </div>
      ) : null}

      {query.status === 'pending' && rows.length === 0 ? (
        <div className="flex flex-col gap-2 px-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : null}

      {query.status === 'success' && rows.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-4 py-16 text-center">
          <p className="font-medium">{t('emptyTitle')}</p>
          <p className="max-w-sm text-sm text-muted-foreground">{t('emptyBody')}</p>
        </div>
      ) : null}

      {rows.length > 0 ? (
        <div ref={parentRef} className="min-h-0 flex-1 overflow-auto px-2 lg:px-6">
          <div
            className="relative w-full"
            style={{ height: `${String(virtualizer.getTotalSize())}px` }}
          >
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const item = items[virtualRow.index];
              if (!item) return null;
              return (
                <div
                  key={virtualRow.key}
                  data-index={virtualRow.index}
                  ref={virtualizer.measureElement}
                  className="absolute top-0 left-0 w-full"
                  style={{ transform: `translateY(${String(virtualRow.start)}px)` }}
                >
                  {item.type === 'header' ? (
                    <div className="flex items-center justify-between px-2 py-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                      <span>
                        {new Intl.DateTimeFormat(locale, {
                          weekday: 'short',
                          day: 'numeric',
                          month: 'short',
                          timeZone: space.timezone,
                        }).format(new Date(`${item.day}T12:00:00Z`))}
                      </span>
                      <Amount
                        minor={Math.abs(item.subtotal)}
                        currency={item.currency}
                        locale={locale}
                        tone={item.subtotal < 0 ? 'expense' : item.subtotal > 0 ? 'income' : 'none'}
                        className="text-xs"
                      />
                    </div>
                  ) : (
                    <button
                      type="button"
                      className={cn(
                        'flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left transition-colors hover:bg-surface-raised',
                        highlightedIds.has(item.tx.id) && 'animate-ledger-highlight',
                      )}
                      onClick={() => {
                        setDetail(item.tx);
                      }}
                    >
                      <span
                        className="flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-medium"
                        style={{
                          backgroundColor: item.tx.category_color
                            ? `${item.tx.category_color}33`
                            : undefined,
                          color: item.tx.category_color ?? undefined,
                        }}
                        aria-hidden
                      >
                        {(item.tx.category_name ?? item.tx.kind).slice(0, 1).toUpperCase()}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">
                          {item.tx.merchant || item.tx.description || tTx(`kind.${item.tx.kind}`)}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {item.tx.category_name ?? tTx(`kind.${item.tx.kind}`)}
                          {item.tx.payer_name ? ` · ${item.tx.payer_name}` : ''}
                        </span>
                      </span>
                      <Amount
                        minor={item.tx.amount_minor}
                        currency={item.tx.currency}
                        locale={locale}
                        tone={toneForKind(item.tx.kind)}
                        className="text-sm font-medium"
                      />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          {query.isFetchingNextPage ? (
            <p className="py-3 text-center text-xs text-muted-foreground">{t('loadingMore')}</p>
          ) : null}
        </div>
      ) : null}

      <Sheet
        open={detail != null}
        onOpenChange={(open) => {
          if (!open) setDetail(null);
        }}
      >
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-xl">
          {detail ? (
            <>
              <SheetHeader>
                <SheetTitle>
                  {detail.merchant || detail.description || tTx(`kind.${detail.kind}`)}
                </SheetTitle>
              </SheetHeader>
              <div className="flex flex-col gap-4 px-1 pb-6">
                <Amount
                  minor={detail.amount_minor}
                  currency={detail.currency}
                  locale={locale}
                  tone={toneForKind(detail.kind)}
                  className="text-2xl font-medium"
                />
                <dl className="grid grid-cols-2 gap-2 text-sm">
                  <dt className="text-muted-foreground">{tTx('date')}</dt>
                  <dd>{detail.booked_on}</dd>
                  <dt className="text-muted-foreground">{tTx('category')}</dt>
                  <dd>{detail.category_name ?? '—'}</dd>
                  <dt className="text-muted-foreground">{tTx('payer')}</dt>
                  <dd>{detail.payer_name ?? '—'}</dd>
                  <dt className="text-muted-foreground">{tTx('account')}</dt>
                  <dd>{detail.account_name ?? '—'}</dd>
                </dl>
                {detail.splits.length > 0 ? (
                  <ul className="flex flex-col gap-1.5">
                    {detail.splits.map((s) => (
                      <li key={s.id} className="flex items-center justify-between text-sm">
                        <span>{s.display_name}</span>
                        <Amount
                          minor={s.owed_minor}
                          currency={detail.currency}
                          locale={locale}
                          className="text-sm"
                        />
                      </li>
                    ))}
                  </ul>
                ) : null}
                <Button
                  type="button"
                  variant="destructive"
                  disabled={pending}
                  onClick={() => {
                    onDelete(detail);
                  }}
                >
                  {tTx('delete')}
                </Button>
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
