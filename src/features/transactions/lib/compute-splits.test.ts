import { describe, expect, it } from 'vitest';
import { computeSplits, SplitError } from './compute-splits';
import { SPLIT_FIXTURES } from './compute-splits.fixtures';

const sumOwed = (splits: readonly { owedMinor: bigint }[]) =>
  splits.reduce((acc, split) => acc + split.owedMinor, 0n);

describe('computeSplits — fixture matrix', () => {
  it.each(SPLIT_FIXTURES.filter((f) => f.expectValid))('$description', (fixture) => {
    const result = computeSplits(fixture.amountMinor, fixture.mode, fixture.participants);
    expect(sumOwed(result)).toBe(fixture.amountMinor);
    expect(result).toHaveLength(fixture.participants.length);
    if (fixture.expected) {
      expect(result).toEqual(fixture.expected);
    }
  });

  it.each(SPLIT_FIXTURES.filter((f) => !f.expectValid))('$description throws', (fixture) => {
    expect(() => computeSplits(fixture.amountMinor, fixture.mode, fixture.participants)).toThrow(
      SplitError,
    );
  });
});

describe('computeSplits — personal', () => {
  it('assigns the full amount to the single participant', () => {
    expect(computeSplits(1234n, 'personal', [{ participantId: 'a' }])).toEqual([
      { participantId: 'a', weight: 1, owedMinor: 1234n },
    ]);
  });

  it('rejects zero or multiple participants', () => {
    expect(() => computeSplits(100n, 'personal', [])).toThrow(SplitError);
    expect(() =>
      computeSplits(100n, 'personal', [{ participantId: 'a' }, { participantId: 'b' }]),
    ).toThrow(SplitError);
  });
});

describe('computeSplits — equal', () => {
  it('ignores any supplied weight and splits evenly with remainder to the first by order', () => {
    const result = computeSplits(1000n, 'equal', [
      { participantId: 'a', weight: 99, position: 0 },
      { participantId: 'b', weight: 1, position: 1 },
      { participantId: 'c', weight: 1, position: 2 },
    ]);
    expect(result).toEqual([
      { participantId: 'a', weight: 1, owedMinor: 334n },
      { participantId: 'b', weight: 1, owedMinor: 333n },
      { participantId: 'c', weight: 1, owedMinor: 333n },
    ]);
  });
});

describe('computeSplits — shares', () => {
  it('allocates proportionally to the given weights', () => {
    const result = computeSplits(1000n, 'shares', [
      { participantId: 'a', weight: 2, position: 0 },
      { participantId: 'b', weight: 1, position: 1 },
    ]);
    expect(result).toEqual([
      { participantId: 'a', weight: 2, owedMinor: 667n },
      { participantId: 'b', weight: 1, owedMinor: 333n },
    ]);
  });

  it('rejects negative weights', () => {
    expect(() =>
      computeSplits(1000n, 'shares', [
        { participantId: 'a', weight: -1 },
        { participantId: 'b', weight: 2 },
      ]),
    ).toThrow(SplitError);
  });
});

describe('computeSplits — percent', () => {
  it('allocates according to percentages that total 100', () => {
    const result = computeSplits(10_000n, 'percent', [
      { participantId: 'a', weight: 33.33, position: 0 },
      { participantId: 'b', weight: 33.33, position: 1 },
      { participantId: 'c', weight: 33.34, position: 2 },
    ]);
    expect(result).toEqual([
      { participantId: 'a', weight: 33.33, owedMinor: 3333n },
      { participantId: 'b', weight: 33.33, owedMinor: 3333n },
      { participantId: 'c', weight: 33.34, owedMinor: 3334n },
    ]);
  });

  it('rejects percentages that do not total exactly 100', () => {
    expect(() =>
      computeSplits(1000n, 'percent', [
        { participantId: 'a', weight: 50 },
        { participantId: 'b', weight: 49 },
      ]),
    ).toThrow(SplitError);
    expect(() =>
      computeSplits(1000n, 'percent', [
        { participantId: 'a', weight: 50 },
        { participantId: 'b', weight: 51 },
      ]),
    ).toThrow(SplitError);
  });
});

describe('computeSplits — exact', () => {
  it('uses the supplied owedMinor values directly, in input order', () => {
    const result = computeSplits(1000n, 'exact', [
      { participantId: 'b', owedMinor: 700n },
      { participantId: 'a', owedMinor: 300n },
    ]);
    expect(result).toEqual([
      { participantId: 'b', weight: 0, owedMinor: 700n },
      { participantId: 'a', weight: 0, owedMinor: 300n },
    ]);
  });

  it('rejects amounts that do not sum to the total', () => {
    expect(() =>
      computeSplits(1000n, 'exact', [
        { participantId: 'a', owedMinor: 700n },
        { participantId: 'b', owedMinor: 200n },
      ]),
    ).toThrow(SplitError);
  });

  it('rejects a missing or negative owedMinor', () => {
    expect(() => computeSplits(1000n, 'exact', [{ participantId: 'a' }])).toThrow(SplitError);
    expect(() => computeSplits(1000n, 'exact', [{ participantId: 'a', owedMinor: -1n }])).toThrow(
      SplitError,
    );
  });
});

describe('computeSplits — ordering', () => {
  it('sorts by position then participantId before allocating, matching the SQL side', () => {
    const result = computeSplits(100n, 'shares', [
      { participantId: 'z', weight: 1, position: 1 },
      { participantId: 'a', weight: 1, position: 1 },
      { participantId: 'm', weight: 1, position: 0 },
    ]);
    // position 0 first (m), then position 1 ordered by participantId (a before z).
    expect(result.map((s) => s.participantId)).toEqual(['m', 'a', 'z']);
    // Remainder cent goes to the first in that resolved order.
    expect(result[0]?.owedMinor).toBe(34n);
  });

  it('falls back to a stable default position when none is supplied', () => {
    const result = computeSplits(100n, 'shares', [
      { participantId: 'b', weight: 1 },
      { participantId: 'a', weight: 1 },
    ]);
    expect(result.map((s) => s.participantId)).toEqual(['a', 'b']);
  });
});

describe('computeSplits — invariants', () => {
  it('always sums exactly to amountMinor for every fixture', () => {
    for (const fixture of SPLIT_FIXTURES.filter((f) => f.expectValid)) {
      const result = computeSplits(fixture.amountMinor, fixture.mode, fixture.participants);
      expect(sumOwed(result)).toBe(fixture.amountMinor);
    }
  });
});
