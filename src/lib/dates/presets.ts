/**
 * Named period presets for the global PeriodPicker.
 * "Month" always honours the space's monthStartsOn.
 */

import {
  addDays,
  addMonths,
  currentPeriod,
  periodBounds,
  previousPeriod,
  previousRange,
  todayIn,
  type DateRange,
  type PeriodOptions,
} from './periods';

export const PERIOD_PRESETS = [
  'this_month',
  'last_month',
  'last_3_months',
  'this_year',
  'last_year',
  'custom',
] as const;

export type PeriodPreset = (typeof PERIOD_PRESETS)[number];

export function isPeriodPreset(value: string): value is PeriodPreset {
  return (PERIOD_PRESETS as readonly string[]).includes(value);
}

export function resolvePeriodPreset(
  preset: PeriodPreset,
  options: PeriodOptions = {},
  now: Date = new Date(),
  custom?: DateRange | null,
): DateRange {
  switch (preset) {
    case 'this_month':
      return currentPeriod('month', options, now);
    case 'last_month': {
      const thisMonth = currentPeriod('month', options, now);
      return previousPeriod('month', thisMonth, options);
    }
    case 'last_3_months': {
      const thisMonth = currentPeriod('month', options, now);
      const startMonth = periodBounds('month', addMonths(thisMonth.from, -2), options);
      return { from: startMonth.from, to: thisMonth.to };
    }
    case 'this_year':
      return currentPeriod('year', options, now);
    case 'last_year': {
      const thisYear = currentPeriod('year', options, now);
      return previousPeriod('year', thisYear, options);
    }
    case 'custom': {
      if (!custom?.from || !custom.to || custom.from > custom.to) {
        return currentPeriod('month', options, now);
      }
      return custom;
    }
  }
}

/** Comparable previous window for deltas (same length, immediately before). */
export function deltaRangeFor(range: DateRange): DateRange {
  return previousRange(range);
}

/** Whether the household month is non-calendar (needs boundary labels). */
export function usesCustomMonthStart(monthStartsOn: number | undefined): boolean {
  return (monthStartsOn ?? 1) !== 1;
}

/** Midpoint helper so custom ranges stay stable when clamping. */
export function clampRange(range: DateRange, maxDays = 3660): DateRange {
  if (range.from > range.to) return { from: range.to, to: range.from };
  const span = Math.round(
    (Date.parse(`${range.to}T00:00:00Z`) - Date.parse(`${range.from}T00:00:00Z`)) / 86_400_000,
  );
  if (span + 1 <= maxDays) return range;
  return { from: addDays(range.to, -(maxDays - 1)), to: range.to };
}

export function referenceToday(options: PeriodOptions = {}, now: Date = new Date()): string {
  return todayIn(options.timeZone ?? 'Europe/Madrid', now);
}
