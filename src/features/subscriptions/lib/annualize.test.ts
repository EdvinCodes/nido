import { describe, expect, it } from 'vitest';
import { annualMinor, monthlyMinor } from './annualize';

describe('annualize', () => {
  it('annualises mixed cycles', () => {
    // 15.99 / month → 191.88 / year
    expect(monthlyMinor(1599, 'month', 1)).toBe(1599);
    expect(annualMinor(1599, 'month', 1)).toBe(19188);

    // 29.90 every month
    expect(annualMinor(2990, 'month', 1)).toBe(35880);

    // 45.90 / month
    expect(annualMinor(4590, 'month', 1)).toBe(55080);

    // weekly 5.00 → ~260 / year
    expect(annualMinor(500, 'week', 1)).toBe(monthlyMinor(500, 'week', 1) * 12);

    // yearly 120 → 10 / month, 120 / year
    expect(monthlyMinor(12000, 'year', 1)).toBe(1000);
    expect(annualMinor(12000, 'year', 1)).toBe(12000);

    // every 2 months
    expect(monthlyMinor(2000, 'month', 2)).toBe(1000);
    expect(annualMinor(2000, 'month', 2)).toBe(12000);
  });
});
