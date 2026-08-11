'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useTransition } from 'react';
import { dismissInsightAction } from '@/features/assistant/actions';
import type { AiInsightRow } from '@/features/assistant/queries';
import { ledgerHref } from '@/features/dashboard/lib/ledger-href';
import { Button } from '@/components/ui/button';
import { formatMoney, money } from '@/lib/money';
import { route } from '@/lib/routes';

export function AiInsightsRail({
  spaceId,
  currency,
  insights,
}: {
  spaceId: string;
  currency: string;
  insights: AiInsightRow[];
}) {
  const t = useTranslations('assistant.insights');
  const locale = useLocale();
  const [pending, startTransition] = useTransition();

  if (!insights.length) return null;

  return (
    <section className="space-y-3" aria-label={t('title')}>
      <h2 className="text-sm font-medium">{t('title')}</h2>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {insights.map((insight) => {
          const evidence = insight.evidence as { transaction_ids?: string[] };
          const txIds = evidence.transaction_ids ?? [];
          const href = txIds.length ? ledgerHref({ spaceId, transactionIds: txIds }) : null;
          return (
            <article
              key={insight.id}
              className="rounded-xl border border-border bg-surface p-4 text-sm"
            >
              <p className="font-medium">{insight.title}</p>
              <p className="mt-1 text-muted-foreground">{insight.body}</p>
              {insight.potential_saving_minor != null ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  {t('potentialSaving', {
                    amount: formatMoney(money(insight.potential_saving_minor, currency), {
                      locale,
                    }),
                  })}
                </p>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                {href ? (
                  <Button asChild size="sm" variant="outline">
                    <Link href={route(href)}>{t('viewTransactions')}</Link>
                  </Button>
                ) : null}
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => {
                    startTransition(async () => {
                      await dismissInsightAction({ spaceId, insightId: insight.id });
                    });
                  }}
                >
                  {t('dismiss')}
                </Button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
