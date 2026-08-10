import { describe, expect, it } from 'vitest';
import { goalProgressRatio, remainingMinor } from './pace';

describe('goal pace helpers', () => {
  it('computes progress ratio clamped at zero', () => {
    expect(goalProgressRatio(2500, 10000)).toBe(0.25);
    expect(goalProgressRatio(-100, 10000)).toBe(0);
    expect(goalProgressRatio(100, 0)).toBe(0);
  });

  it('computes remaining without going negative', () => {
    expect(remainingMinor(10000, 2500)).toBe(7500);
    expect(remainingMinor(10000, 12000)).toBe(0);
  });
});
