/**
 * Date formatting for humans. Recent dates are relative ("Hoy", "Ayer", "lunes");
 * anything older is absolute. See docs/03-DESIGN-SYSTEM.md §11.
 */

import { differenceInDays, todayIn, type IsoDate } from './periods';

export interface DateFormatOptions {
  locale?: string;
  timeZone?: string;
  /** Injected clock. Tests must never depend on the real current date. */
  now?: Date;
}

const cache = new Map<string, Intl.DateTimeFormat>();

function formatter(key: string, factory: () => Intl.DateTimeFormat): Intl.DateTimeFormat {
  const cached = cache.get(key);
  if (cached) return cached;
  const created = factory();
  cache.set(key, created);
  return created;
}

/** Parses an ISO calendar day into a Date at UTC midnight, for formatting only. */
function asDate(date: IsoDate): Date {
  return new Date(`${date}T00:00:00Z`);
}

export function formatDate(date: IsoDate, options: DateFormatOptions = {}): string {
  const { locale = 'es-ES' } = options;
  return formatter(`d|${locale}`, () =>
    new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }),
  ).format(asDate(date));
}

export function formatDateLong(date: IsoDate, options: DateFormatOptions = {}): string {
  const { locale = 'es-ES' } = options;
  return formatter(`dl|${locale}`, () =>
    new Intl.DateTimeFormat(locale, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }),
  ).format(asDate(date));
}

export function formatWeekday(date: IsoDate, options: DateFormatOptions = {}): string {
  const { locale = 'es-ES' } = options;
  return formatter(`w|${locale}`, () =>
    new Intl.DateTimeFormat(locale, { weekday: 'long', timeZone: 'UTC' }),
  ).format(asDate(date));
}

/**
 * "Hoy", "Ayer", the weekday name within the last week, and an absolute date beyond that.
 * Ledger day headers use this.
 */
export function formatRelativeDate(date: IsoDate, options: DateFormatOptions = {}): string {
  const { locale = 'es-ES', timeZone = 'Europe/Madrid', now = new Date() } = options;
  const today = todayIn(timeZone, now);
  const delta = differenceInDays(today, date);

  if (delta === 0 || delta === -1 || delta === 1) {
    const relative = formatter(`rel|${locale}`, () =>
      new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }) as unknown as Intl.DateTimeFormat,
    ) as unknown as Intl.RelativeTimeFormat;
    return capitalize(relative.format(delta, 'day'));
  }

  if (delta > 1 && delta < 7) return capitalize(formatWeekday(date, options));

  return formatDate(date, options);
}

/** Renders a period as "25 jul – 24 ago" or "25 jul 2025 – 24 ago 2026" across a year boundary. */
export function formatDateRange(
  from: IsoDate,
  to: IsoDate,
  options: DateFormatOptions = {},
): string {
  const { locale = 'es-ES' } = options;
  const sameYear = from.slice(0, 4) === to.slice(0, 4);
  const short = formatter(`ds|${locale}`, () =>
    new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', timeZone: 'UTC' }),
  );
  const full = formatter(`d|${locale}`, () =>
    new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }),
  );
  const start = sameYear ? short.format(asDate(from)) : full.format(asDate(from));
  const end = full.format(asDate(to));
  return `${start} – ${end}`;
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
