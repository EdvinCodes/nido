import {
  isPeriodPreset,
  resolvePeriodPreset,
  type DateRange,
  type PeriodOptions,
  type PeriodPreset,
} from '@/lib/dates';

export function resolveDashboardPeriod(
  searchParams: Record<string, string | string[] | undefined>,
  options: PeriodOptions,
  defaults?: {
    preset?: string | null;
    from?: string | null;
    to?: string | null;
  },
  now: Date = new Date(),
): { preset: PeriodPreset; range: DateRange } {
  const rawPeriod = typeof searchParams.period === 'string' ? searchParams.period : undefined;
  const from = typeof searchParams.from === 'string' ? searchParams.from : '';
  const to = typeof searchParams.to === 'string' ? searchParams.to : '';

  let preset: PeriodPreset = 'this_month';
  if (rawPeriod && isPeriodPreset(rawPeriod)) {
    preset = rawPeriod;
  } else if (defaults?.preset && isPeriodPreset(defaults.preset)) {
    preset = defaults.preset;
  }

  const custom =
    preset === 'custom'
      ? {
          from: from || defaults?.from || '',
          to: to || defaults?.to || '',
        }
      : null;

  const range = resolvePeriodPreset(
    preset,
    options,
    now,
    custom && custom.from && custom.to ? { from: custom.from, to: custom.to } : null,
  );

  return { preset, range };
}

export function deltaRatio(current: number, previous: number): number | null {
  if (previous === 0) {
    if (current === 0) return 0;
    return null;
  }
  return (current - previous) / previous;
}
