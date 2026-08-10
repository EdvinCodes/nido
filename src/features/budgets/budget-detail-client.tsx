'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Amount } from '@/components/money/amount';
import { ProgressRing } from '@/components/ui/progress-ring';
import { Skeleton } from '@/components/ui/skeleton';
import { route } from '@/lib/routes';
import type { BudgetCardModel } from './types';
import type { BudgetPeriodRow } from './types';

const Sparkline = dynamic(() => import('@/components/charts/sparkline').then((m) => m.Sparkline), {
  ssr: false,
  loading: () => <Skeleton className="h-24 w-full rounded-md" />,
});

export function BudgetDetailClient({
  spaceId,
  card,
  periods,
  transactions,
}: {
  spaceId: string;
  card: BudgetCardModel;
  periods: BudgetPeriodRow[];
  transactions: Array<{
    id: string;
    booked_on: string;
    description: string;
    merchant: string | null;
    base_amount_minor: number;
    currency: string;
  }>;
}) {
  const t = useTranslations('budgets');
  const limit = card.currentPeriod?.limitMinor ?? 0;
  const spent = card.currentPeriod?.spentMinor ?? 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="sticky top-0 z-20 border-b border-border/60 bg-background/90 px-4 py-4 backdrop-blur-md lg:px-8">
        <Link
          href={route(`/s/${spaceId}/budgets`)}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          ← {t('title')}
        </Link>
        <div className="mt-3 flex items-center gap-4">
          <ProgressRing value={card.ratio} size={80} label={card.name} />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{card.name}</h1>
            <p className="text-sm text-muted-foreground">
              {t(`scope.${card.scope}`, {
                category: card.categoryName ?? '—',
                participant: card.participantName ?? '—',
              })}
            </p>
            <p className="mt-1 text-sm">
              <Amount minor={spent} currency={card.currency} />
              <span className="text-muted-foreground"> / </span>
              <Amount minor={limit} currency={card.currency} />
            </p>
          </div>
        </div>
      </header>

      <div className="space-y-8 p-4 lg:p-8">
        <section>
          <h2 className="mb-3 text-sm font-medium tracking-tight">{t('history')}</h2>
          <Sparkline
            data={periods.map((p) => ({ label: p.starts_on.slice(0, 7), value: p.spent_minor }))}
            title={t('history')}
            tone="expense"
          />
        </section>

        <section>
          <h2 className="mb-3 text-sm font-medium tracking-tight">{t('transactions')}</h2>
          {transactions.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('noTransactions')}</p>
          ) : (
            <ul className="divide-y divide-border rounded-xl border border-border">
              {transactions.map((tx) => (
                <li
                  key={tx.id}
                  className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate">{tx.merchant || tx.description || t('untitledTx')}</p>
                    <p className="text-xs text-muted-foreground">{tx.booked_on}</p>
                  </div>
                  <Amount minor={tx.base_amount_minor} currency={tx.currency} className="text-sm" />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
