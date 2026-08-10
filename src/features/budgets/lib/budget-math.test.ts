import { describe, expect, it } from 'vitest';
import {
  compareBudgetUrgency,
  dailyAllowanceMinor,
  daysLeftInclusive,
  remainingMinor,
  roundSuggestedLimit,
  spentRatio,
  urgencyFromRatio,
} from './budget-math';

describe('budget-math', () => {
  it('computes spent ratio and remaining', () => {
    expect(spentRatio(800, 1000)).toBe(0.8);
    expect(remainingMinor(800, 1000)).toBe(200);
    expect(spentRatio(0, 0)).toBe(0);
  });

  it('counts inclusive days left and daily allowance', () => {
    expect(daysLeftInclusive('2026-05-10', '2026-05-08')).toBe(3);
    expect(dailyAllowanceMinor(300, '2026-05-10', '2026-05-08')).toBe(100);
    expect(dailyAllowanceMinor(-50, '2026-05-10', '2026-05-08')).toBe(0);
  });

  it('orders urgency and rounds suggestions', () => {
    expect(urgencyFromRatio(1.1, 1100)).toBe('over');
    expect(urgencyFromRatio(0.85, 850)).toBe('approaching');
    expect(urgencyFromRatio(0.2, 0)).toBe('idle');
    expect(compareBudgetUrgency('over', 'healthy')).toBeLessThan(0);
    expect(roundSuggestedLimit(12340)).toBe(13000);
    expect(roundSuggestedLimit(1200)).toBe(1500);
  });
});
