/**
 * Period arithmetic.
 *
 * Every figure in Nido belongs to a period, and a household's "month" is not necessarily
 * the calendar month: someone paid on the 25th wants their month to run from the 25th.
 * All arithmetic happens on civil dates (year/month/day) in the space's timezone, which
 * sidesteps daylight saving entirely — a calendar day has no hours in it.
 *
 * See docs/02-DATA-MODEL.md §3 and docs/04-FEATURES.md §3.
 */

/** A calendar day, `YYYY-MM-DD`. Matches the Postgres `date` type. */
export type IsoDate = string;

export type Period = 'day' | 'week' | 'month' | 'quarter' | 'year';

export interface PeriodOptions {
  /** IANA timezone of the space, e.g. `Europe/Madrid`. */
  timeZone?: string;
  /** 0 = Sunday … 6 = Saturday. Spain starts on Monday. */
  weekStartsOn?: number;
  /** Day of month the household's month begins on, 1–28. */
  monthStartsOn?: number;
}

export interface DateRange {
  /** Inclusive first day of the period. */
  from: IsoDate;
  /** Inclusive last day of the period. */
  to: IsoDate;
}

export class DateRangeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DateRangeError';
  }
}

const DEFAULTS = {
  timeZone: 'Europe/Madrid',
  weekStartsOn: 1,
  monthStartsOn: 1,
} as const;

const isoFormatterCache = new Map<string, Intl.DateTimeFormat>();

function isoFormatter(timeZone: string): Intl.DateTimeFormat {
  const cached = isoFormatterCache.get(timeZone);
  if (cached) return cached;
  // en-CA renders as YYYY-MM-DD, which is exactly the shape we want.
  const created = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  isoFormatterCache.set(timeZone, created);
  return created;
}

/** The current calendar day in a given timezone. */
export function todayIn(timeZone: string = DEFAULTS.timeZone, now: Date = new Date()): IsoDate {
  return isoFormatter(timeZone).format(now);
}

/** Converts an instant into the calendar day it falls on in a given timezone. */
export function toIsoDate(instant: Date, timeZone: string = DEFAULTS.timeZone): IsoDate {
  return isoFormatter(timeZone).format(instant);
}

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function parts(date: IsoDate): { year: number; month: number; day: number } {
  const match = ISO_DATE_PATTERN.exec(date);
  if (!match) throw new DateRangeError(`"${date}" is not an ISO calendar date`);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    throw new DateRangeError(`"${date}" is not a valid calendar date`);
  }
  return { year, month, day };
}

/** Civil dates are represented internally as a UTC midnight timestamp, never displayed. */
function toUtc(date: IsoDate): number {
  const { year, month, day } = parts(date);
  return Date.UTC(year, month - 1, day);
}

function fromUtc(timestamp: number): IsoDate {
  return new Date(timestamp).toISOString().slice(0, 10);
}

const DAY_MS = 86_400_000;

export function addDays(date: IsoDate, days: number): IsoDate {
  return fromUtc(toUtc(date) + days * DAY_MS);
}

/** Adds months, clamping to the last day of the target month (31 Jan + 1 month = 28 Feb). */
export function addMonths(date: IsoDate, months: number): IsoDate {
  const { year, month, day } = parts(date);
  const totalMonths = year * 12 + (month - 1) + months;
  const targetYear = Math.floor(totalMonths / 12);
  const targetMonth = totalMonths - targetYear * 12;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  return fromUtc(Date.UTC(targetYear, targetMonth, Math.min(day, lastDay)));
}

export function differenceInDays(from: IsoDate, to: IsoDate): number {
  return Math.round((toUtc(to) - toUtc(from)) / DAY_MS);
}

/** 0 = Sunday … 6 = Saturday. */
export function dayOfWeek(date: IsoDate): number {
  return new Date(toUtc(date)).getUTCDay();
}

