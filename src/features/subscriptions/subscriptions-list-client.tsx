'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useMemo, useState, useTransition } from 'react';
import { Amount } from '@/components/money/amount';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { isContributor, type MemberRole } from '@/lib/auth';
import { formatMoney, money } from '@/lib/money';
import { route } from '@/lib/routes';
import { acceptCandidate, answerGhost, createSubscription } from './actions';
import type { GhostSubscription, RecurringCandidate, SubscriptionCard } from './types';

const Sparkline = dynamic(() => import('@/components/charts/sparkline').then((m) => m.Sparkline), {
  ssr: false,
  loading: () => <Skeleton className="h-8 w-24 rounded-md" />,
});

function dismissKey(spaceId: string) {
  return `nido:dismissed-candidates:${spaceId}`;
}

export function SubscriptionsListClient({
  spaceId,
  role,
  currency,
  active,
  cancelled,
  monthlyTotalMinor,
  annualTotalMinor,
  candidates,
  ghosts,
  participants,
}: {
  spaceId: string;
  role: MemberRole;
  currency: string;
  active: SubscriptionCard[];
  cancelled: SubscriptionCard[];
  monthlyTotalMinor: number;
  annualTotalMinor: number;
  candidates: RecurringCandidate[];
  ghosts: GhostSubscription[];
  participants: Array<{ id: string; displayName: string }>;
}) {
  const t = useTranslations('subscriptions');
  const locale = useLocale();
  const canEdit = isContributor(role);
  const [formOpen, setFormOpen] = useState(false);
  const [cancelledOpen, setCancelledOpen] = useState(false);
  const [dismissed, setDismissed] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = window.localStorage.getItem(dismissKey(spaceId));
      return raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
      return [];
    }
  });
  const [, startTransition] = useTransition();

  const visibleCandidates = candidates.filter((c) => !dismissed.includes(c.merchantKey));
  const grouped = useMemo(() => {
    const map = new Map<string, SubscriptionCard[]>();
    for (const card of active) {
      const list = map.get(card.cycleKey) ?? [];
      list.push(card);
      map.set(card.cycleKey, list);
    }
    return [...map.entries()];
  }, [active]);

  const calendarDays = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const totals = new Map<number, number>();
    for (const card of active) {
      const d = new Date(`${card.nextRunOn}T00:00:00`);
      if (d.getFullYear() === year && d.getMonth() === month) {
        totals.set(d.getDate(), (totals.get(d.getDate()) ?? 0) + card.amountMinor);
      }
    }
    return Array.from({ length: daysInMonth }, (_, i) => ({
      day: i + 1,
      total: totals.get(i + 1) ?? 0,
    }));
  }, [active]);

  const cancelledSaved = cancelled.reduce((sum, c) => sum + c.annualMinor, 0);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="sticky top-0 z-20 space-y-3 border-b border-border/60 bg-background/90 px-4 py-4 backdrop-blur-md lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
          {canEdit ? (
            <Button
              type="button"
              size="sm"
              onClick={() => {
                setFormOpen(true);
              }}
            >
              {t('create')}
            </Button>
          ) : null}
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-border bg-surface/40 p-3">
            <p className="text-xs text-muted-foreground">{t('monthly')}</p>
            <Amount minor={monthlyTotalMinor} currency={currency} className="text-lg" />
          </div>
          <div className="rounded-xl border border-border bg-surface/40 p-3 sm:col-span-2">
            <p className="text-xs text-muted-foreground">{t('annual')}</p>
            <Amount
              minor={annualTotalMinor}
              currency={currency}
              className="text-3xl font-semibold tracking-tight"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              {t('activeCount', { count: active.length })}
            </p>
          </div>
        </div>
      </header>

      <div className="flex-1 space-y-6 p-4 lg:p-8">
        {visibleCandidates.length > 0 ? (
          <section className="space-y-2">
            <h2 className="text-sm font-medium">{t('candidates')}</h2>
            {visibleCandidates.map((c) => (
              <div
                key={c.merchantKey}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface/40 p-3"
              >
                <div>
                  <p className="font-medium">{c.merchant}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatMoney(money(c.amountMinor, c.currency), { locale })} · {c.suggestedFreq}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const next = [...dismissed, c.merchantKey];
                      setDismissed(next);
                      window.localStorage.setItem(dismissKey(spaceId), JSON.stringify(next));
                    }}
                  >
                    {t('dismiss')}
                  </Button>
                  {canEdit ? (
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => {
                        startTransition(async () => {
                          await acceptCandidate({
                            spaceId,
                            merchant: c.merchant,
                            amountMinor: c.amountMinor,
                            currency: c.currency,
                            categoryId: c.categoryId,
                            accountId: c.accountId,
                            payerParticipantId: c.payerParticipantId,
                            splitMode:
                              c.splitMode === 'personal' ||
                              c.splitMode === 'shares' ||
                              c.splitMode === 'percent' ||
                              c.splitMode === 'exact'
                                ? c.splitMode
                                : 'equal',
                            freq: c.suggestedFreq,
                            intervalCount: c.suggestedInterval,
                            startsOn: c.firstOn,
                            nextRunOn: c.lastOn,
                            transactionIds: c.transactionIds,
                          });
                        });
                      }}
                    >
                      {t('accept')}
                    </Button>
                  ) : null}
                </div>
              </div>
            ))}
          </section>
        ) : null}

        {ghosts.length > 0 ? (
          <section className="space-y-2">
            <h2 className="text-sm font-medium">{t('ghosts')}</h2>
            {ghosts.map((g) => (
              <div key={g.ruleId} className="rounded-xl border border-border bg-surface/40 p-3">
                <p className="text-sm">
                  {t('ghostQuestion', {
                    amount: formatMoney(money(g.totalPaidMinor, g.currency), { locale }),
                    name: g.name,
                    months: g.monthsActive,
                  })}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      startTransition(async () => {
                        await answerGhost({ spaceId, ruleId: g.ruleId, answer: 'yes' });
                      });
                    }}
                  >
                    {t('ghostYes')}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      startTransition(async () => {
                        await answerGhost({
                          spaceId,
                          ruleId: g.ruleId,
                          answer: 'no',
                          cancelUrl: g.cancelUrl,
                        });
                      });
                    }}
                  >
                    {t('ghostNo')}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      startTransition(async () => {
                        await answerGhost({ spaceId, ruleId: g.ruleId, answer: 'unsure' });
                      });
                    }}
                  >
                    {t('ghostUnsure')}
                  </Button>
                </div>
              </div>
            ))}
          </section>
        ) : null}

        <section>
          <h2 className="mb-2 text-sm font-medium">{t('calendar')}</h2>
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((d) => (
              <div
                key={d.day}
                className={`min-h-14 rounded-md border border-border/60 p-1 text-xs ${d.total > 0 ? 'bg-surface-raised' : ''}`}
              >
                <div className="text-muted-foreground">{d.day}</div>
                {d.total > 0 ? (
                  <div className="mt-1 font-medium">
                    {formatMoney(money(d.total, currency), { locale, compact: true })}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </section>

        {active.length === 0 ? (
          <EmptyState title={t('emptyTitle')} body={t('emptyBody')} />
        ) : (
          grouped.map(([cycle, cards]) => (
            <section key={cycle} className="space-y-2">
              <h2 className="text-sm font-medium text-muted-foreground">
                {t(`cycle.${cards[0]?.freq ?? 'month'}`, { count: cards[0]?.intervalCount ?? 1 })}
              </h2>
              <ul className="space-y-2">
                {cards.map((card) => (
                  <li key={card.id}>
                    <Link
                      href={route(`/s/${spaceId}/subscriptions/${card.id}`)}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface/40 px-3 py-3 hover:bg-surface-raised"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium">{card.merchant || card.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {t('next', { date: card.nextRunOn })} · {card.splitMode}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        {card.priceSpark.length > 1 ? (
                          <Sparkline
                            data={card.priceSpark.map((value, index) => ({
                              label: String(index + 1),
                              value,
                            }))}
                            title={t('priceTrend')}
                          />
                        ) : null}
                        <div className="text-right">
                          <Amount minor={card.amountMinor} currency={card.currency} />
                          <p className="text-xs text-muted-foreground">
                            {t('paidToDate', {
                              amount: formatMoney(money(card.totalPaidMinor, card.currency), {
                                locale,
                              }),
                            })}
                          </p>
                        </div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}

        {cancelled.length > 0 ? (
          <section>
            <button
              type="button"
              className="text-sm font-medium text-muted-foreground hover:text-foreground"
              onClick={() => {
                setCancelledOpen((v) => !v);
              }}
            >
              {t('cancelled', { count: cancelled.length })}
            </button>
            {cancelledOpen ? (
              <div className="mt-2 space-y-2">
                <p className="text-sm text-accent">
                  {t('savedAnnual', {
                    amount: formatMoney(money(cancelledSaved, currency), { locale }),
                  })}
                </p>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  {cancelled.map((c) => (
                    <li key={c.id}>
                      <Link
                        href={route(`/s/${spaceId}/subscriptions/${c.id}`)}
                        className="hover:underline"
                      >
                        {c.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>
        ) : null}
      </div>

      <CreateRuleSheet
        open={formOpen}
        onOpenChange={setFormOpen}
        spaceId={spaceId}
        currency={currency}
        participants={participants}
      />
    </div>
  );
}

function CreateRuleSheet({
  open,
  onOpenChange,
  spaceId,
  currency,
  participants,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  spaceId: string;
  currency: string;
  participants: Array<{ id: string; displayName: string }>;
}) {
  const t = useTranslations('subscriptions');
  const tCommon = useTranslations('common');
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState('');
  const [amountMajor, setAmountMajor] = useState('9.99');
  const [startsOn, setStartsOn] = useState(new Date().toISOString().slice(0, 10));
  const [error, setError] = useState<string | null>(null);
  const payerId = participants[0]?.id ?? '';

  function submit() {
    const amountMinor = Math.round(Number(amountMajor.replace(',', '.')) * 100);
    if (!name.trim() || !Number.isFinite(amountMinor) || amountMinor <= 0) {
      setError(t('errors.amount'));
      return;
    }
    startTransition(async () => {
      const result = await createSubscription({
        spaceId,
        name: name.trim(),
        merchant: name.trim(),
        amountMinor,
        currency,
        payerParticipantId: payerId || null,
        splitMode: 'personal',
        splitConfig: payerId ? [{ participantId: payerId }] : [],
        freq: 'month',
        intervalCount: 1,
        byMonthDay: Number(startsOn.slice(8, 10)),
        startsOn,
        nextRunOn: startsOn,
        autoCreate: true,
        reminderDaysBefore: 2,
        kind: 'subscription',
      });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      onOpenChange(false);
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col gap-4 sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{t('create')}</SheetTitle>
        </SheetHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>{t('fields.name')}</Label>
            <Input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t('fields.amount')}</Label>
            <Input
              inputMode="decimal"
              value={amountMajor}
              onChange={(e) => {
                setAmountMajor(e.target.value);
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t('fields.next')}</Label>
            <Input
              type="date"
              value={startsOn}
              onChange={(e) => {
                setStartsOn(e.target.value);
              }}
            />
          </div>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
        </div>
        <SheetFooter>
          <Button type="button" disabled={pending} onClick={submit}>
            {tCommon('save')}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
