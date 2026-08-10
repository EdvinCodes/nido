/**
 * Derives sensible default weights when the user switches split mode in the editor, while
 * preserving participant selection. See docs/04-FEATURES.md § 2:
 * "Switching modes preserves the participant selection and recomputes weights sensibly."
 */

import { allocate, allocateEqually } from '@/lib/money/allocate';
import type { ComputedSplit, SplitMode, SplitParticipantInput } from './compute-splits';

function findPrevious(
  participantId: string,
  previous: readonly ComputedSplit[],
): ComputedSplit | undefined {
  return previous.find((p) => p.participantId === participantId);
}

function toEqualWeights(participants: readonly SplitParticipantInput[]): SplitParticipantInput[] {
  return participants.map((participant) => ({ ...participant, weight: 1 }));
}

function toPersonal(
  participants: readonly SplitParticipantInput[],
  previous: readonly ComputedSplit[],
): SplitParticipantInput[] {
  if (participants.length === 0) return [];

  const selectedIds = new Set(participants.map((p) => p.participantId));
  const previousChoice = previous.find((p) => selectedIds.has(p.participantId));
  const chosenId = previousChoice?.participantId ?? participants[0]?.participantId;
  const chosen = participants.find((p) => p.participantId === chosenId) ?? participants[0];

  if (!chosen) return [];
  return [{ ...chosen, weight: 1 }];
}

function toPercent(participants: readonly SplitParticipantInput[]): SplitParticipantInput[] {
  if (participants.length === 0) return [];
  const evenPoints = allocate(
    100n,
    participants.map(() => 1n),
  );
  return participants.map((participant, index) => ({
    ...participant,
    weight: Number(evenPoints[index] ?? 0n),
  }));
}

function toShares(
  participants: readonly SplitParticipantInput[],
  previous: readonly ComputedSplit[],
): SplitParticipantInput[] {
  return participants.map((participant) => {
    const prior = findPrevious(participant.participantId, previous);
    const weight = prior?.weight ?? participant.weight ?? 1;
    return { ...participant, weight };
  });
}

function toExact(
  participants: readonly SplitParticipantInput[],
  previous: readonly ComputedSplit[],
): SplitParticipantInput[] {
  if (participants.length === 0) return [];

  const allPreserved = participants.every((p) =>
    previous.some((prev) => prev.participantId === p.participantId),
  );

  if (allPreserved) {
    return participants.map((participant) => {
      const prior = findPrevious(participant.participantId, previous);
      return { ...participant, owedMinor: prior?.owedMinor ?? 0n };
    });
  }

  const totalMinor = previous.reduce((acc, p) => acc + p.owedMinor, 0n);
  const shares = allocateEqually(totalMinor, participants.length);
  return participants.map((participant, index) => ({
    ...participant,
    owedMinor: shares[index] ?? 0n,
  }));
}

export function weightsFromMode(
  mode: SplitMode,
  participants: readonly SplitParticipantInput[],
  previous: readonly ComputedSplit[],
): SplitParticipantInput[] {
  switch (mode) {
    case 'equal':
      return toEqualWeights(participants);
    case 'personal':
      return toPersonal(participants, previous);
    case 'percent':
      return toPercent(participants);
    case 'shares':
      return toShares(participants, previous);
    case 'exact':
      return toExact(participants, previous);
  }
}
