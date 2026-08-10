'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { Amount } from '@/components/money/amount';
import { ProgressRing } from '@/components/ui/progress-ring';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { route } from '@/lib/routes';
import { formatMoney, money } from '@/lib/money';
import type { MemberRole } from '@/lib/auth';
import { isContributor } from '@/lib/auth';
import { BudgetFormSheet } from './budget-form-sheet';
import { SuggestBudgetsDialog } from './suggest-budgets-dialog';
import type { BudgetCardModel, BudgetSuggestion } from './types';

const Sparkline = dynamic(() => import('@/components/charts/sparkline').then((m) => m.Sparkline), {
  ssr: false,
  loading: () => <Skeleton className="h-10 w-full rounded-md" />,
});

export function BudgetsListClient({
  spaceId,
  role,
  currency,
  cards,
  suggestions,
  categories,
  participants,
}: {
  spaceId: string;
  role: MemberRole;
  currency: string;
  cards: BudgetCardModel[];
  suggestions: BudgetSuggestion[];
  categories: Array<{ id: string; name: string; color: string }>;
  participants: Array<{ id: string; displayName: string }>;
}) {
  const t = useTranslations('budgets');
  const locale = useLocale();
  const canEdit = isContributor(role);
  const [formOpen, setFormOpen] = useState(false);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [editing, setEditing] = useState<BudgetCardModel | null>(null);
  const [, startTransition] = useTransition();

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 border-b border-border/60 bg-background/90 px-4 py-4 backdrop-blur-md lg:px-8">
        <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
        {canEdit ? (
          <div className="flex flex-wrap gap-2">
            {suggestions.length > 0 ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setSuggestOpen(true);
                }}
              >
                {t('suggest')}
              </Button>
            ) : null}
            <Button
              type="button"
              size="sm"
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              {t('create')}
            </Button>
          </div>
        ) : null}
      </header>

      <div className="flex-1 space-y-3 p-4 lg:p-8">
        {cards.length === 0 ? (
          <EmptyState
            title={t('emptyTitle')}
            body={t('emptyBody')}
            action={
              canEdit ? (
                <Button
                  type="button"
                  onClick={() => {
                    setEditing(null);
                    setFormOpen(true);
                  }}
                >
                  {t('create')}
                </Button>
              ) : undefined
            }
          />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {cards.map((card) => {
              const limit = card.currentPeriod?.limitMinor ?? 0;
              const spent = card.currentPeriod?.spentMinor ?? 0;
              const over = card.ratio > 1;
              return (
                <li
                  key={card.id}
                  className="flex h-full flex-col gap-3 rounded-xl border border-border bg-surface/40 p-4"
                >
                  <Link
                    href={route(`/s/${spaceId}/budgets/${card.id}`)}
                    className="flex flex-1 flex-col gap-3 transition-colors hover:opacity-90"
                  >
                    <div className="flex items-start gap-3">
                      <ProgressRing value={card.ratio} size={64} label={card.name} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium tracking-tight">{card.name}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {t(`scope.${card.scope}`, {
                            category: card.categoryName ?? '—',
                            participant: card.participantName ?? '—',
                          })}
                          {' · '}
                          {t(`period.${card.period}`)}
                        </p>
                        <p className="mt-2 text-sm">
                          <Amount minor={spent} currency={card.currency} className="text-sm" />
                          <span className="text-muted-foreground"> / </span>
                          <Amount minor={limit} currency={card.currency} className="text-sm" />
                        </p>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {over
                        ? t('overBy', {
                            amount: formatMoney(money(spent - limit, card.currency), { locale }),
                          })
                        : t('remaining', {
                            amount: formatMoney(
                              money(Math.max(card.remainingMinor, 0), card.currency),
                              { locale },
                            ),
                          })}
                      {' · '}
                      {t('daysLeft', { count: card.daysLeft })}
                      {card.dailyAllowanceMinor != null && !over ? (
                        <>
                          {' · '}
                          {t('daily', {
                            amount: formatMoney(money(card.dailyAllowanceMinor, card.currency), {
                              locale,
                            }),
                          })}
                        </>
                      ) : null}
                    </p>
                    <Sparkline data={card.sparkline} title={t('sparkline')} tone="expense" />
                  </Link>
                  {canEdit ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="self-start"
                      onClick={() => {
                        startTransition(() => {
                          setEditing(card);
                          setFormOpen(true);
                        });
                      }}
                    >
                      {t('edit')}
                    </Button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <BudgetFormSheet
        open={formOpen}
        onOpenChange={setFormOpen}
        spaceId={spaceId}
        currency={currency}
        categories={categories}
        participants={participants}
        initial={editing}
      />
      <SuggestBudgetsDialog
        open={suggestOpen}
        onOpenChange={setSuggestOpen}
        spaceId={spaceId}
        suggestions={suggestions}
        currency={currency}
      />
    </div>
  );
}
