/**
 * Largest remainder allocation.
 *
 * Splitting 10,00 € three ways must produce 3,34 / 3,33 / 3,33 and never lose or invent a
 * cent. This is the single most important invariant in the product, mirrored in SQL as
 * `nido.allocate` and enforced by a deferred constraint trigger on transaction_splits.
 *
 * See docs/02-DATA-MODEL.md §1 and docs/07-ADR.md ADR-005.
 */

/** Weights are stored as numeric(12,4) in Postgres, so four decimal places of precision. */
export const WEIGHT_SCALE = 10_000n;

export class AllocationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AllocationError';
  }
}

/** Converts a human weight (1, 2.5, 33.33) into the fixed-point representation. */
export function toWeight(value: number): bigint {
  if (!Number.isFinite(value)) throw new AllocationError(`Weight must be finite, got ${value}`);
  if (value < 0) throw new AllocationError(`Weight must not be negative, got ${value}`);
  return BigInt(Math.round(value * Number(WEIGHT_SCALE)));
}

export function toWeights(values: readonly number[]): bigint[] {
  return values.map(toWeight);
}

/**
 * Distributes `total` across `weights` so that the result always sums to exactly `total`.
 *
 * 1. Give everyone the floor of their exact share.
 * 2. Hand the leftover minor units out one at a time, to the largest fractional remainders.
 * 3. Break ties by `order` (the participant's stable position), so the result is
 *    deterministic across runs and matches what the database produces.
 *
 * Works for negative totals: the sign is applied after allocation so that the magnitudes
 * are distributed identically regardless of direction.
 */
export function allocate(
  total: bigint,
  weights: readonly bigint[],
  order?: readonly number[],
): bigint[] {
  if (weights.length === 0) {
    throw new AllocationError('Cannot allocate across zero participants');
  }
  if (order && order.length !== weights.length) {
    throw new AllocationError('Order must have the same length as weights');
  }

  let totalWeight = 0n;
  for (const weight of weights) {
    if (weight < 0n) throw new AllocationError('Weights must not be negative');
    totalWeight += weight;
  }
  if (totalWeight === 0n) {
    throw new AllocationError('Total weight must be greater than zero');
  }

  const negative = total < 0n;
  const magnitude = negative ? -total : total;

  const shares: bigint[] = new Array<bigint>(weights.length).fill(0n);
  const remainders: bigint[] = new Array<bigint>(weights.length).fill(0n);
  let distributed = 0n;

  for (let i = 0; i < weights.length; i++) {
    const weight = weights[i] ?? 0n;
    const numerator = magnitude * weight;
    const share = numerator / totalWeight;
    shares[i] = share;
    remainders[i] = numerator % totalWeight;
    distributed += share;
  }

  let leftover = magnitude - distributed;

  if (leftover > 0n) {
    const ranking = shares
      .map((_, index) => index)
      .sort((a, b) => {
        const remainderA = remainders[a] ?? 0n;
        const remainderB = remainders[b] ?? 0n;
        if (remainderA !== remainderB) return remainderB > remainderA ? 1 : -1;
        const orderA = order?.[a] ?? a;
        const orderB = order?.[b] ?? b;
        if (orderA !== orderB) return orderA - orderB;
        return a - b;
      });

    for (const index of ranking) {
      if (leftover === 0n) break;
      shares[index] = (shares[index] ?? 0n) + 1n;
      leftover -= 1n;
    }
  }

  return negative ? shares.map((share) => -share) : shares;
}

/** Convenience wrapper for the common case of human-readable weights. */
export function allocateByNumbers(
  total: bigint,
  weights: readonly number[],
  order?: readonly number[],
): bigint[] {
  return allocate(total, toWeights(weights), order);
}

/** Splits a total evenly across `count` participants. */
export function allocateEqually(total: bigint, count: number): bigint[] {
  if (!Number.isInteger(count) || count < 1) {
    throw new AllocationError(`Participant count must be a positive integer, got ${count}`);
  }
  return allocate(total, new Array<bigint>(count).fill(WEIGHT_SCALE));
}
