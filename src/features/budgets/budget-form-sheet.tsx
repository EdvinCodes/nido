'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
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
import { archiveBudget, createBudget, updateBudget } from './actions';
import type { CreateBudgetInput } from './schemas';
import type { BudgetCardModel, BudgetScope } from './types';

const THRESHOLDS = [50, 80, 100, 75, 90, 110] as const;

function BudgetFormFields({
  spaceId,
  currency,
  categories,
  participants,
  initial,
  onDone,
}: {
  spaceId: string;
  currency: string;
  categories: Array<{ id: string; name: string; color: string }>;
  participants: Array<{ id: string; displayName: string }>;
  initial: BudgetCardModel | null;
  onDone: () => void;
}) {
  const t = useTranslations('budgets');
  const tCommon = useTranslations('common');
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(initial?.name ?? '');
  const [scope, setScope] = useState<BudgetScope>(initial?.scope ?? 'category');
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? categories[0]?.id ?? '');
  const [participantId, setParticipantId] = useState(
    initial?.participantId ?? participants[0]?.id ?? '',
  );
  const [period, setPeriod] = useState<'week' | 'month' | 'quarter' | 'year'>(
    initial?.period === 'week' ||
      initial?.period === 'month' ||
      initial?.period === 'quarter' ||
      initial?.period === 'year'
      ? initial.period
      : 'month',
  );
  const [limitMajor, setLimitMajor] = useState(
    String((initial?.currentPeriod?.limitMinor ?? 10_000) / 100),
  );
  const [rollover, setRollover] = useState(initial?.rollover ?? false);
  const [startsOn, setStartsOn] = useState(
    initial?.currentPeriod?.startsOn ?? new Date().toISOString().slice(0, 10),
  );
  const [thresholds, setThresholds] = useState<number[]>(
    initial?.alertThresholds.length ? initial.alertThresholds : [50, 80, 100],
  );
  const [error, setError] = useState<string | null>(null);

  function toggleThreshold(value: number) {
    setThresholds((prev) =>
      prev.includes(value)
        ? prev.filter((item) => item !== value)
        : [...prev, value].sort((a, b) => a - b),
    );
  }

  function submit() {
    const limitMinor = Math.round(Number(limitMajor.replace(',', '.')) * 100);
    if (!Number.isFinite(limitMinor) || limitMinor <= 0) {
      setError(t('errors.limit'));
      return;
    }
    if (thresholds.length === 0) {
      setError(t('errors.thresholds'));
      return;
    }

    const payload: CreateBudgetInput = {
      spaceId,
      name: name.trim() || t('untitled'),
      scope,
      categoryId: scope === 'space' || scope === 'participant' ? null : categoryId || null,
      participantId: scope === 'space' || scope === 'category' ? null : participantId || null,
      period,
      limitMinor,
      includeSubcategories: true,
      rollover,
      startsOn,
      endsOn: null,
      alertThresholds: thresholds as CreateBudgetInput['alertThresholds'],
    };

    startTransition(async () => {
      const result = initial
        ? await updateBudget({ ...payload, budgetId: initial.id })
        : await createBudget(payload);
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      onDone();
    });
  }

  function archive() {
    if (!initial) return;
    startTransition(async () => {
      const result = await archiveBudget({ spaceId, budgetId: initial.id });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      onDone();
    });
  }

  return (
    <>
      <div className="flex-1 space-y-4 overflow-y-auto px-1">
        <div className="space-y-2">
          <Label htmlFor="budget-name">{t('fields.name')}</Label>
          <Input
            id="budget-name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
            }}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="budget-scope">{t('fields.scope')}</Label>
          <Select
            value={scope}
            onValueChange={(v) => {
              setScope(v as BudgetScope);
            }}
          >
            <SelectTrigger id="budget-scope">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(['space', 'category', 'participant', 'category_participant'] as const).map((s) => (
                <SelectItem key={s} value={s}>
                  {t(`scopeLabel.${s}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {scope === 'category' || scope === 'category_participant' ? (
          <div className="space-y-2">
            <Label htmlFor="budget-category">{t('fields.category')}</Label>
            <Select
              value={categoryId}
              onValueChange={(v) => {
                setCategoryId(v);
              }}
            >
              <SelectTrigger id="budget-category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}

        {scope === 'participant' || scope === 'category_participant' ? (
          <div className="space-y-2">
            <Label htmlFor="budget-participant">{t('fields.participant')}</Label>
            <Select
              value={participantId}
              onValueChange={(v) => {
                setParticipantId(v);
              }}
            >
              <SelectTrigger id="budget-participant">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {participants.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.displayName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="budget-limit">
              {t('fields.limit')} ({currency})
            </Label>
            <Input
              id="budget-limit"
              inputMode="decimal"
              value={limitMajor}
              onChange={(e) => {
                setLimitMajor(e.target.value);
              }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="budget-period">{t('fields.period')}</Label>
            <Select
              value={period}
              onValueChange={(v) => {
                setPeriod(v as typeof period);
              }}
            >
              <SelectTrigger id="budget-period">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(['week', 'month', 'quarter', 'year'] as const).map((p) => (
                  <SelectItem key={p} value={p}>
                    {t(`period.${p}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="budget-starts">{t('fields.startsOn')}</Label>
          <Input
            id="budget-starts"
            type="date"
            value={startsOn}
            onChange={(e) => {
              setStartsOn(e.target.value);
            }}
          />
        </div>

        <div className="flex items-start gap-2 text-sm">
          <input
            id="budget-rollover"
            type="checkbox"
            className="mt-1"
            checked={rollover}
            onChange={(e) => {
              setRollover(e.target.checked);
            }}
          />
          <Label htmlFor="budget-rollover" className="font-normal">
            <span className="font-medium">{t('fields.rollover')}</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              {t('fields.rolloverHelp')}
            </span>
          </Label>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">{t('fields.thresholds')}</p>
          <div className="flex flex-wrap gap-2">
            {THRESHOLDS.map((value) => {
              const active = thresholds.includes(value);
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    toggleThreshold(value);
                  }}
                  className={
                    active
                      ? 'rounded-md bg-primary px-2.5 py-1 text-xs text-primary-foreground'
                      : 'rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground'
                  }
                >
                  {value}%
                </button>
              );
            })}
          </div>
        </div>

        {error ? <p className="text-sm text-danger">{error}</p> : null}
      </div>

      <SheetFooter className="gap-2 sm:flex-col">
        <Button type="button" disabled={pending} onClick={submit}>
          {initial ? tCommon('save') : t('create')}
        </Button>
        {initial ? (
          <Button type="button" variant="outline" disabled={pending} onClick={archive}>
            {t('archive')}
          </Button>
        ) : null}
      </SheetFooter>
    </>
  );
}

export function BudgetFormSheet({
  open,
  onOpenChange,
  spaceId,
  currency,
  categories,
  participants,
  initial,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  spaceId: string;
  currency: string;
  categories: Array<{ id: string; name: string; color: string }>;
  participants: Array<{ id: string; displayName: string }>;
  initial: BudgetCardModel | null;
}) {
  const t = useTranslations('budgets');
  const formKey = `${initial?.id ?? 'new'}-${open ? 'open' : 'closed'}`;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-4 sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{initial ? t('edit') : t('create')}</SheetTitle>
        </SheetHeader>
        {open ? (
          <BudgetFormFields
            key={formKey}
            spaceId={spaceId}
            currency={currency}
            categories={categories}
            participants={participants}
            initial={initial}
            onDone={() => {
              onOpenChange(false);
            }}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
