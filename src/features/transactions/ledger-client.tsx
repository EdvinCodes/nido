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
import {
  bulkDelete,
  deleteTransaction,
  duplicateTransaction,
  restoreTransaction,
} from '@/features/transactions/actions';
import { exportLedgerAction } from '@/features/imports/actions';
import { listTransactionAttachments } from '@/features/attachments/actions';
import { AttachmentGallery } from '@/features/attachments/attachment-gallery';
import type { AttachmentRow } from '@/features/attachments/queries';
import { useInfiniteTransactions } from '@/features/transactions/hooks';
import type { TransactionsPage } from '@/features/transactions/queries';
import type { TransactionFilters } from '@/features/transactions/schemas';
import type { TagRow, TransactionView } from '@/features/transactions/types';
import { parseLedgerFilters } from '@/features/transactions/lib/parse-ledger-filters';
import { LedgerRow } from '@/features/transactions/ledger-row';
import { useLedgerRealtime } from '@/features/transactions/use-ledger-realtime';
import { useOfflineOptional } from '@/features/offline/offline-provider';
import { PullToRefresh } from '@/components/mobile/pull-to-refresh';
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
  const tImport = useTranslations('import');
  const tBalances = useTranslations('balances');
  const locale = useLocale();
  const { space, participantId } = useSpaceContext();
  const composer = useTransactionComposerOptional();
  const offline = useOfflineOptional();
  const [detail, setDetail] = useState<TransactionView | null>(null);
  const [detailAttachments, setDetailAttachments] = useState<AttachmentRow[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [pending, startTransition] = useTransition();
  const selectionMode = selectedIds.size > 0;

  useEffect(() => {
    if (!detail) {
      setDetailAttachments([]);
      return;
    }
    let cancelled = false;
    void listTransactionAttachments({
      spaceId,
      transactionId: detail.id,
    }).then((result) => {
      if (!cancelled && result.ok) {
        setDetailAttachments(result.data);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [detail, spaceId]);

  const [urlState, setUrlState] = useQueryStates({
    q: parseAsString.withDefault(''),
    kind: parseAsString.withDefault(''),
    from: parseAsString.withDefault(''),
    to: parseAsString.withDefault(''),
    tags: parseAsArrayOf(parseAsString).withDefault([]),
    category: parseAsArrayOf(parseAsString).withDefault([]),
    min: parseAsInteger,
    max: parseAsInteger,
    shared: parseAsBoolean.withDefault(false),
    mine: parseAsBoolean.withDefault(false),
    attached: parseAsBoolean.withDefault(false),
    ids: parseAsArrayOf(parseAsString).withDefault([]),
    /** Legacy deep-link from receipts; migrated to `ids` on mount. */
    tx: parseAsString,
  });

  const [searchDraft, setSearchDraft] = useState(urlState.q);
  const [minDraft, setMinDraft] = useState('');
  const [maxDraft, setMaxDraft] = useState('');

  useEffect(() => {
    setSearchDraft(urlState.q);
  }, [urlState.q]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      if (searchDraft === urlState.q) return;
      void setUrlState({ q: searchDraft });
    }, 300);
    return () => {
      window.clearTimeout(handle);
    };
  }, [searchDraft, setUrlState, urlState.q]);

  useEffect(() => {
    if (!urlState.tx) return;
    if (urlState.ids.length > 0) {
      void setUrlState({ tx: null });
      return;
    }
    void setUrlState({ ids: [urlState.tx], tx: null });
  }, [setUrlState, urlState.ids.length, urlState.tx]);

  const filters: TransactionFilters = useMemo(
    () =>
      parseLedgerFilters(
        {
          q: urlState.q,
          kind: urlState.kind,
          from: urlState.from,
          to: urlState.to,
          tags: urlState.tags,
          categoryIds: urlState.category,
          amountMin: urlState.min,
          amountMax: urlState.max,
          shared: urlState.shared,
          mine: urlState.mine,
          hasAttachment: urlState.attached,
          transactionIds: urlState.ids.length > 0 ? urlState.ids : urlState.tx ? [urlState.tx] : [],
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

  const pendingRows = useMemo(
    () => (offline?.pending ?? []).map((p) => p.optimistic),
    [offline?.pending],
  );

  const mergedFetched = useMemo(() => {
    const ids = new Set(fetchedRows.map((r) => r.id));
    const extra = pendingRows.filter((r) => !ids.has(r.id));
    return [...extra, ...fetchedRows];
  }, [fetchedRows, pendingRows]);

  const [rows, applyOptimistic] = useOptimistic(
    mergedFetched,
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

  useEffect(() => {
    const onFlushed = () => {
      void query.refetch();
    };
    window.addEventListener('nido:offline-flushed', onFlushed);
    return () => {
      window.removeEventListener('nido:offline-flushed', onFlushed);
    };
  }, [query]);

  function clearFilters(): void {
    setSearchDraft('');
    setMinDraft('');
    setMaxDraft('');
    void setUrlState({
      q: '',
      kind: '',
      from: '',
      to: '',
      tags: [],
      category: [],
      min: null,
      max: null,
      shared: false,
      mine: false,
      attached: false,
      ids: [],
      tx: null,
    });
  }

  function clearSelection(): void {
    setSelectedIds(new Set());
  }

  function toggleSelected(id: string): void {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function onDelete(tx: TransactionView): void {
    void (async () => {
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
    })();
  }

  function onDuplicate(tx: TransactionView): void {
    startTransition(async () => {
      const result = await duplicateTransaction({
        spaceId,
        requestId: crypto.randomUUID(),
        transactionId: tx.id,
      });
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      toast.success(tTx('duplicated'));
      void query.refetch();
    });
  }

  function onBulkDelete(): void {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    startTransition(async () => {
      const result = await bulkDelete({ spaceId, transactionIds: ids });
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      clearSelection();
      toast(t('bulkDeleted', { count: ids.length }), {
        duration: 8000,
        action: {
          label: tTx('undo'),
          onClick: () => {
            void Promise.all(
              ids.map((transactionId) =>
                restoreTransaction({
                  spaceId,
                  requestId: crypto.randomUUID(),
                  transactionId,
                }),
              ),
            ).then((results) => {
              for (const result of results) {
                if (!result.ok) {
                  toast.error(result.error.message);
                  return;
                }
              }
              toast.success(t('bulkRestored', { count: ids.length }));
              void query.refetch();
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
    filters.categoryIds?.length ||
    filters.amountMin != null ||
    filters.amountMax != null ||
    filters.sharedOnly ||
    filters.mineOnly ||
    filters.hasAttachment ||
    filters.transactionIds?.length,
  );

  function majorToMinorInput(value: string): number | null {
    const parsed = parseMoney(value, { locale, currency: space.base_currency });
    if (!parsed.ok) return null;
    return Number(parsed.value.minor);
  }

  function minorToMajorInput(minor: number | null): string {
    if (minor == null) return '';
    return formatMoney(money(minor, space.base_currency), {
      locale,
      showCurrency: false,
    });
  }

  useEffect(() => {
    setMinDraft(minorToMajorInput(urlState.min));
    setMaxDraft(minorToMajorInput(urlState.max));
    // Sync drafts when URL amounts change (clear filters / deep-link), not on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional URL→draft sync only
  }, [urlState.min, urlState.max, locale, space.base_currency]);

  const filterChipClass = (active: boolean) =>
    cn(
      'h-9 rounded-md border px-3 text-sm transition-colors',
      active
        ? 'border-primary/45 bg-primary/15 text-foreground'
        : 'border-input bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground',
    );

  return (
    <PullToRefresh
      scrollRef={parentRef}
      onRefresh={async () => {
        await query.refetch();
      }}
    >
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <div className="sticky top-0 z-20 border-b border-border/60 bg-background/90 px-4 pt-4 pb-3 backdrop-blur-md lg:px-8">
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
            <div className="hidden items-center gap-2 lg:flex">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  void exportLedgerAction({ spaceId, format: 'csv' }).then((res) => {
                    if (!res.ok) return;
                    const blob = new Blob(
                      [Uint8Array.from(atob(res.data.base64), (c) => c.charCodeAt(0))],
                      {
                        type: res.data.mimeType,
                      },
                    );
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = res.data.fileName;
                    a.click();
                    URL.revokeObjectURL(url);
                  });
                }}
              >
                {tImport('exportCsv')}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  void exportLedgerAction({ spaceId, format: 'xlsx' }).then((res) => {
                    if (!res.ok) return;
                    const blob = new Blob(
                      [Uint8Array.from(atob(res.data.base64), (c) => c.charCodeAt(0))],
                      {
                        type: res.data.mimeType,
                      },
                    );
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = res.data.fileName;
                    a.click();
                    URL.revokeObjectURL(url);
                  });
                }}
              >
                {tImport('exportXlsx')}
              </Button>
              <Button
                type="button"
                onClick={() => {
                  composer?.openCreate();
                }}
              >
                {t('add')}
              </Button>
            </div>
          </div>
          {(offline?.pending.length ?? 0) > 0 ? (
            <p className="mt-2 text-xs text-warning" data-testid="pending-sync-banner">
              {t('pendingCount', { count: offline?.pending.length ?? 0 })}
            </p>
          ) : null}
          <div className="mt-3 flex [scrollbar-width:none] flex-nowrap items-center gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] sm:flex-wrap sm:overflow-visible [&::-webkit-scrollbar]:hidden">
            <Input
              value={searchDraft}
              onChange={(e) => {
                setSearchDraft(e.target.value);
              }}
              placeholder={t('searchPlaceholder')}
              className="max-w-xs min-w-[12rem] shrink-0"
              aria-label={t('searchPlaceholder')}
            />
            <select
              className="h-9 shrink-0 rounded-md border border-input bg-background px-2 text-sm"
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
              className="w-auto shrink-0"
            />
            <Input
              type="date"
              value={urlState.to}
              onChange={(e) => {
                void setUrlState({ to: e.target.value });
              }}
              aria-label={t('dateTo')}
              className="w-auto shrink-0"
            />
            {tags.length > 0 ? (
              <select
                className="h-9 max-w-[10rem] shrink-0 rounded-md border border-input bg-background px-2 text-sm"
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
              value={minDraft}
              onChange={(e) => {
                setMinDraft(e.target.value);
              }}
              onBlur={() => {
                const next = minDraft.trim() === '' ? null : majorToMinorInput(minDraft);
                void setUrlState({ min: next });
                setMinDraft(minorToMajorInput(next));
              }}
              aria-label={t('amountMin')}
              className="w-24 shrink-0"
            />
            <Input
              type="text"
              inputMode="decimal"
              placeholder={t('amountMax')}
              value={maxDraft}
              onChange={(e) => {
                setMaxDraft(e.target.value);
              }}
              onBlur={() => {
                const next = maxDraft.trim() === '' ? null : majorToMinorInput(maxDraft);
                void setUrlState({ max: next });
                setMaxDraft(minorToMajorInput(next));
              }}
              aria-label={t('amountMax')}
              className="w-24 shrink-0"
            />
            <button
              type="button"
              aria-pressed={urlState.shared}
              className={cn(filterChipClass(urlState.shared), 'shrink-0')}
              onClick={() => {
                void setUrlState({
                  shared: !urlState.shared,
                  mine: false,
                });
              }}
            >
              {t('sharedOnly')}
            </button>
            <button
              type="button"
              aria-pressed={urlState.mine}
              className={cn(filterChipClass(urlState.mine), 'shrink-0')}
              onClick={() => {
                void setUrlState({
                  mine: !urlState.mine,
                  shared: false,
                });
              }}
            >
              {t('mineOnly')}
            </button>
            <button
              type="button"
              aria-pressed={urlState.attached}
              data-testid="filter-has-attachment"
              className={cn(filterChipClass(urlState.attached), 'shrink-0')}
              onClick={() => {
                void setUrlState({ attached: !urlState.attached });
              }}
            >
              {t('hasAttachment')}
            </button>
            {filters.transactionIds?.length ? (
              <span
                className={cn(filterChipClass(true), 'shrink-0')}
                data-testid="filter-linked-transactions"
              >
                {t('linkedCount', { count: filters.transactionIds.length })}
              </span>
            ) : null}
            {hasFilters ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="shrink-0"
                onClick={clearFilters}
              >
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
          <div className="flex flex-col items-center gap-3 px-4 py-16 text-center">
            <p className="font-medium">{hasFilters ? t('emptyFilteredTitle') : t('emptyTitle')}</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              {hasFilters ? t('emptyFilteredBody') : t('emptyBody')}
            </p>
            {hasFilters ? (
              <Button type="button" variant="outline" onClick={clearFilters}>
                {t('clearFilters')}
              </Button>
            ) : null}
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
                          tone={
                            item.subtotal < 0 ? 'expense' : item.subtotal > 0 ? 'income' : 'none'
                          }
                          className="text-xs"
                        />
                      </div>
                    ) : (
                      <LedgerRow
                        tx={item.tx}
                        highlighted={highlightedIds.has(item.tx.id)}
                        selectionMode={selectionMode}
                        selected={selectedIds.has(item.tx.id)}
                        onOpen={() => {
                          setDetail(item.tx);
                        }}
                        onToggleSelect={() => {
                          toggleSelected(item.tx.id);
                        }}
                        onEnterSelection={() => {
                          setSelectedIds(new Set([item.tx.id]));
                        }}
                        onSwipeDelete={() => {
                          onDelete(item.tx);
                        }}
                        onSwipeEdit={() => {
                          composer?.openEdit(item.tx);
                        }}
                      />
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
                    space.kind === 'solo' ? (
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
                    ) : (
                      <div className="space-y-2">
                        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                          {tBalances('ledgerImpact')}
                        </p>
                        <ul className="flex flex-col gap-1.5">
                          {detail.splits.map((s) => {
                            const paid =
                              detail.payer_participant_id === s.participant_id
                                ? detail.kind === 'income'
                                  ? -detail.base_amount_minor
                                  : detail.base_amount_minor
                                : 0;
                            const owed =
                              detail.kind === 'income' ? -s.base_owed_minor : s.base_owed_minor;
                            const delta = paid - owed;
                            return (
                              <li key={s.id} className="flex flex-col gap-0.5 text-sm">
                                <div className="flex items-center justify-between gap-2">
                                  <span>{s.display_name}</span>
                                  <Amount
                                    minor={delta}
                                    currency={detail.currency}
                                    locale={locale}
                                    tone="auto"
                                    className="text-sm font-medium"
                                  />
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  {tBalances('ledgerPaid')}:{' '}
                                  {formatMoney(money(paid, detail.currency), { locale })}
                                  {' · '}
                                  {tBalances('ledgerOwed')}:{' '}
                                  {formatMoney(money(owed, detail.currency), { locale })}
                                </p>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )
                  ) : null}
                  <AttachmentGallery
                    spaceId={spaceId}
                    transactionId={detail.id}
                    attachments={detailAttachments}
                  />
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={pending}
                      onClick={() => {
                        const tx = detail;
                        setDetail(null);
                        composer?.openEdit(tx);
                      }}
                    >
                      {tTx('edit')}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={pending}
                      onClick={() => {
                        onDuplicate(detail);
                      }}
                    >
                      {tTx('duplicate')}
                    </Button>
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
                </div>
              </>
            ) : null}
          </SheetContent>
        </Sheet>

        {selectionMode ? (
          <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-20 border-t border-border bg-surface-raised px-4 py-3 lg:bottom-0">
            <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
              <p className="text-sm font-medium">
                {t('selectedCount', { count: selectedIds.size })}
              </p>
              <div className="flex items-center gap-2">
                <Button type="button" variant="ghost" size="sm" onClick={clearSelection}>
                  {t('clearSelection')}
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  disabled={pending}
                  onClick={onBulkDelete}
                >
                  {tTx('delete')}
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </PullToRefresh>
  );
}
