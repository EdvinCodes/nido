import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  addDays,
  addMonths,
  currentPeriod,
  DateRangeError,
  dayOfWeek,
  daysInRange,
  differenceInDays,
  enumeratePeriods,
  isWithin,
  nextPeriod,
  periodBounds,
  previousPeriod,
  previousRange,
  todayIn,
  toIsoDate,
} from './periods';

describe('calendar arithmetic', () => {
  it('adds days across month and year boundaries', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2024-03-01', -1)).toBe('2024-02-29');
  });

  it('adds months, clamping to the last day of the target month', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2024-01-31', 1)).toBe('2024-02-29');
    expect(addMonths('2026-01-15', 13)).toBe('2027-02-15');
    expect(addMonths('2026-01-15', -1)).toBe('2025-12-15');
  });

  it('counts days between dates', () => {
    expect(differenceInDays('2026-01-01', '2026-01-31')).toBe(30);
    expect(differenceInDays('2026-01-31', '2026-01-01')).toBe(-30);
    expect(differenceInDays('2026-01-01', '2026-01-01')).toBe(0);
  });

  it('reports the day of week', () => {
    expect(dayOfWeek('2026-08-10')).toBe(1); // a Monday
    expect(dayOfWeek('2026-08-09')).toBe(0); // a Sunday
  });

  it('rejects malformed dates', () => {
    expect(() => addDays('10/08/2026', 1)).toThrow(DateRangeError);
    expect(() => addDays('2026-13-01', 1)).toThrow(DateRangeError);
  });
});

describe('periodBounds — day and week', () => {
  it('bounds a single day', () => {
    expect(periodBounds('day', '2026-08-10')).toEqual({ from: '2026-08-10', to: '2026-08-10' });
  });

  it('bounds a Monday-start week', () => {
    expect(periodBounds('week', '2026-08-13', { weekStartsOn: 1 })).toEqual({
      from: '2026-08-10',
      to: '2026-08-16',
    });
    // The Monday itself belongs to its own week, not the previous one.
    expect(periodBounds('week', '2026-08-10', { weekStartsOn: 1 }).from).toBe('2026-08-10');
    // The Sunday closes it.
    expect(periodBounds('week', '2026-08-16', { weekStartsOn: 1 }).from).toBe('2026-08-10');
  });

  it('bounds a Sunday-start week', () => {
    expect(periodBounds('week', '2026-08-13', { weekStartsOn: 0 })).toEqual({
      from: '2026-08-09',
      to: '2026-08-15',
    });
  });

  it('rejects an invalid week start', () => {
    expect(() => periodBounds('week', '2026-08-10', { weekStartsOn: 7 })).toThrow(DateRangeError);
  });
});

describe('periodBounds — calendar month', () => {
  it('bounds a standard month', () => {
    expect(periodBounds('month', '2026-08-10')).toEqual({ from: '2026-08-01', to: '2026-08-31' });
    expect(periodBounds('month', '2026-02-10')).toEqual({ from: '2026-02-01', to: '2026-02-28' });
    expect(periodBounds('month', '2024-02-10')).toEqual({ from: '2024-02-01', to: '2024-02-29' });
  });
});

describe('periodBounds — household month starting on the 25th', () => {
  const options = { monthStartsOn: 25 };

  it('places a date after the 25th in the month that just started', () => {
    expect(periodBounds('month', '2026-08-28', options)).toEqual({
      from: '2026-08-25',
      to: '2026-09-24',
    });
  });

  it('places a date before the 25th in the month that started last month', () => {
    expect(periodBounds('month', '2026-08-10', options)).toEqual({
      from: '2026-07-25',
      to: '2026-08-24',
    });
  });

  it('handles the boundary day itself', () => {
    expect(periodBounds('month', '2026-08-25', options).from).toBe('2026-08-25');
    expect(periodBounds('month', '2026-08-24', options).to).toBe('2026-08-24');
  });

  it('crosses the year boundary', () => {
    expect(periodBounds('month', '2027-01-10', options)).toEqual({
      from: '2026-12-25',
      to: '2027-01-24',
    });
  });

  it('handles February correctly', () => {
    expect(periodBounds('month', '2026-03-01', options)).toEqual({
      from: '2026-02-25',
      to: '2026-03-24',
    });
  });

  it('rejects a month start beyond 28', () => {
    expect(() => periodBounds('month', '2026-08-10', { monthStartsOn: 29 })).toThrow(
      DateRangeError,
    );
  });
});

describe('periodBounds — quarter and year', () => {
  it('bounds calendar quarters', () => {
    expect(periodBounds('quarter', '2026-08-10')).toEqual({ from: '2026-07-01', to: '2026-09-30' });
    expect(periodBounds('quarter', '2026-01-01')).toEqual({ from: '2026-01-01', to: '2026-03-31' });
  });

  it('bounds a quarter with a custom month start', () => {
    expect(periodBounds('quarter', '2026-08-10', { monthStartsOn: 25 })).toEqual({
      from: '2026-07-25',
      to: '2026-10-24',
    });
  });

  it('bounds the year', () => {
    expect(periodBounds('year', '2026-08-10')).toEqual({ from: '2026-01-01', to: '2026-12-31' });
  });

  it('bounds a year with a custom month start', () => {
    expect(periodBounds('year', '2026-08-10', { monthStartsOn: 25 })).toEqual({
      from: '2026-01-25',
      to: '2027-01-24',
    });
    // January the 3rd belongs to the year that began the previous 25 January.
    expect(periodBounds('year', '2026-01-03', { monthStartsOn: 25 })).toEqual({
      from: '2025-01-25',
      to: '2026-01-24',
    });
  });
});

