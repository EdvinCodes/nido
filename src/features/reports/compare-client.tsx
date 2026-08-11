'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { Amount } from '@/components/money/amount';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { comparePeriodsAction } from '@/features/reports/actions';
import { buildCategoryDeltas, comparePeriodTotals } from '@/features/reports/lib/compare-periods';
import type { PeriodSnapshotPayload } from '@/features/reports/types';
import { formatMoney, money } from '@/lib/money';
import { route } from '@/lib/routes';

export function CompareReportsClient({
  spaceId,
  baseCurrency,
  defaultLeft,
  defaultRight,
}: {
  spaceId: string;
  baseCurrency: string;
  defaultLeft: { from: string; to: string };
  defaultRight: { from: string; to: string };
}) {
  const t = useTranslations('reports');
  const locale = useLocale();
  const [pending, startTransition] = useTransition();
  const [leftFrom, setLeftFrom] = useState(defaultLeft.from);
  const [leftTo, setLeftTo] = useState(defaultLeft.to);
  const [rightFrom, setRightFrom] = useState(defaultRight.from);
  const [rightTo, setRightTo] = useState(defaultRight.to);
  const [left, setLeft] = useState<PeriodSnapshotPayload | null>(null);
  const [right, setRight] = useState<PeriodSnapshotPayload | null>(null);

  function runCompare(): void {
    startTransition(async () => {
      const result = await comparePeriodsAction({
        spaceId,
        leftFrom,
        leftTo,
        rightFrom,
        rightTo,
      });
      if (result.ok) {
        setLeft(result.data.left);
        setRight(result.data.right);
      }
    });
  }

  const formatMinor = (minor: number) =>
    formatMoney(money(BigInt(minor), baseCurrency), { locale });

  const summary =
    left && right
      ? comparePeriodTotals(
          {
            incomeMinor: left.totals.income_minor,
            expenseMinor: left.totals.expense_minor,
          },
          {
            incomeMinor: right.totals.income_minor,
            expenseMinor: right.totals.expense_minor,
          },
          buildCategoryDeltas(
            left.categories.expense.map((c) => ({
              id: c.id,
              name: c.name,
              color: c.color,
              totalMinor: c.total_minor,
            })),
            right.categories.expense.map((c) => ({
              id: c.id,
              totalMinor: c.total_minor,
            })),
          ),
          formatMinor,
        )
      : null;

  const maxBar = summary
    ? Math.max(...summary.categories.map((c) => Math.abs(c.changeMinor)), 1)
    : 1;

  return (
    <div className="space-y-6 p-4 lg:p-8">
      <Link
        href={route(`/s/${spaceId}/reports`)}
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← {t('back')}
      </Link>
      <h1 className="text-xl font-semibold tracking-tight">{t('compareTitle')}</h1>

      <div className="grid gap-4 md:grid-cols-2">
        <PeriodPicker
          label={t('periodA')}
          from={leftFrom}
          to={leftTo}
          onFrom={setLeftFrom}
          onTo={setLeftTo}
        />
        <PeriodPicker
          label={t('periodB')}
          from={rightFrom}
          to={rightTo}
          onFrom={setRightFrom}
          onTo={setRightTo}
        />
      </div>

      <Button disabled={pending} onClick={runCompare}>
        {t('compareRun')}
      </Button>

      {summary && left && right ? (
        <>
          <p className="rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm">
            {summary.driverSentence || t('noDrivers')}
          </p>

          <div className="grid gap-3 sm:grid-cols-3">
            <DeltaCard
              label={t('income')}
              delta={summary.incomeDelta}
              currency={baseCurrency}
              locale={locale}
            />
            <DeltaCard
              label={t('expenses')}
              delta={summary.expenseDelta}
              currency={baseCurrency}
              locale={locale}
            />
            <DeltaCard
              label={t('net')}
              delta={summary.netDelta}
              currency={baseCurrency}
              locale={locale}
            />
          </div>

          <section className="rounded-xl border border-border bg-card p-4">
            <h2 className="mb-3 text-sm font-medium">{t('categoryImpact')}</h2>
            <ul className="space-y-3">
              {summary.categories.slice(0, 12).map((c) => (
                <li key={c.id ?? c.name}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span>{c.name}</span>
                    <Amount minor={c.changeMinor} currency={baseCurrency} locale={locale} />
                  </div>
                  <div className="relative h-3 rounded-full bg-muted">
                    <div
                      className={`absolute top-0 h-3 rounded-full ${c.changeMinor >= 0 ? 'left-1/2 bg-expense' : 'right-1/2 bg-income'}`}
                      style={{ width: `${Math.round((Math.abs(c.changeMinor) / maxBar) * 50)}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </>
      ) : null}
    </div>
  );
}

function PeriodPicker({
  label,
  from,
  to,
  onFrom,
  onTo,
}: {
  label: string;
  from: string;
  to: string;
  onFrom: (v: string) => void;
  onTo: (v: string) => void;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="mb-2 text-sm font-medium">{label}</p>
      <div className="flex gap-2">
        <Input
          type="date"
          value={from}
          onChange={(e) => {
            onFrom(e.target.value);
          }}
        />
        <Input
          type="date"
          value={to}
          onChange={(e) => {
            onTo(e.target.value);
          }}
        />
      </div>
    </div>
  );
}

function DeltaCard({
  label,
  delta,
  currency,
  locale,
}: {
  label: string;
  delta: number;
  currency: string;
  locale: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <Amount minor={delta} currency={currency} locale={locale} className="text-lg font-semibold" />
    </div>
  );
}
