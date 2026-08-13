'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { PullToRefresh } from '@/components/mobile/pull-to-refresh';
import { Amount } from '@/components/money/amount';
import { AnimatedAmount } from '@/components/money/animated-amount';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { ProgressBar } from '@/components/ui/progress-bar';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendDelta } from '@/components/ui/trend-delta';
import { PeriodPicker } from '@/components/period/period-picker';
import type { AttentionBudget } from '@/features/budgets/types';
import { useTransactionComposerOptional } from '@/features/transactions/composer-context';
import { formatMoney, money } from '@/lib/money';
import { route } from '@/lib/routes';
import type { Route } from 'next';
import { ledgerHref } from './lib/ledger-href';
import { deltaRatio } from './lib/resolve-period';
import type { SpaceSeriesPoint, SpaceSummary } from './types';

const AreaTrend = dynamic(() => import('@/components/charts/area-trend').then((m) => m.AreaTrend), {
  ssr: false,
  loading: () => <Skeleton className="h-64 w-full rounded-xl" />,
});
const GroupedBars = dynamic(
  () => import('@/components/charts/grouped-bars').then((m) => m.GroupedBars),
  { ssr: false, loading: () => <Skeleton className="h-64 w-full rounded-xl" /> },
);
const CategoryDonut = dynamic(
  () => import('@/components/charts/category-donut').then((m) => m.CategoryDonut),
  { ssr: false, loading: () => <Skeleton className="h-72 w-full rounded-xl" /> },
);
const HorizontalBars = dynamic(
  () => import('@/components/charts/horizontal-bars').then((m) => m.HorizontalBars),
  { ssr: false, loading: () => <Skeleton className="h-72 w-full rounded-xl" /> },
);
const StackedBars = dynamic(
  () => import('@/components/charts/stacked-bars').then((m) => m.StackedBars),
  { ssr: false, loading: () => <Skeleton className="h-64 w-full rounded-xl" /> },
);
const Sparkline = dynamic(() => import('@/components/charts/sparkline').then((m) => m.Sparkline), {
  ssr: false,
  loading: () => <Skeleton className="h-10 w-full rounded-md" />,
});

