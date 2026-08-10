import { describe, expect, it } from 'vitest';
import { resolvePeriodPreset } from './presets';

describe('resolvePeriodPreset', () => {
  const madrid = { timeZone: 'Europe/Madrid', monthStartsOn: 1 as const };
  // Fixed clock: 10 Aug 2026 in Europe/Madrid is still 2026-08-10.
  const now = new Date('2026-08-10T12:00:00+02:00');

  it('resolves this_month on a calendar month', () => {
    expect(resolvePeriodPreset('this_month', madrid, now)).toEqual({
      from: '2026-08-01',
      to: '2026-08-31',
    });
  });

  it('resolves last_month', () => {
    expect(resolvePeriodPreset('last_month', madrid, now)).toEqual({
      from: '2026-07-01',
      to: '2026-07-31',
    });
  });

  it('resolves last_3_months as the current household month plus two prior', () => {
    expect(resolvePeriodPreset('last_3_months', madrid, now)).toEqual({
      from: '2026-06-01',
      to: '2026-08-31',
    });
  });

  it('honours monthStartsOn = 25 across a DST autumn transition', () => {
    // Europe/Madrid leaves DST on the last Sunday of October.
    // On 10 Nov 2026 the household month that began on 25 Oct runs to 24 Nov.
    const autumn = new Date('2026-11-10T12:00:00+01:00');
    const opts = { timeZone: 'Europe/Madrid', monthStartsOn: 25 };
    expect(resolvePeriodPreset('this_month', opts, autumn)).toEqual({
      from: '2026-10-25',
      to: '2026-11-24',
    });
    expect(resolvePeriodPreset('last_month', opts, autumn)).toEqual({
      from: '2026-09-25',
      to: '2026-10-24',
    });
  });

  it('falls back to this_month when custom range is incomplete', () => {
    expect(resolvePeriodPreset('custom', madrid, now, null)).toEqual({
      from: '2026-08-01',
      to: '2026-08-31',
    });
  });
});
