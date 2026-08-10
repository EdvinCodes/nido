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
import { archiveGoal, createGoal, updateGoal } from './actions';
import type { GoalCardModel } from './types';

const COLORS = ['#2F6F4E', '#C45C26', '#3D5A80', '#8B8B8B', '#9B2226', '#7B2CBF'];

export function GoalFormSheet({
  open,
  onOpenChange,
  spaceId,
  currency,
  accounts,
  initial,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  spaceId: string;
  currency: string;
  accounts: Array<{ id: string; name: string }>;
  initial: GoalCardModel | null;
}) {
  const t = useTranslations('goals');
  const tCommon = useTranslations('common');
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(initial?.name ?? '');
  const [targetMajor, setTargetMajor] = useState(String((initial?.targetMinor ?? 100000) / 100));
  const [targetDate, setTargetDate] = useState(initial?.targetDate ?? '');
  const [color, setColor] = useState(initial?.color ?? COLORS[0]);
  const [icon, setIcon] = useState(initial?.icon ?? 'piggy-bank');
  const [accountId, setAccountId] = useState(initial?.accountId ?? '');
  const [error, setError] = useState<string | null>(null);

  function submit() {
    const targetMinor = Math.round(Number(targetMajor.replace(',', '.')) * 100);
    if (!Number.isFinite(targetMinor) || targetMinor <= 0) {
      setError(t('errors.target'));
      return;
    }

    startTransition(async () => {
      const payload = {
        spaceId,
        name: name.trim() || t('untitled'),
        description: null,
        targetMinor,
        currency,
        targetDate: targetDate || null,
        accountId: accountId || null,
        color,
        icon,
      };
      const result = initial
        ? await updateGoal({ ...payload, goalId: initial.id })
        : await createGoal(payload);
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      onOpenChange(false);
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col gap-4 overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{initial ? t('edit') : t('create')}</SheetTitle>
        </SheetHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="goal-name">{t('fields.name')}</Label>
            <Input
              id="goal-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="goal-target">{t('fields.target')}</Label>
            <Input
              id="goal-target"
              inputMode="decimal"
              value={targetMajor}
              onChange={(e) => {
                setTargetMajor(e.target.value);
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="goal-date">{t('fields.targetDate')}</Label>
            <Input
              id="goal-date"
              type="date"
              value={targetDate}
              onChange={(e) => {
                setTargetDate(e.target.value);
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t('fields.color')}</Label>
            <div className="flex flex-wrap gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`size-7 rounded-full border-2 ${color === c ? 'border-foreground' : 'border-transparent'}`}
                  style={{ backgroundColor: c }}
                  aria-label={c}
                  onClick={() => {
                    setColor(c);
                  }}
                />
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="goal-icon">{t('fields.icon')}</Label>
            <Input
              id="goal-icon"
              value={icon}
              onChange={(e) => {
                setIcon(e.target.value);
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t('fields.account')}</Label>
            <Select
              value={accountId || 'none'}
              onValueChange={(v) => {
                setAccountId(v === 'none' ? '' : v);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t('fields.noAccount')}</SelectItem>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
        </div>

        <SheetFooter className="gap-2 sm:flex-col">
          <Button type="button" disabled={pending} onClick={submit}>
            {tCommon('save')}
          </Button>
          {initial ? (
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => {
                startTransition(async () => {
                  await archiveGoal({ spaceId, goalId: initial.id });
                  onOpenChange(false);
                });
              }}
            >
              {t('archive')}
            </Button>
          ) : null}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
