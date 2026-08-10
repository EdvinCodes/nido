import { describe, expect, it } from 'vitest';
import { deltaRatio, resolveDashboardPeriod } from './resolve-period';

describe('resolveDashboardPeriod', () => {
  const now = new Date('2026-08-10T12:00:00+02:00');
  const opts = { timeZone: 'Europe/Madrid', monthStartsOn: 25 };

  it('prefers URL period over profile default', () => {
    const result = resolveDashboardPeriod(
      { period: 'last_month' },
      opts,
      { preset: 'this_year' },
      now,
    );
    expect(result.preset).toBe('last_month');
    expect(result.range).toEqual({ from: '2026-06-25', to: '2026-07-24' });
  });

  it('falls back to profile preset when URL is empty', () => {
    const result = resolveDashboardPeriod({}, opts, { preset: 'this_month' }, now);
    expect(result.range).toEqual({ from: '2026-07-25', to: '2026-08-24' });
  });
});

describe('deltaRatio', () => {
  it('returns relative change', () => {
    expect(deltaRatio(120, 100)).toBeCloseTo(0.2);
  });

  it('returns null when previous is zero and current is not', () => {
    expect(deltaRatio(50, 0)).toBeNull();
  });
});
