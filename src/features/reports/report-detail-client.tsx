'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { Amount } from '@/components/money/amount';
import { formatSavingsRate } from '@/features/reports/lib/savings-rate';
import type { PeriodSnapshotPayload } from '@/features/reports/types';
import { route } from '@/lib/routes';

export function ReportDetailClient({
  spaceId,
  from,
  to,
  payload,
}: {
  spaceId: string;
  from: string;
  to: string;
  payload: PeriodSnapshotPayload;
}) {
  const t = useTranslations('reports');
  const locale = useLocale();

  return (
    <div className="space-y-8 p-4 lg:p-8">
      <div>
        <Link
          href={route(`/s/${spaceId}/reports`)}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← {t('back')}
        </Link>
        <h1 className="mt-2 text-xl font-semibold tracking-tight">
          {payload.space_name} · {from} – {to}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t('savingsRate')}: {formatSavingsRate(payload.totals.savings_rate)}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label={t('income')}
          minor={payload.totals.income_minor}
          currency={payload.base_currency}
          locale={locale}
          tone="income"
        />
        <StatCard
          label={t('expenses')}
          minor={payload.totals.expense_minor}
          currency={payload.base_currency}
          locale={locale}
          tone="expense"
        />
        <StatCard
          label={t('net')}
          minor={payload.totals.net_minor}
          currency={payload.base_currency}
          locale={locale}
        />
      </div>

      <section className="rounded-xl border border-border bg-card p-4">
        <h2 className="mb-3 text-sm font-medium">{t('topChanges')}</h2>
        <ul className="space-y-2">
          {payload.top_changes.map((c) => (
            <li key={c.id ?? c.name} className="flex items-center justify-between gap-3 text-sm">
              <span className="flex items-center gap-2">
                <span className="size-2 rounded-full" style={{ backgroundColor: c.color }} />
                {c.name}
              </span>
              <Amount
                minor={c.change_minor}
                currency={payload.base_currency}
                locale={locale}
                tone={c.change_minor >= 0 ? 'expense' : 'income'}
              />
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border border-border bg-card p-4">
        <h2 className="mb-3 text-sm font-medium">{t('budgetPerformance')}</h2>
        <ul className="space-y-3">
          {payload.budgets.map((b) => (
            <li key={b.id}>
              <div className="mb-1 flex justify-between text-sm">
                <span>{b.name}</span>
                <span>
                  <Amount
                    minor={b.spent_minor}
                    currency={payload.base_currency}
                    locale={locale}
                    className="inline"
                  />
                  {' / '}
                  <Amount
                    minor={b.limit_minor}
                    currency={payload.base_currency}
                    locale={locale}
                    className="inline"
                  />
                </span>
              </div>
              <div className="h-2 rounded-full bg-muted">
                <div
                  className="h-2 rounded-full bg-primary"
                  style={{ width: `${Math.min(100, Math.round(b.percent_used * 100))}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function StatCard({
  label,
  minor,
  currency,
  locale,
  tone,
}: {
  label: string;
  minor: number;
  currency: string;
  locale: string;
  tone?: 'income' | 'expense';
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <Amount
        minor={minor}
        currency={currency}
        locale={locale}
        {...(tone ? { tone } : {})}
        className="text-lg font-semibold"
      />
    </div>
  );
}
