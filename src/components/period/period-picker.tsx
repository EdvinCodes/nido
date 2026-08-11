'use client';

import { CalendarRange } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useQueryStates, parseAsString, parseAsStringLiteral } from 'nuqs';
import { useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  formatDateRange,
  PERIOD_PRESETS,
  resolvePeriodPreset,
  type PeriodPreset,
  usesCustomMonthStart,
} from '@/lib/dates';
import { cn } from '@/lib/utils';
import { persistPeriodPreference } from '@/features/dashboard/actions';

const presetParser = parseAsStringLiteral(PERIOD_PRESETS).withDefault('this_month');

export function PeriodPicker({
  spaceId,
  timeZone,
  monthStartsOn,
  weekStartsOn = 1,
}: {
  spaceId: string;
  timeZone: string;
  monthStartsOn: number;
  weekStartsOn?: number;
}) {
  const t = useTranslations('period');
  const locale = useLocale();
  const [pending, startTransition] = useTransition();
  const [state, setState] = useQueryStates({
    period: presetParser,
    from: parseAsString.withDefault(''),
    to: parseAsString.withDefault(''),
  });

  const options = { timeZone, monthStartsOn, weekStartsOn };
  const range = resolvePeriodPreset(
    state.period,
    options,
    new Date(),
    state.period === 'custom' && state.from && state.to ? { from: state.from, to: state.to } : null,
  );

  const customMonth = usesCustomMonthStart(monthStartsOn);
  const label = formatDateRange(range.from, range.to, { locale });

  function apply(preset: PeriodPreset, from = '', to = ''): void {
    startTransition(() => {
      void setState({ period: preset, from, to });
      void persistPeriodPreference({
        spaceId,
        preset,
        from: from || null,
        to: to || null,
      });
    });
  }

  return (
    <div className="flex max-w-full min-w-0 flex-wrap items-center gap-2">
      <div className="flex max-w-full flex-wrap items-center gap-1 overflow-x-auto rounded-lg border border-border bg-surface/60 p-1">
        {PERIOD_PRESETS.filter((preset) => preset !== 'custom').map((preset) => (
          <button
            key={preset}
            type="button"
            disabled={pending}
            aria-pressed={state.period === preset}
            className={cn(
              'h-8 rounded-md px-2.5 text-xs font-medium transition-colors',
              state.period === preset
                ? 'bg-primary/15 text-foreground'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
            )}
            onClick={() => {
              apply(preset);
            }}
          >
            {t(`presets.${preset}`)}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-1.5">
        <Input
          type="date"
          aria-label={t('from')}
          value={state.period === 'custom' ? state.from : range.from}
          className="h-8 w-auto"
          onChange={(event) => {
            const from = event.target.value;
            const to = state.period === 'custom' && state.to ? state.to : range.to;
            if (!from) return;
            apply('custom', from, to >= from ? to : from);
          }}
        />
        <span className="text-xs text-muted-foreground">–</span>
        <Input
          type="date"
          aria-label={t('to')}
          value={state.period === 'custom' ? state.to : range.to}
          className="h-8 w-auto"
          onChange={(event) => {
            const to = event.target.value;
            const from = state.period === 'custom' && state.from ? state.from : range.from;
            if (!to) return;
            apply('custom', to >= from ? from : to, to);
          }}
        />
      </div>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <CalendarRange className="size-3.5 shrink-0" aria-hidden />
        <span title={customMonth ? t('customMonthHint', { day: monthStartsOn }) : undefined}>
          {label}
        </span>
      </div>
      {state.period === 'custom' ? (
        <Button
          type="button"
          size="xs"
          variant="ghost"
          onClick={() => {
            apply('this_month');
          }}
        >
          {t('reset')}
        </Button>
      ) : null}
    </div>
  );
}