export function compareDates(a: IsoDate, b: IsoDate): -1 | 0 | 1 {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

export function isWithin(date: IsoDate, range: DateRange): boolean {
  return date >= range.from && date <= range.to;
}

export function daysInRange(range: DateRange): number {
  return differenceInDays(range.from, range.to) + 1;
}

/**
 * The start of the household month containing `date`.
 * With `monthStartsOn = 25`, 10 August belongs to the month that began on 25 July.
 */
function householdMonthStart(date: IsoDate, monthStartsOn: number): IsoDate {
  const { year, month, day } = parts(date);
  const start = fromUtc(Date.UTC(year, month - 1, monthStartsOn));
  return day >= monthStartsOn ? start : addMonths(start, -1);
}

/** Inclusive bounds of the period containing `reference`. */
export function periodBounds(
  period: Period,
  reference: IsoDate,
  options: PeriodOptions = {},
): DateRange {
  const weekStartsOn = options.weekStartsOn ?? DEFAULTS.weekStartsOn;
  const monthStartsOn = options.monthStartsOn ?? DEFAULTS.monthStartsOn;

  if (weekStartsOn < 0 || weekStartsOn > 6) {
    throw new DateRangeError(`weekStartsOn must be 0–6, got ${String(weekStartsOn)}`);
  }
  if (monthStartsOn < 1 || monthStartsOn > 28) {
    throw new DateRangeError(`monthStartsOn must be 1–28, got ${String(monthStartsOn)}`);
  }

  switch (period) {
    case 'day':
      return { from: reference, to: reference };

    case 'week': {
      const offset = (dayOfWeek(reference) - weekStartsOn + 7) % 7;
      const from = addDays(reference, -offset);
      return { from, to: addDays(from, 6) };
    }

    case 'month': {
      const from = householdMonthStart(reference, monthStartsOn);
      return { from, to: addDays(addMonths(from, 1), -1) };
    }

    case 'quarter': {
      const monthStart = householdMonthStart(reference, monthStartsOn);
      const { year, month } = parts(monthStart);
      const quarterFirstMonth = Math.floor((month - 1) / 3) * 3;
      const from = fromUtc(Date.UTC(year, quarterFirstMonth, monthStartsOn));
      return { from, to: addDays(addMonths(from, 3), -1) };
    }

    case 'year': {
      const monthStart = householdMonthStart(reference, monthStartsOn);
      const { year } = parts(monthStart);
      const from = fromUtc(Date.UTC(year, 0, monthStartsOn));
      return { from, to: addDays(addMonths(from, 12), -1) };
    }
  }
}

/** The current period in the space's timezone. */
export function currentPeriod(
  period: Period,
  options: PeriodOptions = {},
  now: Date = new Date(),
): DateRange {
  return periodBounds(period, todayIn(options.timeZone ?? DEFAULTS.timeZone, now), options);
}

/** The equivalent period immediately before `range`, used for every delta in the product. */
export function previousPeriod(
  period: Period,
  range: DateRange,
  options: PeriodOptions = {},
): DateRange {
  if (period === 'day' || period === 'week') {
    const length = daysInRange(range);
    return { from: addDays(range.from, -length), to: addDays(range.to, -length) };
  }
  const months = period === 'month' ? 1 : period === 'quarter' ? 3 : 12;
  return periodBounds(period, addMonths(range.from, -months), options);
}

export function nextPeriod(
  period: Period,
  range: DateRange,
  options: PeriodOptions = {},
): DateRange {
  if (period === 'day' || period === 'week') {
    const length = daysInRange(range);
    return { from: addDays(range.from, length), to: addDays(range.to, length) };
  }
  const months = period === 'month' ? 1 : period === 'quarter' ? 3 : 12;
  return periodBounds(period, addMonths(range.from, months), options);
}

/**
 * The comparable window immediately before an arbitrary range, of the same length.
 * Used when the user picks a custom range and still wants a "versus previous" delta.
 */
export function previousRange(range: DateRange): DateRange {
  const length = daysInRange(range);
  return { from: addDays(range.from, -length), to: addDays(range.to, -length) };
}

/** Every period boundary between two dates, for building chart buckets with no gaps. */
export function enumeratePeriods(
  period: Period,
  range: DateRange,
  options: PeriodOptions = {},
): DateRange[] {
  const buckets: DateRange[] = [];
  let cursor = periodBounds(period, range.from, options);
  let guard = 0;

  while (cursor.from <= range.to && guard < 10_000) {
    buckets.push(cursor);
    cursor = nextPeriod(period, cursor, options);
    guard += 1;
  }

  return buckets;
}
