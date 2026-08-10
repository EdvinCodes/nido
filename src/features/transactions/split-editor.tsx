'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Amount } from '@/components/money/amount';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  computeSplits,
  type SplitMode,
  type SplitParticipantInput,
} from '@/features/transactions/lib/compute-splits';
import { validateSplit } from '@/features/transactions/lib/validate-split';
import { weightsFromMode } from '@/features/transactions/lib/weights-from-mode';
import { cn } from '@/lib/utils';

export type SplitEditorParticipant = {
  id: string;
  displayName: string;
  color: string;
  position: number;
};

const MODES: SplitMode[] = ['personal', 'equal', 'shares', 'percent', 'exact'];

export type SplitEditorProps = {
  amountMinor: number;
  currency: string;
  locale?: string;
  mode: SplitMode;
  onModeChange: (mode: SplitMode) => void;
  participants: SplitEditorParticipant[];
  selected: SplitParticipantInput[];
  onSelectedChange: (next: SplitParticipantInput[]) => void;
};

export function SplitEditor({
  amountMinor,
  currency,
  locale = 'es-ES',
  mode,
  onModeChange,
  participants,
  selected,
  onSelectedChange,
}: SplitEditorProps) {
  const t = useTranslations('transactions');
  const amount = BigInt(amountMinor);

  const validation = useMemo(() => validateSplit(mode, selected, amount), [mode, selected, amount]);

  const preview = useMemo(() => {
    if (!validation.ok || amountMinor <= 0 || selected.length === 0) return [];
    try {
      return computeSplits(amount, mode, selected);
    } catch {
      return [];
    }
  }, [validation.ok, amountMinor, selected, amount, mode]);

  function toggleParticipant(id: string): void {
    const exists = selected.some((p) => p.participantId === id);
    let next: SplitParticipantInput[];
    if (exists) {
      next = selected.filter((p) => p.participantId !== id);
    } else {
      const meta = participants.find((p) => p.id === id);
      const added: SplitParticipantInput = {
        participantId: id,
        weight: mode === 'percent' ? 0 : 1,
        owedMinor: 0n,
      };
      if (meta) added.position = meta.position;
      next = [...selected, added];
    }
    if (mode === 'personal' && next.length > 1) {
      const last = next[next.length - 1];
      next = last ? [last] : [];
    }
    onSelectedChange(weightsFromMode(mode, next, preview));
  }

  function switchMode(nextMode: SplitMode): void {
    onModeChange(nextMode);
    onSelectedChange(weightsFromMode(nextMode, selected, preview));
  }

  function setWeight(participantId: string, weight: number): void {
    onSelectedChange(
      selected.map((p) => (p.participantId === participantId ? { ...p, weight } : p)),
    );
  }

  function setOwed(participantId: string, owedMinor: number): void {
    onSelectedChange(
      selected.map((p) =>
        p.participantId === participantId ? { ...p, owedMinor: BigInt(owedMinor) } : p,
      ),
    );
  }

  function giveRestTo(participantId: string): void {
    if (mode !== 'exact') return;
    const others = selected
      .filter((p) => p.participantId !== participantId)
      .reduce((sum, p) => sum + Number(p.owedMinor ?? 0n), 0);
    const rest = Math.max(0, amountMinor - others);
    setOwed(participantId, rest);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-1">
        {MODES.map((m) => (
          <Button
            key={m}
            type="button"
            size="sm"
            variant={mode === m ? 'default' : 'outline'}
            onClick={() => {
              switchMode(m);
            }}
          >
            {t(`splitMode.${m}`)}
          </Button>
        ))}
      </div>

      <ul className="flex flex-col gap-2">
        {participants.map((p) => {
          const active = selected.some((s) => s.participantId === p.id);
          const row = selected.find((s) => s.participantId === p.id);
          const previewRow = preview.find((s) => s.participantId === p.id);
          return (
            <li
              key={p.id}
              className={cn(
                'flex flex-col gap-2 rounded-lg border border-border px-3 py-2',
                !active && 'opacity-60',
              )}
            >
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="flex flex-1 items-center gap-2 text-left"
                  onClick={() => {
                    toggleParticipant(p.id);
                  }}
                >
                  <span
                    className="size-3 rounded-full"
                    style={{ backgroundColor: p.color }}
                    aria-hidden
                  />
                  <span className="text-sm font-medium">{p.displayName}</span>
                </button>
                {previewRow ? (
                  <Amount
                    minor={previewRow.owedMinor}
                    currency={currency}
                    locale={locale}
                    className="text-sm"
                  />
                ) : null}
              </div>
              {active && mode === 'shares' ? (
                <Label className="flex items-center gap-2 text-xs">
                  {t('weight')}
                  <Input
                    type="number"
                    min={0}
                    step={1}
                    className="h-8 w-24"
                    value={row?.weight ?? 1}
                    onChange={(e) => {
                      setWeight(p.id, Number(e.target.value) || 0);
                    }}
                  />
                </Label>
              ) : null}
              {active && mode === 'percent' ? (
                <Label className="flex items-center gap-2 text-xs">
                  {t('percent')}
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    step={0.01}
                    className="h-8 w-24"
                    value={row?.weight ?? 0}
                    onChange={(e) => {
                      setWeight(p.id, Number(e.target.value) || 0);
                    }}
                  />
                </Label>
              ) : null}
              {active && mode === 'exact' ? (
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={0}
                    step={1}
                    className="h-8 w-32"
                    value={row?.owedMinor != null ? Number(row.owedMinor) : 0}
                    onChange={(e) => {
                      setOwed(p.id, Number(e.target.value) || 0);
                    }}
                    aria-label={t('exactAmount')}
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      giveRestTo(p.id);
                    }}
                  >
                    {t('giveRest')}
                  </Button>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>

      {!validation.ok ? (
        <p className="text-sm text-amber-600 dark:text-amber-400" role="status">
          {t(validation.errorKey)}
          {validation.remainderMinor !== 0n ? (
            <>
              {' '}
              <Amount
                minor={
                  validation.remainderMinor < 0n
                    ? -validation.remainderMinor
                    : validation.remainderMinor
                }
                currency={currency}
                locale={locale}
                className="text-sm"
              />
            </>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}

/** Local state helper for forms that own split selection. */
export function useSplitSelection(initial: SplitParticipantInput[]) {
  return useState(initial);
}
