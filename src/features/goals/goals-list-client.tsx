'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { Amount } from '@/components/money/amount';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ProgressBar } from '@/components/ui/progress-bar';
import { isContributor, type MemberRole } from '@/lib/auth';
import { formatMoney, money } from '@/lib/money';
import { route } from '@/lib/routes';
import { goalProgressRatio, remainingMinor } from './lib/pace';
import { GoalFormSheet } from './goal-form-sheet';
import type { GoalCardModel } from './types';

export function GoalsListClient({
  spaceId,
  role,
  currency,
  cards,
  accounts,
}: {
  spaceId: string;
  role: MemberRole;
  currency: string;
  cards: GoalCardModel[];
  accounts: Array<{ id: string; name: string }>;
}) {
  const t = useTranslations('goals');
  const locale = useLocale();
  const canEdit = isContributor(role);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<GoalCardModel | null>(null);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 border-b border-border/60 bg-background/90 px-4 py-4 backdrop-blur-md lg:px-8">
        <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
        {canEdit ? (
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
              const ratio = goalProgressRatio(card.savedMinor, card.targetMinor);
              const left = remainingMinor(card.targetMinor, card.savedMinor);
              const paceClass =
                card.projection.onPace === null
                  ? 'text-muted-foreground'
                  : card.projection.onPace
                    ? 'text-accent'
                    : 'text-warning';
              return (
                <li
                  key={card.id}
                  className="flex h-full flex-col gap-3 rounded-xl border border-border bg-surface/40 p-4"
                >
                  <Link
                    href={route(`/s/${spaceId}/goals/${card.id}`)}
                    className="flex flex-1 flex-col gap-3 transition-colors hover:opacity-90"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-medium tracking-tight">{card.name}</p>
                        {card.targetDate ? (
                          <p className="mt-0.5 text-xs text-muted-foreground">{card.targetDate}</p>
                        ) : null}
                      </div>
                      <span
                        className="mt-1 size-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: card.color }}
                        aria-hidden
                      />
                    </div>
                    <ProgressBar value={ratio} label={card.name} />
                    <div className="flex justify-between text-sm">
                      <Amount minor={card.savedMinor} currency={card.currency} />
                      <span className="text-muted-foreground">
                        {t('remaining', {
                          amount: formatMoney(money(left, card.currency), { locale }),
                        })}
                      </span>
                    </div>
                    {card.projection.requiredMonthlyMinor !== null ? (
                      <p className={`text-xs ${paceClass}`}>
                        {t('pace', {
                          need: formatMoney(
                            money(card.projection.requiredMonthlyMinor, card.currency),
                            { locale },
                          ),
                          avg: formatMoney(
                            money(card.projection.averageMonthlyMinor, card.currency),
                            { locale },
                          ),
                        })}
                      </p>
                    ) : card.projection.projectedCompletionOn ? (
                      <p className="text-xs text-muted-foreground">
                        {t('projected', { date: card.projection.projectedCompletionOn })}
                      </p>
                    ) : null}
                  </Link>
                  {canEdit ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="self-start"
                      onClick={() => {
                        setEditing(card);
                        setFormOpen(true);
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

      <GoalFormSheet
        open={formOpen}
        onOpenChange={setFormOpen}
        spaceId={spaceId}
        currency={currency}
        accounts={accounts}
        initial={editing}
      />
    </div>
  );
}
