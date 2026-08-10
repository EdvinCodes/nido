/**
 * TypeScript mirror of `nido._insert_splits` (see
 * `supabase/migrations/20260810140300_transaction_rpcs.sql`). Used for the live preview in
 * the split editor so the amount the user sees before saving is exactly what the server will
 * persist. A shared fixture set (`compute-splits.fixtures.ts`) proves the two implementations
 * agree.
 *
 * See docs/02-DATA-MODEL.md §§ 1, 4, 5 and docs/04-FEATURES.md § 2.
 */

import { allocateByNumbers, toWeight, WEIGHT_SCALE } from '@/lib/money/allocate';

export type SplitMode = 'personal' | 'equal' | 'shares' | 'percent' | 'exact';

export type SplitParticipantInput = {
  participantId: string;
  /** Shares/percent weight, as a human-readable number (e.g. 2, 33.33). Ignored by `equal`. */
  weight?: number;
  /** Exact-mode owed amount in minor units. Required and only used when `mode === 'exact'`. */
  owedMinor?: bigint;
  /** Stable order used to break allocation ties, mirroring `participants.position` in SQL. */
  position?: number;
};

export type ComputedSplit = {
  participantId: string;
  weight: number;
  owedMinor: bigint;
};

const PERCENT_TOTAL_SCALED = 100n * WEIGHT_SCALE;
const DEFAULT_POSITION = 32_767;

export class SplitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SplitError';
  }
}

/** Same ordering key the SQL side uses: `coalesce(position, 32767)`, then `participant_id`. */
function sortKey(participant: SplitParticipantInput): [number, string] {
  return [participant.position ?? DEFAULT_POSITION, participant.participantId];
}

function sortByPosition<T extends SplitParticipantInput>(participants: readonly T[]): T[] {
  return [...participants].sort((a, b) => {
    const [posA, idA] = sortKey(a);
    const [posB, idB] = sortKey(b);
    if (posA !== posB) return posA - posB;
    return idA < idB ? -1 : idA > idB ? 1 : 0;
  });
}

function computeExactSplits(
  amountMinor: bigint,
  participants: readonly SplitParticipantInput[],
): ComputedSplit[] {
  let sum = 0n;
  const splits: ComputedSplit[] = [];

  for (const participant of participants) {
    if (participant.owedMinor === undefined) {
      throw new SplitError(
        `exact splits require owedMinor for participant ${participant.participantId}`,
      );
    }
    if (participant.owedMinor < 0n) {
      throw new SplitError('owedMinor must be >= 0');
    }
    sum += participant.owedMinor;
    splits.push({
      participantId: participant.participantId,
      weight: participant.weight ?? 0,
      owedMinor: participant.owedMinor,
    });
  }

  if (sum !== amountMinor) {
    throw new SplitError(
      `exact splits must sum to amountMinor (sum=${sum.toString()} amount=${amountMinor.toString()})`,
    );
  }

  return splits;
}

function weightForMode(
  mode: 'equal' | 'shares' | 'percent',
  participant: SplitParticipantInput,
): number {
  if (mode === 'equal') return 1;
  const weight = participant.weight ?? 0;
  if (weight < 0) {
    throw new SplitError(`weight must be >= 0, got ${weight}`);
  }
  return weight;
}

export function computeSplits(
  amountMinor: bigint,
  mode: SplitMode,
  participants: readonly SplitParticipantInput[],
): ComputedSplit[] {
  if (participants.length < 1) {
    throw new SplitError('at least one participant is required');
  }

  if (mode === 'personal') {
    if (participants.length !== 1) {
      throw new SplitError('personal split requires exactly one participant');
    }
    const [only] = participants;
    if (!only) {
      throw new SplitError('personal split requires exactly one participant');
    }
    return [{ participantId: only.participantId, weight: 1, owedMinor: amountMinor }];
  }

  if (mode === 'exact') {
    return computeExactSplits(amountMinor, participants);
  }

  const weighted = participants.map((participant) => ({
    participant,
    weight: weightForMode(mode, participant),
  }));

  if (mode === 'percent') {
    const scaledTotal = weighted.reduce((acc, { weight }) => acc + toWeight(weight), 0n);
    if (scaledTotal !== PERCENT_TOTAL_SCALED) {
      throw new SplitError(
        `percent weights must total 100 (got ${String(scaledTotal / WEIGHT_SCALE)})`,
      );
    }
  }

  // Sort by position then participant id so allocate's tie-break matches the SQL side, which
  // reorders before calling nido.allocate.
  const sorted = sortByPosition(
    weighted.map(({ participant, weight }) => ({ ...participant, weight })),
  );

  const owed = allocateByNumbers(
    amountMinor,
    sorted.map((p) => p.weight),
  );

  return sorted.map((participant, index) => ({
    participantId: participant.participantId,
    weight: participant.weight,
    owedMinor: owed[index] ?? 0n,
  }));
}
