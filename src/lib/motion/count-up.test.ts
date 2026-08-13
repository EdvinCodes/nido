import { describe, expect, it } from 'vitest';
import { easeOutCubicPermille, interpolateMinor } from './count-up';

describe('interpolateMinor', () => {
  it('stays on integer minor units', () => {
    expect(interpolateMinor(0n, 10000n, 0)).toBe(0n);
    expect(interpolateMinor(0n, 10000n, 500)).toBe(5000n);
    expect(interpolateMinor(0n, 10000n, 1000)).toBe(10000n);
  });

  it('clamps progress', () => {
    expect(interpolateMinor(0n, 100n, -20)).toBe(0n);
    expect(interpolateMinor(0n, 100n, 2000)).toBe(100n);
  });
});

describe('easeOutCubicPermille', () => {
  it('starts at 0 and ends at 1000', () => {
    expect(easeOutCubicPermille(0, 700)).toBe(0);
    expect(easeOutCubicPermille(700, 700)).toBe(1000);
    expect(easeOutCubicPermille(800, 700)).toBe(1000);
  });
});