export function DashboardView({
  spaceId,
  spaceKind,
  currency,
  timeZone,
  monthStartsOn,
  weekStartsOn,
  summary,
  series,
  isEmptySpace,
  attentionBudgets = [],
  hasBudgets = false,
  categoryBudgetProgress = {},
  upcomingCharges = [],
  goalProgress = [],
  outstandingBalances = [],
}: {
  spaceId: string;
  spaceKind: string;
  currency: string;
  timeZone: string;
  monthStartsOn: number;
  weekStartsOn: number;
  summary: SpaceSummary;
  series: SpaceSeriesPoint[];
  isEmptySpace: boolean;
  attentionBudgets?: AttentionBudget[];
  hasBudgets?: boolean;
  categoryBudgetProgress?: Record<string, { ratio: number; budgetId: string }>;
  upcomingCharges?: Array<{
    ruleId: string;
    name: string;
    amountMinor: number;
    currency: string;
    on: string;
  }>;
  goalProgress?: Array<{
    id: string;
    name: string;
    ratio: number;
    remainingMinor: number;
    currency: string;
  }>;
  outstandingBalances?: Array<{
    fromName: string;
    toName: string;
    amountMinor: number;
  }>;
}) {
  const t = useTranslations('dashboard');
  const locale = useLocale();
  const router = useRouter();
  const composer = useTransactionComposerOptional();
  const [evolutionMode, setEvolutionMode] = useState<'area' | 'bars'>('area');

  function formatMinor(value: number): string {
    return formatMoney(money(value, currency), { locale });
  }

  if (isEmptySpace) {
    return (
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden">
        <header className="sticky top-0 z-20 border-b border-border/60 bg-background/90 px-4 py-4 backdrop-blur-md lg:px-8">
          <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
        </header>
        <EmptyState
          title={t('emptyTitle')}
          body={t('emptyBody')}
          action={
            <Button
              type="button"
              onClick={() => {
                composer?.openCreate();
              }}
            >
              {t('emptyCta')}
            </Button>
          }
        />
      </div>
    );
  }

  const { totals, previous_totals: prev } = summary;
  const incomeSpark = summary.daily.map((d) => ({
    label: d.date,
    value: d.income_minor,
  }));
  const expenseSpark = summary.daily.map((d) => ({
    label: d.date,
    value: d.expense_minor,
  }));
  const netSpark = summary.daily.map((d) => ({
    label: d.date,
    value: d.cumulative_net_minor,
  }));
  const balanceTotal = summary.accounts
    .filter((a) => a.include_in_totals)
    .reduce((sum, a) => sum + a.balance_minor, 0);

  const topCategories = summary.categories.expense.slice(0, 8);
  const showParticipants = spaceKind !== 'solo';

  return (
    <PullToRefresh
      onRefresh={() => {
        router.refresh();
      }}
    >
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden">
        <header className="sticky top-0 z-20 space-y-3 border-b border-border/60 bg-background/90 px-4 py-4 backdrop-blur-md lg:px-8">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
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
          <PeriodPicker
            spaceId={spaceId}
            timeZone={timeZone}
            monthStartsOn={monthStartsOn}
            weekStartsOn={weekStartsOn}
          />
        </header>

        <div className="mx-auto grid w-full max-w-[1440px] gap-6 px-4 py-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:px-8">
          <div className="flex min-w-0 flex-col gap-6">
            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <SummaryCard
                href={ledgerHref({
                  spaceId,
                  from: summary.from,
                  to: summary.to,
                  kind: 'income',
                })}
                label={t('cards.income')}
                amount={totals.income_minor}
                currency={currency}
                ratio={deltaRatio(totals.income_minor, prev.income_minor)}
                goodWhenUp
                deltaLabel={t('vsPrevious')}
                spark={incomeSpark}
                sparkTone="income"
                sparkTitle={t('cards.income')}
              />
              <SummaryCard
                href={ledgerHref({
                  spaceId,
                  from: summary.from,
                  to: summary.to,
                  kind: 'expense',
                })}
                label={t('cards.expense')}
                amount={totals.expense_minor}
                currency={currency}
                ratio={deltaRatio(totals.expense_minor, prev.expense_minor)}
                goodWhenUp={false}
                deltaLabel={t('vsPrevious')}
                spark={expenseSpark}
                sparkTone="expense"
                sparkTitle={t('cards.expense')}
              />
              <SummaryCard
                href={ledgerHref({ spaceId, from: summary.from, to: summary.to })}
                label={t('cards.net')}
                amount={totals.net_minor}
                currency={currency}
                ratio={deltaRatio(totals.net_minor, prev.net_minor)}
                goodWhenUp
                deltaLabel={t('vsPrevious')}
                spark={netSpark}
                sparkTone="neutral"
                sparkTitle={t('cards.net')}
                tone="auto"
              />
              <SummaryCard
                href={route(`/s/${spaceId}/settings/accounts`)}
                label={t('cards.balance')}
                amount={balanceTotal}
                currency={currency}
                ratio={null}
                goodWhenUp
                deltaLabel={t('acrossAccounts')}
                spark={[]}
                sparkTone="neutral"
                sparkTitle={t('cards.balance')}
                tone="auto"
                showSpark={false}
              />
            </section>

            <section className="rounded-xl border border-border bg-surface/40 p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-medium tracking-tight">{t('evolution.title')}</h2>
                <div
                  className="flex gap-1 rounded-md border border-border p-0.5"
                  role="group"
                  aria-label={t('evolution.title')}
                >
                  <button
                    type="button"
                    aria-pressed={evolutionMode === 'area'}
                    className={`h-7 rounded px-2 text-xs ${evolutionMode === 'area' ? 'bg-primary/15' : 'text-muted-foreground'}`}
                    onClick={() => {
                      setEvolutionMode('area');
                    }}
                  >
                    {t('evolution.area')}
                  </button>
                  <button
                    type="button"
                    aria-pressed={evolutionMode === 'bars'}
                    className={`h-7 rounded px-2 text-xs ${evolutionMode === 'bars' ? 'bg-primary/15' : 'text-muted-foreground'}`}
                    onClick={() => {
                      setEvolutionMode('bars');
                    }}
                  >
                    {t('evolution.bars')}
                  </button>
                </div>
              </div>
              {evolutionMode === 'area' ? (
                <AreaTrend
                  title={t('evolution.title')}
                  valueFormatter={formatMinor}
                  data={summary.daily.map((d, index) => ({
                    label: d.date.slice(5),
                    value: d.cumulative_net_minor,
                    previous: series[index]?.net_minor,
                  }))}
                />
              ) : (
                <GroupedBars
                  title={t('evolution.title')}
                  valueFormatter={formatMinor}
                  data={summary.daily.map((d) => ({
                    label: d.date.slice(5),
                    income: d.income_minor,
                    expense: d.expense_minor,
                  }))}
                />
              )}
            </section>

            <section className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-xl border border-border bg-surface/40 p-4">
                <h2 className="mb-3 text-sm font-medium tracking-tight">{t('categories.title')}</h2>
                <CategoryDonut
                  title={t('categories.title')}
                  centerLabel={t('categories.total')}
                  valueFormatter={formatMinor}
                  data={topCategories.map((c) => ({
                    id: c.id,
                    name: c.name,
                    color: c.color,
                    value: c.total_minor,
                  }))}
                  onSliceClick={(slice) => {
                    router.push(
                      ledgerHref({
                        spaceId,
                        from: summary.from,
                        to: summary.to,
                        kind: 'expense',
                        categoryId: slice.id,
                      }),
                    );
                  }}
                />
              </div>
              <div className="rounded-xl border border-border bg-surface/40 p-4">
                <h2 className="mb-3 text-sm font-medium tracking-tight">
                  {t('categories.ranked')}
                </h2>
                {topCategories.length === 0 ? (
                  <div className="flex flex-col gap-2 py-4">
                    <p className="text-sm text-muted-foreground">{t('categories.empty')}</p>
                    <Link
                      href={ledgerHref({
                        spaceId,
                        from: summary.from,
                        to: summary.to,
                        kind: 'expense',
                      })}
                      className="text-sm font-medium text-primary hover:underline"
                    >
                      {t('categories.emptyCta')}
                    </Link>
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {topCategories.map((category) => (
                      <li key={`${category.id ?? 'none'}-${category.name}`}>
                        <Link
                          href={ledgerHref({
                            spaceId,
                            from: summary.from,
                            to: summary.to,
                            kind: 'expense',
                            categoryId: category.id,
                          })}
                          className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-surface-raised"
                        >
                          <span
                            className="size-2.5 shrink-0 rounded-full"
                            style={{ backgroundColor: category.color }}
                            aria-hidden
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium">
                              {category.name}
                            </span>
                            <span className="block text-xs text-muted-foreground">
                              {Math.round(category.share * 100)}% ·{' '}
                              <TrendDelta
                                ratio={deltaRatio(
                                  category.total_minor,
                                  category.total_minor - category.change_minor,
                                )}
                                goodWhenUp={false}
                                label={t('vsPrevious')}
                              />
                            </span>
                            {category.id && categoryBudgetProgress[category.id] ? (
                              <ProgressBar
                                className="mt-1"
                                value={categoryBudgetProgress[category.id]?.ratio ?? 0}
                                label={category.name}
                              />
                            ) : (
                              <span
                                className="mt-1 block h-1.5 overflow-hidden rounded-full bg-border"
                                aria-hidden
                              >
                                <span
                                  className="block h-full rounded-full bg-primary"
                                  style={{ width: `${Math.min(100, category.share * 100)}%` }}
                                />
                              </span>
                            )}
                          </span>
                          <Amount
                            minor={category.total_minor}
                            currency={currency}
                            className="text-sm"
                          />
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>

            <section className="grid gap-4 lg:grid-cols-2">
              {showParticipants ? (
                <div className="rounded-xl border border-border bg-surface/40 p-4">
                  <h2 className="mb-3 text-sm font-medium tracking-tight">
                    {t('participants.title')}
                  </h2>
                  <StackedBars
                    title={t('participants.title')}
                    valueFormatter={formatMinor}
                    series={summary.participants.map((p) => ({
                      key: p.id,
                      label: p.display_name,
                      color: p.color,
                    }))}
                    data={[
                      {
                        label: t('participants.paid'),
                        ...Object.fromEntries(
                          summary.participants.map((p) => [p.id, p.paid_minor]),
                        ),
                      },
                      {
                        label: t('participants.owed'),
                        ...Object.fromEntries(
                          summary.participants.map((p) => [p.id, p.owed_minor]),
                        ),
                      },
                    ]}
                  />
                </div>
              ) : null}
              <div className="rounded-xl border border-border bg-surface/40 p-4">
                <h2 className="mb-3 text-sm font-medium tracking-tight">{t('merchants.title')}</h2>
                <HorizontalBars
                  title={t('merchants.title')}
                  valueFormatter={formatMinor}
                  data={summary.merchants.map((m) => ({
                    label: m.name,
                    value: m.total_minor,
                  }))}
                  onBarClick={(point) => {
                    router.push(
                      ledgerHref({
                        spaceId,
                        from: summary.from,
                        to: summary.to,
                        kind: 'expense',
                        q: point.label === '—' ? undefined : point.label,
                      }),
                    );
                  }}
                />
              </div>
            </section>
          </div>

          <aside className="flex flex-col gap-4">
            <section className="rounded-xl border border-border bg-surface/40 p-4">
              <h2 className="mb-3 text-sm font-medium tracking-tight">{t('rail.accounts')}</h2>
              <ul className="space-y-2">
                {summary.accounts.map((account) => (
                  <li key={account.id} className="flex items-center justify-between gap-3 text-sm">
                    <span className="flex min-w-0 items-center gap-2">
                      <span
                        className="size-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: account.color }}
                        aria-hidden
                      />
                      <span className="truncate">{account.name}</span>
                    </span>
                    <Amount
                      minor={account.balance_minor}
                      currency={account.currency}
                      tone="auto"
                      className="text-sm"
                    />
                  </li>
                ))}
              </ul>
            </section>
            <section className="rounded-xl border border-border bg-surface/40 p-4">
              <h2 className="text-sm font-medium tracking-tight">{t('rail.alerts')}</h2>
              {attentionBudgets.length === 0 ? (
                <div className="mt-2 flex flex-col gap-2">
                  <p className="text-xs text-muted-foreground">
                    {hasBudgets ? t('rail.alertsEmpty') : t('rail.alertsNone')}
                  </p>
                  {!hasBudgets ? (
                    <Link
                      href={route(`/s/${spaceId}/budgets`)}
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      {t('rail.alertsNoneCta')}
                    </Link>
                  ) : null}
                </div>
              ) : (
                <ul className="mt-3 space-y-2">
                  {attentionBudgets.map((budget) => (
                    <li key={budget.id}>
                      <Link
                        href={route(`/s/${spaceId}/budgets/${budget.id}`)}
                        className="block rounded-lg px-2 py-2 hover:bg-surface-raised"
                      >
                        <div className="flex items-center justify-between gap-2 text-sm">
                          <span className="truncate font-medium">{budget.name}</span>
                          <span
                            className={
                              budget.urgency === 'over' ? 'text-danger' : 'text-muted-foreground'
                            }
                          >
                            {Math.round(budget.ratio * 100)}%
                          </span>
                        </div>
                        <ProgressBar className="mt-1.5" value={budget.ratio} label={budget.name} />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section className="rounded-xl border border-border bg-surface/40 p-4">
              <h2 className="text-sm font-medium tracking-tight">{t('rail.upcoming')}</h2>
              {upcomingCharges.length === 0 ? (
                <p className="mt-2 text-xs text-muted-foreground">{t('rail.upcomingEmpty')}</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {upcomingCharges.map((charge) => (
                    <li key={`${charge.ruleId}-${charge.on}`}>
                      <Link
                        href={route(`/s/${spaceId}/subscriptions/${charge.ruleId}`)}
                        className="flex items-center justify-between gap-2 rounded-lg px-2 py-2 text-sm hover:bg-surface-raised"
                      >
                        <span className="min-w-0 truncate">
                          <span className="font-medium">{charge.name}</span>
                          <span className="mt-0.5 block text-xs text-muted-foreground">
                            {charge.on}
                          </span>
                        </span>
                        <Amount
                          minor={charge.amountMinor}
                          currency={charge.currency}
                          className="text-sm"
                        />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section className="rounded-xl border border-border bg-surface/40 p-4">
              <h2 className="text-sm font-medium tracking-tight">{t('rail.goals')}</h2>
              {goalProgress.length === 0 ? (
                <div className="mt-2 flex flex-col gap-2">
                  <p className="text-xs text-muted-foreground">{t('rail.goalsEmpty')}</p>
                  <Link
                    href={route(`/s/${spaceId}/goals`)}
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    {t('rail.goalsEmptyCta')}
                  </Link>
                </div>
              ) : (
                <ul className="mt-3 space-y-2">
                  {goalProgress.map((goal) => (
                    <li key={goal.id}>
                      <Link
                        href={route(`/s/${spaceId}/goals/${goal.id}`)}
                        className="block rounded-lg px-2 py-2 hover:bg-surface-raised"
                      >
                        <div className="flex items-center justify-between gap-2 text-sm">
                          <span className="truncate font-medium">{goal.name}</span>
                          <span className="text-muted-foreground">
                            {Math.round(goal.ratio * 100)}%
                          </span>
                        </div>
                        <ProgressBar className="mt-1.5" value={goal.ratio} label={goal.name} />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            {spaceKind !== 'solo' ? (
              <section
                className="rounded-xl border border-border bg-surface/40 p-4"
                data-testid="rail-balances"
              >
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-sm font-medium tracking-tight">{t('rail.balances')}</h2>
                  <Link
                    href={route(`/s/${spaceId}/balances`)}
                    className="text-xs font-medium text-foreground underline-offset-2 hover:underline"
                  >
                    {t('rail.settleLink')}
                  </Link>
                </div>
                {outstandingBalances.length === 0 ? (
                  <p className="mt-2 text-xs text-muted-foreground">{t('rail.balancesEmpty')}</p>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {outstandingBalances.map((row) => (
                      <li key={`${row.fromName}-${row.toName}-${row.amountMinor}`}>
                        <Link
                          href={route(`/s/${spaceId}/balances`)}
                          className="flex items-center justify-between gap-2 rounded-lg px-2 py-2 text-sm hover:bg-surface-raised"
                        >
                          <span className="min-w-0 truncate">
                            {row.fromName} → {row.toName}
                          </span>
                          <Amount minor={row.amountMinor} currency={currency} className="text-sm" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ) : null}
          </aside>
        </div>
      </div>
    </PullToRefresh>
  );
}

function SummaryCard({
  href,
  label,
  amount,
  currency,
  ratio,
  goodWhenUp,
  deltaLabel,
  spark,
  sparkTone,
  sparkTitle,
  tone = 'none',
  showSpark = true,
}: {
  href: Route;
  label: string;
  amount: number;
  currency: string;
  ratio: number | null;
  goodWhenUp: boolean;
  deltaLabel: string;
  spark: Array<{ label: string; value: number }>;
  sparkTone: 'income' | 'expense' | 'neutral';
  sparkTitle: string;
  tone?: 'expense' | 'income' | 'transfer' | 'auto' | 'none';
  showSpark?: boolean;
}) {
  const amountTone =
    tone === 'auto' ? (amount < 0 ? 'expense' : amount > 0 ? 'income' : 'none') : tone;

  return (
    <Link
      href={href}
      className="flex flex-col gap-2 rounded-xl border border-border bg-surface/40 p-4 transition-colors hover:bg-surface-raised/60"
    >
      <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </span>
      <AnimatedAmount
        minor={amount}
        currency={currency}
        tone={amountTone}
        className="text-xl font-semibold tracking-tight"
      />
      <TrendDelta ratio={ratio} goodWhenUp={goodWhenUp} label={deltaLabel} />
      {showSpark ? <Sparkline data={spark} title={sparkTitle} tone={sparkTone} /> : null}
    </Link>
  );
}
