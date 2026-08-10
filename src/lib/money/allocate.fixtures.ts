/**
 * Shared fixture set used to prove `nido.allocate` (SQL, `supabase/tests/020_allocate.sql`)
 * produces byte-for-byte identical results to `allocate` (TypeScript, this module). The
 * weights here are the human-readable numbers a form would collect; SQL receives them
 * unscaled while TypeScript scales them via `toWeight`, but the allocation only ever uses
 * weights as ratios, so both are exact and comparable. See docs/phases/PHASE-00-foundations.md
 * acceptance criteria and docs/02-DATA-MODEL.md §1.
 */
export const ALLOCATE_FIXTURES: readonly {
  total: bigint;
  weights: readonly number[];
  expected: readonly bigint[];
}[] = [
  { total: 1000n, weights: [1, 1, 1], expected: [334n, 333n, 333n] },
  { total: 100n, weights: [1, 1, 1], expected: [34n, 33n, 33n] },
  { total: 5n, weights: [1, 1, 1, 1], expected: [2n, 1n, 1n, 1n] },
  { total: 12345n, weights: [1], expected: [12345n] },
  { total: 1n, weights: [1, 1, 1, 1, 1], expected: [1n, 0n, 0n, 0n, 0n] },
  { total: 0n, weights: [1, 1, 1, 1], expected: [0n, 0n, 0n, 0n] },
  { total: -1000n, weights: [1, 1, 1], expected: [-334n, -333n, -333n] },
  { total: 1000n, weights: [2, 1], expected: [667n, 333n] },
  { total: 10000n, weights: [33.33, 33.33, 33.34], expected: [3333n, 3333n, 3334n] },
  { total: 1000n, weights: [1, 1, 0], expected: [500n, 500n, 0n] },
  {
    total: 9999999n,
    weights: [1, 1, 1, 1, 1, 1, 1],
    expected: [1428572n, 1428572n, 1428571n, 1428571n, 1428571n, 1428571n, 1428571n],
  },
  {
    total: 999999999999999n,
    weights: [1, 1, 1, 1, 1, 1, 1],
    expected: [
      142857142857143n,
      142857142857143n,
      142857142857143n,
      142857142857143n,
      142857142857143n,
      142857142857142n,
      142857142857142n,
    ],
  },
  { total: 1n, weights: [1], expected: [1n] },
  { total: -1n, weights: [1, 1], expected: [-1n, 0n] },
  { total: 250n, weights: [1, 1, 1, 1], expected: [63n, 63n, 62n, 62n] },
  { total: 333n, weights: [1, 1, 1], expected: [111n, 111n, 111n] },
  { total: 7n, weights: [3, 2, 1], expected: [4n, 2n, 1n] },
  { total: 100000n, weights: [70, 30], expected: [70000n, 30000n] },
  { total: 100000n, weights: [50, 30, 20], expected: [50000n, 30000n, 20000n] },
  { total: -12345n, weights: [1, 2, 3, 4], expected: [-1235n, -2469n, -3703n, -4938n] },
  {
    total: 999n,
    weights: [1, 1, 1, 1, 1, 1, 1, 1, 1],
    expected: [111n, 111n, 111n, 111n, 111n, 111n, 111n, 111n, 111n],
  },
  { total: 2n, weights: [1, 1, 1], expected: [1n, 1n, 0n] },
  { total: 100n, weights: [1, 0, 0], expected: [100n, 0n, 0n] },
  {
    total: 1000000n,
    weights: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    expected: [
      100000n,
      100000n,
      100000n,
      100000n,
      100000n,
      100000n,
      100000n,
      100000n,
      100000n,
      100000n,
    ],
  },
];
