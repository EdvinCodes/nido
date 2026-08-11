import { describe, expect, it } from 'vitest';
import { computeSavingsRate, formatSavingsRate } from './savings-rate';

describe('computeSavingsRate', () => {
  it('returns null for zero income', () => {
    expect(computeSavingsRate(0, 5000)).toBeNull();
  });

  it('computes positive savings', () => {
    expect(computeSavingsRate(100_000, 60_000)).toBeCloseTo(0.4);
  });

  it('returns negative rate when expenses exceed income', () => {
    expect(computeSavingsRate(50_000, 70_000)).toBeCloseTo(-0.4);
  });
});

describe('formatSavingsRate', () => {
  it('shows dash for null', () => {
    expect(formatSavingsRate(null)).toBe('—');
  });

  it('formats negative rates', () => {
    expect(formatSavingsRate(-0.125)).toBe('-12.5%');
  });
});
