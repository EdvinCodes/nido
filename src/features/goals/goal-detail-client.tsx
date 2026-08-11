'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { Amount } from '@/components/money/amount';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ProgressBar } from '@/components/ui/progress-bar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { isContributor, type MemberRole } from '@/lib/auth';
import { formatMoney, money } from '@/lib/money';
import { route } from '@/lib/routes';
import { contributeToGoal } from './actions';
import { goalProgressRatio, remainingMinor } from './lib/pace';
import type { GoalDetailModel } from './types';

export function GoalDetailClient({
  spaceId,
  role,
  detail,
  participants,
  accounts,
}: {
  spaceId: string;
  role: MemberRole;
  detail: GoalDetailModel;
  participants: Array<{ id: string; displayName: string }>;
  accounts: Array<{ id: string; name: string }>;
}) {
  const t = useTranslations('goals');
  const locale = useLocale();
  const canEdit = isContributor(role);
  const [contributeOpen, setContributeOpen] = useState(false);
  const ratio = goalProgressRatio(detail.savedMinor, detail.targetMinor);
  const left = remainingMinor(detail.targetMinor, detail.savedMinor);
  const maxCumulative = Math.max(
    detail.targetMinor,
    ...detail.cumulative.map((c) => c.savedMinor),
    1,
  );

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      {detail.status === 'reached' ? (
        <div
          className="pointer-events-none absolute inset-x-0 top-0 z-30 h-40 bg-[radial-gradient(circle_at_20%_20%,color-mix(in_oklab,var(--color-accent)_35%,transparent),transparent_45%),radial-gradient(circle_at_80%_30%,color-mix(in_oklab,var(--color-warning)_30%,transparent),transparent_40%)] motion-safe:animate-pulse motion-reduce:hidden"
          aria-hidden
        />
      ) : null}

      <header className="sticky top-0 z-20 space-y-3 border-b border-border/60 bg-background/90 px-4 py-4 backdrop-blur-md lg:px-8">
        <Link
          href={route(`/s/${spaceId}/goals`)}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          {t('back')}
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{detail.name}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              <Amount minor={detail.savedMinor} currency={detail.currency} />
              {' / '}
              <Amount minor={detail.targetMinor} currency={detail.currency} />
            </p>
          </div>
          {canEdit ? (
            <Button
              type="button"
              size="sm"
              onClick={() => {
                setContributeOpen(true);
              }}
            >
              {t('contribute')}
            </Button>
          ) : null}
        </div>
        <ProgressBar value={ratio} label={detail.name} />
        <p className="text-sm text-muted-foreground">
          {t('remaining', { amount: formatMoney(money(left, detail.currency), { locale }) })}
        </p>
      </header>

      <div className="grid flex-1 gap-6 p-4 lg:grid-cols-[1.2fr_1fr] lg:p-8">
        <section className="space-y-3">
          <h2 className="text-sm font-medium tracking-tight">{t('history')}</h2>
          <ul className="space-y-2">
            {detail.contributions.length === 0 ? (
              <li className="text-sm text-muted-foreground">{t('noContributions')}</li>
            ) : (
              [...detail.contributions].reverse().map((c) => (
                <li
                  key={c.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border/70 px-3 py-2 text-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{c.participantName}</p>
                    <p className="text-xs text-muted-foreground">
                      {c.contributedOn}
                      {c.note ? ` · ${c.note}` : ''}
                    </p>
                  </div>
                  <Amount minor={c.amountMinor} currency={detail.currency} tone="auto" />
                </li>
              ))
            )}
          </ul>
        </section>

        <section className="space-y-4">
          <div>
            <h2 className="text-sm font-medium tracking-tight">{t('byParticipant')}</h2>
            <ul className="mt-2 space-y-1.5 text-sm">
              {detail.byParticipant.map((p) => (
                <li key={p.participantId} className="flex justify-between gap-2">
                  <span className="truncate">{p.participantName}</span>
                  <Amount minor={p.totalMinor} currency={detail.currency} tone="auto" />
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="text-sm font-medium tracking-tight">{t('chart')}</h2>
            <div className="mt-3 flex h-28 items-end gap-1">
              {detail.cumulative.map((point, index) => (
                <div
                  key={`${point.on}-${index}`}
                  className="flex-1 rounded-t bg-accent/70"
                  style={{ height: `${Math.max(4, (point.savedMinor / maxCumulative) * 100)}%` }}
                  title={`${point.on}: ${point.savedMinor}`}
                />
              ))}
            </div>
          </div>

          {detail.projection.requiredMonthlyMinor !== null ? (
            <p
              className={
                detail.projection.onPace ? 'text-sm text-accent' : 'text-sm text-warning-text'
              }
            >
              {t('pace', {
                need: formatMoney(money(detail.projection.requiredMonthlyMinor, detail.currency), {
                  locale,
                }),
                avg: formatMoney(money(detail.projection.averageMonthlyMinor, detail.currency), {
                  locale,
                }),
              })}
            </p>
          ) : null}
        </section>
      </div>

      <ContributeSheet
        open={contributeOpen}
        onOpenChange={setContributeOpen}
        spaceId={spaceId}
        goalId={detail.id}
        participants={participants}
        accounts={accounts}
        linkedAccountId={detail.accountId}
      />
    </div>
  );
}

function ContributeSheet({
  open,
  onOpenChange,
  spaceId,
  goalId,
  participants,
  accounts,
  linkedAccountId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  spaceId: string;
  goalId: string;
  participants: Array<{ id: string; displayName: string }>;
  accounts: Array<{ id: string; name: string }>;
  linkedAccountId: string | null;
}) {
  const t = useTranslations('goals');
  const tCommon = useTranslations('common');
  const [pending, startTransition] = useTransition();
  const [amountMajor, setAmountMajor] = useState('50');
  const [withdrawal, setWithdrawal] = useState(false);
  const [participantId, setParticipantId] = useState(participants[0]?.id ?? '');
  const [contributedOn, setContributedOn] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState('');
  const [asTransfer, setAsTransfer] = useState(false);
  const [fromAccountId] = useState(accounts[0]?.id ?? '');
  const [error, setError] = useState<string | null>(null);

  function submit() {
    const abs = Math.round(Number(amountMajor.replace(',', '.')) * 100);
    if (!Number.isFinite(abs) || abs <= 0) {
      setError(t('errors.amount'));
      return;
    }
    if (withdrawal && !note.trim()) {
      setError(t('errors.withdrawalNote'));
      return;
    }

    startTransition(async () => {
      const result = await contributeToGoal({
        spaceId,
        goalId,
        participantId,
        amountMinor: withdrawal ? -abs : abs,
        contributedOn,
        note: note.trim() || null,
        asTransfer: asTransfer && !withdrawal,
        fromAccountId: asTransfer ? fromAccountId : null,
        toAccountId: asTransfer
          ? (linkedAccountId ?? accounts.find((a) => a.id !== fromAccountId)?.id ?? null)
          : null,
      });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      onOpenChange(false);
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col gap-4 sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{withdrawal ? t('withdraw') : t('contribute')}</SheetTitle>
        </SheetHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>{t('fields.amount')}</Label>
            <Input
              inputMode="decimal"
              value={amountMajor}
              onChange={(e) => {
                setAmountMajor(e.target.value);
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t('fields.participant')}</Label>
            <Select value={participantId} onValueChange={setParticipantId}>
              <SelectTrigger>
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
          <div className="space-y-1.5">
            <Label>{t('fields.date')}</Label>
            <Input
              type="date"
              value={contributedOn}
              onChange={(e) => {
                setContributedOn(e.target.value);
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t('fields.note')}</Label>
            <Input
              value={note}
              onChange={(e) => {
                setNote(e.target.value);
              }}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={withdrawal}
              onChange={(e) => {
                setWithdrawal(e.target.checked);
                if (e.target.checked) setAsTransfer(false);
              }}
            />
            {t('fields.withdrawal')}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={asTransfer}
              disabled={withdrawal || !linkedAccountId}
              onChange={(e) => {
                setAsTransfer(e.target.checked);
              }}
            />
            {t('fields.asTransfer')}
          </label>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
        </div>
        <SheetFooter>
          <Button type="button" disabled={pending} onClick={submit}>
            {tCommon('save')}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
