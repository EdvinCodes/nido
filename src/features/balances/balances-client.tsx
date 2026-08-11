'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useMemo, useState, useTransition } from 'react';
import { Amount } from '@/components/money/amount';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { isContributor, type MemberRole } from '@/lib/auth';
import { formatMoney, money } from '@/lib/money';
import { cn } from '@/lib/utils';
import {
  confirmSettlement,
  disputeSettlement,
  fetchBalanceBreakdown,
  proposeSettlement,
  refreshBalancesModel,
  reverseSettlement,
} from './actions';
import { balanceHeadline } from './lib/headline';
import type { SettlementMethod } from './schemas';
import type {
  BalanceBreakdownRow,
  BalancesPageModel,
  ParticipantBalance,
  SimplifiedPlanRow,
} from './types';
import { useBalancesRealtime } from './use-balances-realtime';

type Model = BalancesPageModel;

type SettleDraft = {
  transfer: SimplifiedPlanRow;
  amountMajor: string;
  method: SettlementMethod;
  note: string;
  settledOn: string;
};

function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function nameOf(balances: ParticipantBalance[], id: string): string {
  return balances.find((b) => b.participantId === id)?.displayName ?? '—';
}

export function BalancesClient({
  spaceId,
  role,
  userId,
  model: initialModel,
}: {
  spaceId: string;
  role: MemberRole;
  userId: string;
  model: BalancesPageModel;
}) {
  const t = useTranslations('balances');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const canEdit = isContributor(role);
  const [pending, startTransition] = useTransition();
  const [model, setModel] = useState<Model>(initialModel);
  const [view, setView] = useState<'simplified' | 'pairwise'>('simplified');
  const [settle, setSettle] = useState<SettleDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [breakdownFor, setBreakdownFor] = useState<ParticipantBalance | null>(null);
  const [breakdownRows, setBreakdownRows] = useState<BalanceBreakdownRow[]>([]);
  const [breakdownFrom, setBreakdownFrom] = useState('');
  const [breakdownTo, setBreakdownTo] = useState('');
  const [disputeId, setDisputeId] = useState<string | null>(null);
  const [disputeNote, setDisputeNote] = useState('');
  const [confirmAmountMajor, setConfirmAmountMajor] = useState<Record<string, string>>({});

  async function reloadModel(): Promise<void> {
    const result = await refreshBalancesModel({ spaceId });
    if (result.ok) setModel(result.data.model);
  }

  useBalancesRealtime(spaceId, () => {
    void reloadModel();
  });

  const headline = useMemo(
    () => balanceHeadline(model.balances, model.simplified),
    [model.balances, model.simplified],
  );

  function openSettle(transfer: SimplifiedPlanRow): void {
    setError(null);
    setSettle({
      transfer,
      amountMajor: String(transfer.amountMinor / 100),
      method: 'transfer',
      note: '',
      settledOn: todayIso(),
    });
  }

  function submitSettle(): void {
    if (!settle) return;
    const amountMinor = Math.round(Number(settle.amountMajor.replace(',', '.')) * 100);
    if (!Number.isFinite(amountMinor) || amountMinor <= 0) {
      setError(t('errors.amount'));
      return;
    }
    startTransition(async () => {
      const result = await proposeSettlement({
        spaceId,
        fromParticipantId: settle.transfer.fromId,
        toParticipantId: settle.transfer.toId,
        amountMinor,
        currency: model.currency,
        method: settle.method,
        note: settle.note.trim() || null,
        settledOn: settle.settledOn,
      });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setSettle(null);
      await reloadModel();
    });
  }

  function loadBreakdown(participant: ParticipantBalance, from?: string, to?: string): void {
    setBreakdownFor(participant);
    startTransition(async () => {
      const result = await fetchBalanceBreakdown({
        spaceId,
        participantId: participant.participantId,
        from: from || null,
        to: to || null,
      });
      if (result.ok) setBreakdownRows(result.data.rows);
    });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="sticky top-0 z-20 border-b border-border/60 bg-background/90 px-4 py-4 backdrop-blur-md lg:px-8">
        <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
        <p
          className="mt-3 font-display text-2xl tracking-tight text-balance sm:text-3xl"
          data-testid="balances-headline"
        >
          {headline.kind === 'square'
            ? t('headlineSquare')
            : t('headlineOwes', {
                from: headline.fromName,
                to: headline.toName,
                amount: formatMoney(money(headline.amountMinor, model.currency), { locale }),
              })}
        </p>
      </header>

      <div className="flex-1 space-y-6 p-4 lg:p-8">
        {model.pendingForMe.length > 0 ? (
          <section
            className="rounded-xl border border-accent/40 bg-accent/5 p-4"
            data-testid="settlement-pending"
          >
            <h2 className="text-sm font-medium tracking-tight">{t('pendingTitle')}</h2>
            <ul className="mt-3 space-y-3">
              {model.pendingForMe.map((s) => (
                <li
                  key={s.id}
                  className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"
                >
                  <div className="text-sm">
                    <p>
                      {t('pendingLine', {
                        from: nameOf(model.balances, s.fromParticipantId),
                        to: nameOf(model.balances, s.toParticipantId),
                        amount: formatMoney(money(s.amountMinor, s.currency), { locale }),
                      })}
                    </p>
                    <Label className="mt-2 block text-xs">{t('fields.confirmAmount')}</Label>
                    <Input
                      className="mt-1 max-w-[10rem]"
                      inputMode="decimal"
                      value={confirmAmountMajor[s.id] ?? String(s.amountMinor / 100)}
                      onChange={(e) => {
                        setConfirmAmountMajor((prev) => ({ ...prev, [s.id]: e.target.value }));
                      }}
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      disabled={pending}
                      data-testid="confirm-settlement"
                      onClick={() => {
                        const major = confirmAmountMajor[s.id] ?? String(s.amountMinor / 100);
                        const amountMinor = Math.round(Number(major.replace(',', '.')) * 100);
                        startTransition(async () => {
                          await confirmSettlement({
                            spaceId,
                            settlementId: s.id,
                            amountMinor:
                              Number.isFinite(amountMinor) && amountMinor > 0
                                ? amountMinor
                                : undefined,
                          });
                          await reloadModel();
                        });
                      }}
                    >
                      {t('confirm')}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={pending}
                      onClick={() => {
                        setDisputeId(s.id);
                        setDisputeNote('');
                      }}
                    >
                      {t('dispute')}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {model.balances.map((b) => (
            <button
              key={b.participantId}
              type="button"
              onClick={() => {
                loadBreakdown(b);
              }}
              className="rounded-xl border border-border bg-surface/40 p-4 text-left transition-colors hover:bg-surface-raised"
              data-testid="balance-card"
            >
              <div className="flex items-center gap-2">
                <span
                  className="size-2.5 rounded-full"
                  style={{ backgroundColor: b.color }}
                  aria-hidden
                />
                <p className="font-medium tracking-tight">{b.displayName}</p>
              </div>
              <dl className="mt-3 grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                <div>
                  <dt>{t('paid')}</dt>
                  <dd className="mt-0.5 text-foreground">
                    <Amount minor={b.paidMinor} currency={model.currency} className="text-sm" />
                  </dd>
                </div>
                <div>
                  <dt>{t('owed')}</dt>
                  <dd className="mt-0.5 text-foreground">
                    <Amount minor={b.owedMinor} currency={model.currency} className="text-sm" />
                  </dd>
                </div>
                <div>
                  <dt>{t('net')}</dt>
                  <dd className="mt-0.5">
                    <Amount
                      minor={b.netMinor}
                      currency={model.currency}
                      tone="auto"
                      className="text-sm font-medium"
                    />
                  </dd>
                </div>
              </dl>
            </button>
          ))}
        </section>

        <section>
          <Tabs
            value={view}
            onValueChange={(v) => {
              setView(v === 'pairwise' ? 'pairwise' : 'simplified');
            }}
          >
            <div className="flex flex-wrap items-end justify-between gap-3">
              <TabsList>
                <TabsTrigger value="simplified">{t('toggleSimplified')}</TabsTrigger>
                <TabsTrigger value="pairwise">{t('togglePairwise')}</TabsTrigger>
              </TabsList>
              {canEdit && model.simplified.length > 0 ? (
                <Button
                  type="button"
                  size="sm"
                  data-testid="settle-up"
                  onClick={() => {
                    const first = model.simplified[0];
                    if (first) openSettle(first);
                  }}
                >
                  {t('settleUp')}
                </Button>
              ) : null}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">{t('simplifyExplain')}</p>

            <TabsContent value="simplified" className="mt-4">
              {model.simplified.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('noTransfers')}</p>
              ) : (
                <ul className="space-y-2">
                  {model.simplified.map((row) => (
                    <li
                      key={`${row.fromId}-${row.toId}-${row.amountMinor}`}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border px-3 py-3"
                      data-testid="simplified-transfer"
                    >
                      <p className="text-sm">
                        {t('transferLine', {
                          from: nameOf(model.balances, row.fromId),
                          to: nameOf(model.balances, row.toId),
                          amount: formatMoney(money(row.amountMinor, model.currency), {
                            locale,
                          }),
                        })}
                      </p>
                      {canEdit ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            openSettle(row);
                          }}
                        >
                          {t('markPaid')}
                        </Button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </TabsContent>

            <TabsContent value="pairwise" className="mt-4">
              {model.pairwise.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('noTransfers')}</p>
              ) : (
                <ul className="space-y-2">
                  {model.pairwise.map((row) => (
                    <li
                      key={`${row.fromParticipantId}-${row.toParticipantId}`}
                      className="flex items-center justify-between rounded-lg border border-border px-3 py-3 text-sm"
                    >
                      <span>
                        {t('transferLine', {
                          from: nameOf(model.balances, row.fromParticipantId),
                          to: nameOf(model.balances, row.toParticipantId),
                          amount: formatMoney(money(row.amountMinor, model.currency), {
                            locale,
                          }),
                        })}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </TabsContent>
          </Tabs>
        </section>

        <section>
          <h2 className="text-sm font-medium tracking-tight">{t('history')}</h2>
          {model.settlements.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">{t('historyEmpty')}</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {model.settlements.map((s) => {
                const status =
                  s.reversedAt || s.reverseOfId
                    ? 'reversed'
                    : s.disputedAt
                      ? 'disputed'
                      : s.confirmedAt
                        ? 'confirmed'
                        : 'proposed';
                return (
                  <li
                    key={s.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-3 text-sm"
                    data-testid="settlement-row"
                    data-status={status}
                  >
                    <div>
                      <p>
                        {t('historyLine', {
                          from: nameOf(model.balances, s.fromParticipantId),
                          to: nameOf(model.balances, s.toParticipantId),
                          amount: formatMoney(money(s.amountMinor, s.currency), { locale }),
                          date: s.settledOn,
                          method: s.method ? t(`method.${s.method}`) : t('method.other'),
                        })}
                      </p>
                      <p
                        className={cn(
                          'mt-0.5 text-xs',
                          status === 'confirmed' && 'text-accent',
                          status === 'proposed' && 'text-warning',
                          status === 'disputed' && 'text-danger',
                          status === 'reversed' && 'text-muted-foreground',
                        )}
                      >
                        {t(`status.${status}`)}
                      </p>
                    </div>
                    {canEdit && s.confirmedAt && !s.reversedAt && !s.reverseOfId ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={pending}
                        onClick={() => {
                          startTransition(async () => {
                            await reverseSettlement({ spaceId, settlementId: s.id });
                            await reloadModel();
                          });
                        }}
                      >
                        {t('reverse')}
                      </Button>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      <Sheet
        open={settle != null}
        onOpenChange={(open) => {
          if (!open) setSettle(null);
        }}
      >
        <SheetContent className="flex flex-col gap-4 overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{t('markPaid')}</SheetTitle>
          </SheetHeader>
          {settle ? (
            <>
              <p className="text-sm text-muted-foreground">
                {t('transferLine', {
                  from: nameOf(model.balances, settle.transfer.fromId),
                  to: nameOf(model.balances, settle.transfer.toId),
                  amount: formatMoney(money(settle.transfer.amountMinor, model.currency), {
                    locale,
                  }),
                })}
              </p>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="settle-amount">{t('fields.amount')}</Label>
                  <Input
                    id="settle-amount"
                    className="mt-1"
                    inputMode="decimal"
                    value={settle.amountMajor}
                    onChange={(e) => {
                      setSettle({ ...settle, amountMajor: e.target.value });
                    }}
                  />
                </div>
                <div>
                  <Label>{t('fields.method')}</Label>
                  <Select
                    value={settle.method}
                    onValueChange={(v) => {
                      setSettle({
                        ...settle,
                        method: v as SettlementMethod,
                      });
                    }}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(['cash', 'transfer', 'bizum', 'other'] as const).map((m) => (
                        <SelectItem key={m} value={m}>
                          {t(`method.${m}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="settle-date">{t('fields.date')}</Label>
                  <Input
                    id="settle-date"
                    type="date"
                    className="mt-1"
                    value={settle.settledOn}
                    onChange={(e) => {
                      setSettle({ ...settle, settledOn: e.target.value });
                    }}
                  />
                </div>
                <div>
                  <Label htmlFor="settle-note">{t('fields.note')}</Label>
                  <Input
                    id="settle-note"
                    className="mt-1"
                    value={settle.note}
                    onChange={(e) => {
                      setSettle({ ...settle, note: e.target.value });
                    }}
                  />
                </div>
                {error ? <p className="text-sm text-danger">{error}</p> : null}
              </div>
              <SheetFooter>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setSettle(null);
                  }}
                >
                  {tCommon('cancel')}
                </Button>
                <Button
                  type="button"
                  disabled={pending}
                  data-testid="submit-settlement"
                  onClick={submitSettle}
                >
                  {t('propose')}
                </Button>
              </SheetFooter>
            </>
          ) : null}
        </SheetContent>
      </Sheet>

      <Sheet
        open={breakdownFor != null}
        onOpenChange={(open) => {
          if (!open) setBreakdownFor(null);
        }}
      >
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-xl">
          {breakdownFor ? (
            <>
              <SheetHeader>
                <SheetTitle>{t('breakdownTitle', { name: breakdownFor.displayName })}</SheetTitle>
              </SheetHeader>
              <div className="flex flex-wrap gap-2 px-1 pb-2">
                <Input
                  type="date"
                  value={breakdownFrom}
                  onChange={(e) => {
                    setBreakdownFrom(e.target.value);
                  }}
                  aria-label={t('fields.from')}
                />
                <Input
                  type="date"
                  value={breakdownTo}
                  onChange={(e) => {
                    setBreakdownTo(e.target.value);
                  }}
                  aria-label={t('fields.to')}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() => {
                    loadBreakdown(breakdownFor, breakdownFrom, breakdownTo);
                  }}
                >
                  {t('applyPeriod')}
                </Button>
              </div>
              <ul className="space-y-2 px-1 pb-6">
                {breakdownRows.map((row) => (
                  <li
                    key={row.transactionId}
                    className="flex items-start justify-between gap-3 border-b border-border/60 py-2 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {row.merchant || row.description || row.kind}
                      </p>
                      <p className="text-xs text-muted-foreground">{row.bookedOn}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {t('breakdownPaidOwed', {
                          paid: formatMoney(money(row.paidMinor, row.currency), { locale }),
                          owed: formatMoney(money(row.owedMinor, row.currency), { locale }),
                        })}
                      </p>
                    </div>
                    <Amount
                      minor={row.deltaMinor}
                      currency={row.currency}
                      tone="auto"
                      className="text-sm"
                    />
                  </li>
                ))}
                {breakdownRows.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t('breakdownEmpty')}</p>
                ) : null}
              </ul>
            </>
          ) : null}
        </SheetContent>
      </Sheet>

      <Sheet
        open={disputeId != null}
        onOpenChange={(open) => {
          if (!open) setDisputeId(null);
        }}
      >
        <SheetContent className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{t('dispute')}</SheetTitle>
          </SheetHeader>
          <div className="space-y-3 py-2">
            <Label htmlFor="dispute-note">{t('fields.disputeNote')}</Label>
            <Input
              id="dispute-note"
              value={disputeNote}
              onChange={(e) => {
                setDisputeNote(e.target.value);
              }}
            />
          </div>
          <SheetFooter>
            <Button
              type="button"
              disabled={pending || !disputeNote.trim() || !disputeId}
              onClick={() => {
                if (!disputeId) return;
                startTransition(async () => {
                  await disputeSettlement({
                    spaceId,
                    settlementId: disputeId,
                    note: disputeNote.trim(),
                  });
                  setDisputeId(null);
                  await reloadModel();
                });
              }}
            >
              {t('dispute')}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <span className="sr-only" data-userid={userId} />
    </div>
  );
}
