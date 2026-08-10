'use client';

/**
 * The only place a component should reach for locale-aware formatting. Nothing outside this
 * hook and `@/lib/money` / `@/lib/dates` instantiates an `Intl` formatter directly, so a
 * locale change never means hunting down formatters scattered across components.
 */

import { useLocale } from 'next-intl';
import { useMemo } from 'react';
import { formatDate, formatDateRange, formatRelativeDate, type IsoDate } from '@/lib/dates';
import {
  formatMoney,
  formatMoneyOrDash,
  formatPercent,
  type FormatMoneyOptions,
  type Money,
} from '@/lib/money';

export interface Formatters {
  money: (value: Money, options?: Omit<FormatMoneyOptions, 'locale'>) => string;
  moneyOrDash: (
    value: Money | null | undefined,
    options?: Omit<FormatMoneyOptions, 'locale'>,
  ) => string;
  percent: (value: number, maximumFractionDigits?: number) => string;
  number: (value: number, options?: Intl.NumberFormatOptions) => string;
  date: (value: IsoDate, timeZone?: string) => string;
  dateRange: (from: IsoDate, to: IsoDate, timeZone?: string) => string;
  relativeDate: (value: IsoDate, timeZone?: string, now?: Date) => string;
}

export function useFormatters(): Formatters {
  const locale = useLocale();

  return useMemo<Formatters>(
    () => ({
      money: (value, options) => formatMoney(value, { ...options, locale }),
      moneyOrDash: (value, options) => formatMoneyOrDash(value, { ...options, locale }),
      percent: (value, maximumFractionDigits) =>
        formatPercent(value, locale, maximumFractionDigits),
      number: (value, options) => new Intl.NumberFormat(locale, options).format(value),
      date: (value, timeZone) => formatDate(value, { locale, ...(timeZone ? { timeZone } : {}) }),
      dateRange: (from, to, timeZone) =>
        formatDateRange(from, to, { locale, ...(timeZone ? { timeZone } : {}) }),
      relativeDate: (value, timeZone, now) =>
        formatRelativeDate(value, {
          locale,
          ...(timeZone ? { timeZone } : {}),
          ...(now ? { now } : {}),
        }),
    }),
    [locale],
  );
}
