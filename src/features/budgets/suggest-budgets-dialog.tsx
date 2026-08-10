'use client';

import { useState, useTransition } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Amount } from '@/components/money/amount';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { acceptBudgetSuggestions } from './actions';
import type { BudgetSuggestion } from './types';

export function SuggestBudgetsDialog({
  open,
  onOpenChange,
  spaceId,
  suggestions,
  currency,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  spaceId: string;
  suggestions: BudgetSuggestion[];
  currency: string;
}) {
  const t = useTranslations('budgets');
  const locale = useLocale();
  void locale;
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(suggestions.map((s) => s.categoryId)),
  );
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function accept(all: boolean) {
    const items = suggestions
      .filter((s) => all || selected.has(s.categoryId))
      .map((s) => ({
        categoryId: s.categoryId,
        name: s.categoryName,
        limitMinor: s.suggestedLimitMinor,
      }));
    if (items.length === 0) return;
    startTransition(async () => {
      const result = await acceptBudgetSuggestions({ spaceId, items });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('suggestTitle')}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">{t('suggestBody')}</p>
        <ul className="max-h-72 space-y-2 overflow-y-auto">
          {suggestions.map((s) => (
            <li key={s.categoryId} className="flex items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={selected.has(s.categoryId)}
                onChange={() => {
                  toggle(s.categoryId);
                }}
              />
              <span
                className="size-2.5 rounded-full"
                style={{ backgroundColor: s.categoryColor }}
                aria-hidden
              />
              <span className="flex-1 truncate">{s.categoryName}</span>
              <Amount minor={s.suggestedLimitMinor} currency={currency} className="text-sm" />
            </li>
          ))}
        </ul>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => {
              accept(false);
            }}
          >
            {t('acceptSelected')}
          </Button>
          <Button
            type="button"
            disabled={pending}
            onClick={() => {
              accept(true);
            }}
          >
            {t('acceptAll')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
