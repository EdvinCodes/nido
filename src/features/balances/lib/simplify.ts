export type BalanceEntry = {
  participantId: string;
  /** Positive = owed money by the space; negative = owes the space. */
  netMinor: bigint;
  /** Stable tie-break key (participants.position). Lower sorts first. */
  position: number;
};

export type SimplifiedTransfer = {
  fromId: string;
  toId: string;
  amountMinor: bigint;
};

type Working = {
  participantId: string;
  netMinor: bigint;
  position: number;
};

function byMagnitudeThenPosition(a: Working, b: Working): number {
  const absA = a.netMinor < 0n ? -a.netMinor : a.netMinor;
  const absB = b.netMinor < 0n ? -b.netMinor : b.netMinor;
  if (absA !== absB) return absA > absB ? -1 : 1;
  if (a.position !== b.position) return a.position - b.position;
  return a.participantId < b.participantId ? -1 : a.participantId > b.participantId ? 1 : 0;
}

/**
 * Greedy maximum matching: repeatedly pair the largest debtor with the largest
 * creditor and emit a transfer for the smaller absolute amount.
 */
export function simplifySettlements(balances: BalanceEntry[]): SimplifiedTransfer[] {
  const working: Working[] = balances
    .filter((b) => b.netMinor !== 0n)
    .map((b) => ({
      participantId: b.participantId,
      netMinor: b.netMinor,
      position: b.position,
    }));

  const transfers: SimplifiedTransfer[] = [];
  let guard = working.length * working.length + 1;

  while (guard > 0) {
    guard -= 1;
    const debtors = working.filter((w) => w.netMinor < 0n).sort(byMagnitudeThenPosition);
    const creditors = working.filter((w) => w.netMinor > 0n).sort(byMagnitudeThenPosition);

    const debtor = debtors[0];
    const creditor = creditors[0];
    if (!debtor || !creditor) break;

    const debt = -debtor.netMinor;
    const credit = creditor.netMinor;
    const amount = debt < credit ? debt : credit;
    if (amount <= 0n) break;

    transfers.push({
      fromId: debtor.participantId,
      toId: creditor.participantId,
      amountMinor: amount,
    });

    debtor.netMinor += amount;
    creditor.netMinor -= amount;
  }

  return transfers;
}

/** Apply transfers to a balance map (mutates a copy) and return resulting nets. */
export function applyTransfers(
  balances: BalanceEntry[],
  transfers: SimplifiedTransfer[],
): Map<string, bigint> {
  const map = new Map(balances.map((b) => [b.participantId, b.netMinor]));
  for (const t of transfers) {
    map.set(t.fromId, (map.get(t.fromId) ?? 0n) + t.amountMinor);
    map.set(t.toId, (map.get(t.toId) ?? 0n) - t.amountMinor);
  }
  return map;
}
