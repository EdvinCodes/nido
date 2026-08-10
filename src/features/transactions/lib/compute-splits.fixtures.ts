/**
 * Shared fixture matrix for `computeSplits`, mirroring the acceptance criteria in
 * docs/phases/PHASE-02-ledger-core.md § Tests: every split mode against 1, 2, 3, and 5
 * participants, at amounts of 1 cent, 10,00 €, 33,33 €, and 999 999,99 €. Intended to also
 * back a future pgTAP parity test against `nido._insert_splits`, the same way
 * `src/lib/money/allocate.fixtures.ts` backs `nido.allocate`.
 */
import type { ComputedSplit, SplitMode, SplitParticipantInput } from './compute-splits';

export const AMOUNTS_MINOR: readonly bigint[] = [1n, 1000n, 3333n, 99_999_999n];

export const PARTICIPANT_COUNTS: readonly number[] = [1, 2, 3, 5];

/** Human-readable share weights per participant count, chosen to have distinct magnitudes. */
const SHARE_WEIGHTS: Record<number, readonly number[]> = {
  1: [1],
  2: [2, 1],
  3: [3, 2, 1],
  5: [5, 4, 3, 2, 1],
};

/** Percent weights per participant count. Each row totals exactly 100. */
const PERCENT_WEIGHTS: Record<number, readonly number[]> = {
  1: [100],
  2: [60, 40],
  3: [50, 30, 20],
  5: [40, 25, 15, 10, 10],
};

function participantId(index: number): string {
  // Zero-padded so lexicographic (string) order matches numeric order, exercising the
  // position/participantId sort the same way ascending UUIDs would.
  return `participant-${String(index).padStart(2, '0')}`;
}

function makeParticipants(count: number): SplitParticipantInput[] {
  return Array.from({ length: count }, (_, index) => ({
    participantId: participantId(index),
    position: index,
  }));
}

/** Distributes `amountMinor` evenly with the largest-remainder rule, used for exact fixtures. */
function equalShares(amountMinor: bigint, count: number): bigint[] {
  const base = amountMinor / BigInt(count);
  const remainder = amountMinor - base * BigInt(count);
  return Array.from({ length: count }, (_, index) => base + (BigInt(index) < remainder ? 1n : 0n));
}

export type SplitFixtureCase = {
  description: string;
  mode: SplitMode;
  amountMinor: bigint;
  participants: readonly SplitParticipantInput[];
  /** When false, `computeSplits` is expected to throw rather than return a result. */
  expectValid: boolean;
  /** Expected result, only present for valid cases. */
  expected?: readonly ComputedSplit[];
};

function buildCase(mode: SplitMode, amountMinor: bigint, count: number): SplitFixtureCase {
  const base = makeParticipants(count);
  const description = `${mode} split of ${amountMinor.toString()} across ${String(count)} participant(s)`;

  if (mode === 'personal') {
    if (count !== 1) {
      return { description, mode, amountMinor, participants: base, expectValid: false };
    }
    return {
      description,
      mode,
      amountMinor,
      participants: base,
      expectValid: true,
      expected: [{ participantId: participantId(0), weight: 1, owedMinor: amountMinor }],
    };
  }

  if (mode === 'equal') {
    const shares = equalShares(amountMinor, count);
    return {
      description,
      mode,
      amountMinor,
      participants: base,
      expectValid: true,
      expected: base.map((p, index) => ({
        participantId: p.participantId,
        weight: 1,
        owedMinor: shares[index] ?? 0n,
      })),
    };
  }

  if (mode === 'shares') {
    const weights = SHARE_WEIGHTS[count] ?? SHARE_WEIGHTS[1] ?? [1];
    const participants = base.map((p, index) => ({ ...p, weight: weights[index] ?? 1 }));
    return { description, mode, amountMinor, participants, expectValid: true };
  }

  if (mode === 'percent') {
    const weights = PERCENT_WEIGHTS[count] ?? PERCENT_WEIGHTS[1] ?? [100];
    const participants = base.map((p, index) => ({ ...p, weight: weights[index] ?? 0 }));
    return { description, mode, amountMinor, participants, expectValid: true };
  }

  // exact
  const shares = equalShares(amountMinor, count);
  const participants = base.map((p, index) => ({ ...p, owedMinor: shares[index] ?? 0n }));
  return {
    description,
    mode,
    amountMinor,
    participants,
    expectValid: true,
    expected: base.map((p, index) => ({
      participantId: p.participantId,
      weight: 0,
      owedMinor: shares[index] ?? 0n,
    })),
  };
}

const MODES: readonly SplitMode[] = ['personal', 'equal', 'shares', 'percent', 'exact'];

export const SPLIT_FIXTURES: readonly SplitFixtureCase[] = MODES.flatMap((mode) =>
  AMOUNTS_MINOR.flatMap((amountMinor) =>
    PARTICIPANT_COUNTS.map((count) => buildCase(mode, amountMinor, count)),
  ),
);
