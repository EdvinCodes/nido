/**
 * Pre-flight validation for the split editor, run on every keystroke before `computeSplits`
 * is called. Returns a translatable error key instead of throwing, so the UI can show an
 * inline explanation and disable save, per docs/04-FEATURES.md § 2 ("Split editor rules").
 */

import { toWeight, WEIGHT_SCALE } from '@/lib/money/allocate';
import type { SplitMode, SplitParticipantInput } from './compute-splits';

export type SplitValidation =
  { ok: true } | { ok: false; remainderMinor: bigint; errorKey: string };

const PERCENT_TOTAL_SCALED = 100n * WEIGHT_SCALE;

function invalid(remainderMinor: bigint, errorKey: string): SplitValidation {
  return { ok: false, remainderMinor, errorKey };
}

export function validateSplit(
  mode: SplitMode,
  inputs: readonly SplitParticipantInput[],
  amountMinor: bigint,
): SplitValidation {
  if (amountMinor <= 0n) {
    return invalid(amountMinor, 'split.amountInvalid');
  }

  if (inputs.length < 1) {
    return invalid(amountMinor, 'split.noParticipants');
  }

  if (mode === 'personal') {
    if (inputs.length !== 1) {
      return invalid(amountMinor, 'split.personalNeedsOne');
    }
    return { ok: true };
  }

  if (mode === 'equal') {
    return { ok: true };
  }

  if (mode === 'exact') {
    let sum = 0n;
    for (const input of inputs) {
      const owed = input.owedMinor ?? -1n;
      if (owed < 0n) {
        // Missing or negative owedMinor: treat the whole amount as unaccounted for.
        return invalid(amountMinor, 'split.exactUnbalanced');
      }
      sum += owed;
    }
    const remainder = amountMinor - sum;
    if (remainder !== 0n) {
      return invalid(remainder, 'split.exactUnbalanced');
    }
    return { ok: true };
  }

  // shares | percent
  let scaledTotal = 0n;
  for (const input of inputs) {
    const weight = input.weight ?? 0;
    if (weight < 0) {
      return invalid(amountMinor, 'split.zeroWeight');
    }
    scaledTotal += toWeight(weight);
  }

  if (mode === 'percent') {
    if (scaledTotal !== PERCENT_TOTAL_SCALED) {
      const remainderMinor =
        (amountMinor * (PERCENT_TOTAL_SCALED - scaledTotal)) / PERCENT_TOTAL_SCALED;
      return invalid(remainderMinor, 'split.percentNot100');
    }
    return { ok: true };
  }

  // shares
  if (scaledTotal === 0n) {
    return invalid(amountMinor, 'split.zeroWeight');
  }
  return { ok: true };
}
