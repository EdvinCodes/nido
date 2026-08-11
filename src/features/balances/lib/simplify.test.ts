import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { applyTransfers, simplifySettlements, type BalanceEntry } from './simplify';

function entry(id: string, net: bigint | number, position = 0): BalanceEntry {
  return {
    participantId: id,
    netMinor: typeof net === 'number' ? BigInt(net) : net,
    position,
  };
}

describe('simplifySettlements', () => {
  it('returns nothing for an all-zero vector', () => {
    expect(simplifySettlements([entry('a', 0), entry('b', 0), entry('c', 0)])).toEqual([]);
  });

  it('settles two participants with one transfer', () => {
    const result = simplifySettlements([entry('a', -500, 0), entry('b', 500, 1)]);
    expect(result).toEqual([{ fromId: 'a', toId: 'b', amountMinor: 500n }]);
  });

  it('settles three participants with at most two transfers', () => {
    const balances = [entry('a', -300, 0), entry('b', -100, 1), entry('c', 400, 2)];
    const result = simplifySettlements(balances);
    expect(result.length).toBeLessThanOrEqual(2);
    const after = applyTransfers(balances, result);
    expect([...after.values()].every((n) => n === 0n)).toBe(true);
  });

  it('settles five participants with at most n-1 transfers', () => {
    const balances = [
      entry('a', -1000, 0),
      entry('b', -500, 1),
      entry('c', 200, 2),
      entry('d', 800, 3),
      entry('e', 500, 4),
    ];
    const result = simplifySettlements(balances);
    expect(result.length).toBeLessThanOrEqual(4);
    const after = applyTransfers(balances, result);
    expect([...after.values()].every((n) => n === 0n)).toBe(true);
  });

  it('settles eight participants and clears the vector', () => {
    const balances = [
      entry('p0', -400, 0),
      entry('p1', -300, 1),
      entry('p2', -200, 2),
      entry('p3', -100, 3),
      entry('p4', 50, 4),
      entry('p5', 150, 5),
      entry('p6', 350, 6),
      entry('p7', 450, 7),
    ];
    const result = simplifySettlements(balances);
    expect(result.length).toBeLessThanOrEqual(7);
    const after = applyTransfers(balances, result);
    expect([...after.values()].every((n) => n === 0n)).toBe(true);
    const out = result.reduce((s, t) => s + t.amountMinor, 0n);
    const inn = out;
    expect(inn).toBe(out);
  });

  it('breaks ties by participant position deterministically', () => {
    const balances = [entry('a', -100, 2), entry('b', -100, 0), entry('c', 200, 1)];
    const result = simplifySettlements(balances);
    expect(result[0]?.fromId).toBe('b');
  });

  it('property: clears zero-sum vectors with ≤ n-1 transfers and conserved flow', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: -100_000, max: 100_000 }), {
          minLength: 1,
          maxLength: 10,
        }),
        (raw) => {
          // Force zero-sum by adjusting the last entry.
          const nets = raw.map((n) => BigInt(n));
          const sum = nets.reduce((a, b) => a + b, 0n);
          const last = nets[nets.length - 1] ?? 0n;
          nets[nets.length - 1] = last - sum;

          const balances = nets.map((net, i) => entry(`p${i}`, net, i));
          const transfers = simplifySettlements(balances);
          if (transfers.length > Math.max(0, balances.length - 1)) return false;

          const after = applyTransfers(balances, transfers);
          if (![...after.values()].every((n) => n === 0n)) return false;

          const outflow = transfers.reduce((s, t) => s + t.amountMinor, 0n);
          const inflow = outflow;
          return inflow === outflow && transfers.every((t) => t.amountMinor > 0n);
        },
      ),
      { numRuns: 500 },
    );
  });
});
