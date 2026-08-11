import type { ParticipantBalance, SimplifiedPlanRow } from '../types';

export type BalanceHeadline =
  { kind: 'square' } | { kind: 'owes'; fromName: string; toName: string; amountMinor: number };

/** Pick the largest simplified transfer as the “simplest truth” sentence. */
export function balanceHeadline(
  balances: ParticipantBalance[],
  simplified: SimplifiedPlanRow[],
): BalanceHeadline {
  if (simplified.length === 0 || balances.every((b) => b.netMinor === 0)) {
    return { kind: 'square' };
  }
  const names = new Map(balances.map((b) => [b.participantId, b.displayName]));
  const top = [...simplified].sort((a, b) => b.amountMinor - a.amountMinor)[0];
  if (!top) return { kind: 'square' };
  return {
    kind: 'owes',
    fromName: names.get(top.fromId) ?? '—',
    toName: names.get(top.toId) ?? '—',
    amountMinor: top.amountMinor,
  };
}