describe('previous and next periods', () => {
  it('steps back a calendar month', () => {
    const august = periodBounds('month', '2026-08-10');
    expect(previousPeriod('month', august)).toEqual({ from: '2026-07-01', to: '2026-07-31' });
  });

  it('steps back a household month', () => {
    const options = { monthStartsOn: 25 };
    const current = periodBounds('month', '2026-08-10', options);
    expect(previousPeriod('month', current, options)).toEqual({
      from: '2026-06-25',
      to: '2026-07-24',
    });
  });

  it('steps back a week and a day', () => {
    const week = periodBounds('week', '2026-08-13', { weekStartsOn: 1 });
    expect(previousPeriod('week', week)).toEqual({ from: '2026-08-03', to: '2026-08-09' });
    expect(previousPeriod('day', { from: '2026-08-10', to: '2026-08-10' })).toEqual({
      from: '2026-08-09',
      to: '2026-08-09',
    });
  });

  it('round-trips previous and next', () => {
    const options = { monthStartsOn: 25 };
    const current = periodBounds('month', '2026-08-10', options);
    expect(nextPeriod('month', previousPeriod('month', current, options), options)).toEqual(
      current,
    );
  });

  it('shifts an arbitrary range by its own length', () => {
    expect(previousRange({ from: '2026-08-01', to: '2026-08-10' })).toEqual({
      from: '2026-07-22',
      to: '2026-07-31',
    });
  });
});

describe('enumeratePeriods', () => {
  it('produces one bucket per month with no gaps or overlaps', () => {
    const buckets = enumeratePeriods('month', { from: '2026-01-01', to: '2026-03-31' });
    expect(buckets).toHaveLength(3);
    expect(buckets[0]).toEqual({ from: '2026-01-01', to: '2026-01-31' });
    expect(buckets[2]).toEqual({ from: '2026-03-01', to: '2026-03-31' });
    for (let i = 1; i < buckets.length; i++) {
      expect(addDays(buckets[i - 1]!.to, 1)).toBe(buckets[i]!.from);
    }
  });

  it('covers a partial trailing period', () => {
    const buckets = enumeratePeriods('month', { from: '2026-01-15', to: '2026-03-10' });
    expect(buckets).toHaveLength(3);
    expect(buckets[0]!.from).toBe('2026-01-01');
  });
});

describe('timezone handling', () => {
  it('resolves the calendar day in the space timezone, not the server one', () => {
    // 23:30 UTC on 9 August is already 10 August in Madrid (UTC+2 in summer).
    const instant = new Date('2026-08-09T23:30:00Z');
    expect(toIsoDate(instant, 'Europe/Madrid')).toBe('2026-08-10');
    expect(toIsoDate(instant, 'UTC')).toBe('2026-08-09');
    expect(toIsoDate(instant, 'America/New_York')).toBe('2026-08-09');
  });

  it('is unaffected by the spring daylight saving transition', () => {
    // Spain moves the clock forward on 29 March 2026 at 02:00.
    const options = { timeZone: 'Europe/Madrid' as const };
    const march = periodBounds('month', '2026-03-15', options);
    expect(march).toEqual({ from: '2026-03-01', to: '2026-03-31' });
    expect(daysInRange(march)).toBe(31);

    const dstWeek = periodBounds('week', '2026-03-29', { ...options, weekStartsOn: 1 });
    expect(daysInRange(dstWeek)).toBe(7);
  });

  it('is unaffected by the autumn daylight saving transition', () => {
    const october = periodBounds('month', '2026-10-25', { timeZone: 'Europe/Madrid' });
    expect(daysInRange(october)).toBe(31);
  });

  it('accepts an injected clock', () => {
    const now = new Date('2026-08-10T09:00:00Z');
    expect(todayIn('Europe/Madrid', now)).toBe('2026-08-10');
    expect(currentPeriod('month', { timeZone: 'Europe/Madrid' }, now)).toEqual({
      from: '2026-08-01',
      to: '2026-08-31',
    });
  });
});

describe('period invariants', () => {
  const isoDateArb = fc
    .date({
      min: new Date('2000-01-01T00:00:00Z'),
      max: new Date('2050-12-31T00:00:00Z'),
      noInvalidDate: true,
    })
    .map((date) => date.toISOString().slice(0, 10));

  it('always contains its own reference date', () => {
    fc.assert(
      fc.property(
        isoDateArb,
        fc.constantFrom('day' as const, 'week' as const, 'month' as const, 'quarter' as const, 'year' as const),
        fc.integer({ min: 1, max: 28 }),
        fc.integer({ min: 0, max: 6 }),
        (reference, period, monthStartsOn, weekStartsOn) => {
          const bounds = periodBounds(period, reference, { monthStartsOn, weekStartsOn });
          return isWithin(reference, bounds);
        },
      ),
      { numRuns: 3000 },
    );
  });

  it('never overlaps or leaves a gap against the previous period', () => {
    fc.assert(
      fc.property(
        isoDateArb,
        fc.constantFrom('day' as const, 'week' as const, 'month' as const, 'quarter' as const, 'year' as const),
        fc.integer({ min: 1, max: 28 }),
        (reference, period, monthStartsOn) => {
          const current = periodBounds(period, reference, { monthStartsOn });
          const previous = previousPeriod(period, current, { monthStartsOn });
          return addDays(previous.to, 1) === current.from;
        },
      ),
      { numRuns: 3000 },
    );
  });

  it('always ends on or after it starts', () => {
    fc.assert(
      fc.property(
        isoDateArb,
        fc.constantFrom('day' as const, 'week' as const, 'month' as const, 'quarter' as const, 'year' as const),
        (reference, period) => {
          const bounds = periodBounds(period, reference);
          return bounds.from <= bounds.to;
        },
      ),
      { numRuns: 1000 },
    );
  });
});
