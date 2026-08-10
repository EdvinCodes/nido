import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  allocate,
  allocateByNumbers,
  allocateEqually,
  AllocationError,
  toWeight,
  WEIGHT_SCALE,
} from './allocate';

const sumOf = (values: readonly bigint[]) => values.reduce((acc, value) => acc + value, 0n);

describe('allocate', () => {
  it('splits 10,00 three ways without losing a cent', () => {
    const result = allocateEqually(1000n, 3);
    expect(result).toEqual([334n, 333n, 333n]);
    expect(sumOf(result)).toBe(1000n);
  });

  it('gives the leftover cents to the largest remainders', () => {
    // 100 across weights 1/1/1: remainder 1 goes to the first by stable order.
    expect(allocateEqually(100n, 3)).toEqual([34n, 33n, 33n]);
    // 0,05 across four people: the first four... only three cents to spare.
    expect(allocateEqually(5n, 4)).toEqual([2n, 1n, 1n, 1n]);
  });

  it('handles a single participant', () => {
    expect(allocateEqually(12345n, 1)).toEqual([12345n]);
  });

  it('handles one cent split five ways', () => {
    const result = allocateEqually(1n, 5);
    expect(result).toEqual([1n, 0n, 0n, 0n, 0n]);
    expect(sumOf(result)).toBe(1n);
  });

  it('handles zero', () => {
    expect(allocateEqually(0n, 4)).toEqual([0n, 0n, 0n, 0n]);
  });

  it('distributes negative totals with the same magnitudes', () => {
    const positive = allocateEqually(1000n, 3);
    const negative = allocateEqually(-1000n, 3);
    expect(negative).toEqual(positive.map((value) => -value));
    expect(sumOf(negative)).toBe(-1000n);
  });

  it('respects unequal weights', () => {
    // 2:1 on 10,00 gives 6,67 / 3,33.
    const result = allocateByNumbers(1000n, [2, 1]);
    expect(result).toEqual([667n, 333n]);
    expect(sumOf(result)).toBe(1000n);
  });

  it('supports fractional percentage weights', () => {
    const result = allocateByNumbers(10_000n, [33.33, 33.33, 33.34]);
    expect(sumOf(result)).toBe(10_000n);
    expect(result).toEqual([3333n, 3333n, 3334n]);
  });

  it('never gives a cent to a participant weighted zero', () => {
    const result = allocateByNumbers(1000n, [1, 1, 0]);
    expect(result[2]).toBe(0n);
    expect(sumOf(result)).toBe(1000n);
  });

  it('breaks ties by the supplied participant order', () => {
    const withoutOrder = allocate(100n, [WEIGHT_SCALE, WEIGHT_SCALE, WEIGHT_SCALE]);
    const withOrder = allocate(100n, [WEIGHT_SCALE, WEIGHT_SCALE, WEIGHT_SCALE], [2, 0, 1]);
    expect(withoutOrder).toEqual([34n, 33n, 33n]);
    expect(withOrder).toEqual([33n, 34n, 33n]);
  });

  it('is deterministic across repeated calls', () => {
    const first = allocateByNumbers(9_999_999n, [1, 1, 1, 1, 1, 1, 1]);
    const second = allocateByNumbers(9_999_999n, [1, 1, 1, 1, 1, 1, 1]);
    expect(first).toEqual(second);
  });

  it('rejects empty, negative and all-zero weights', () => {
    expect(() => allocate(100n, [])).toThrow(AllocationError);
    expect(() => allocate(100n, [-1n, 1n])).toThrow(AllocationError);
    expect(() => allocate(100n, [0n, 0n])).toThrow(AllocationError);
    expect(() => allocateEqually(100n, 0)).toThrow(AllocationError);
  });

  it('rejects a mismatched order array', () => {
    expect(() => allocate(100n, [1n, 1n], [0])).toThrow(AllocationError);
  });

  it('handles very large amounts without precision loss', () => {
    const huge = 999_999_999_999_999n;
    const result = allocateEqually(huge, 7);
    expect(sumOf(result)).toBe(huge);
  });
});

describe('allocate — invariants', () => {
  it('always sums exactly to the total', () => {
    fc.assert(
      fc.property(
        fc.bigInt({ min: -1_000_000_000n, max: 1_000_000_000n }),
        fc.array(fc.integer({ min: 0, max: 1000 }), { minLength: 1, maxLength: 10 }),
        (total, rawWeights) => {
          const weights = rawWeights.map(toWeight);
          if (weights.every((weight) => weight === 0n)) return true;
          return sumOf(allocate(total, weights)) === total;
        },
      ),
      { numRuns: 2000 },
    );
  });

  it('never assigns a share with the opposite sign to the total', () => {
    fc.assert(
      fc.property(
        fc.bigInt({ min: 1n, max: 1_000_000_000n }),
        fc.array(fc.integer({ min: 0, max: 100 }), { minLength: 1, maxLength: 8 }),
        (total, rawWeights) => {
          const weights = rawWeights.map(toWeight);
          if (weights.every((weight) => weight === 0n)) return true;
          return allocate(total, weights).every((share) => share >= 0n);
        },
      ),
      { numRuns: 1000 },
    );
  });

  it('keeps every share within one minor unit of its exact fraction', () => {
    fc.assert(
      fc.property(
        fc.bigInt({ min: 0n, max: 100_000_000n }),
        fc.array(fc.integer({ min: 1, max: 50 }), { minLength: 1, maxLength: 8 }),
        (total, rawWeights) => {
          const weights = rawWeights.map(toWeight);
          const totalWeight = weights.reduce((acc, weight) => acc + weight, 0n);
          const shares = allocate(total, weights);
          return shares.every((share, index) => {
            const exact = (total * (weights[index] ?? 0n)) / totalWeight;
            const diff = share - exact;
            return diff >= 0n && diff <= 1n;
          });
        },
      ),
      { numRuns: 1000 },
    );
  });
});
