import { describe, expect, it } from 'vitest';
import { weightsFromMode } from './weights-from-mode';
import type { ComputedSplit } from './compute-splits';

describe('weightsFromMode — equal', () => {
  it('sets every weight to 1, preserving selection and position', () => {
    const result = weightsFromMode(
      'equal',
      [
        { participantId: 'a', position: 0 },
        { participantId: 'b', position: 1, weight: 5 },
      ],
      [],
    );
    expect(result).toEqual([
      { participantId: 'a', position: 0, weight: 1 },
      { participantId: 'b', position: 1, weight: 1 },
    ]);
  });
});

describe('weightsFromMode — personal', () => {
  it('keeps the previously chosen participant when still selected', () => {
    const previous: ComputedSplit[] = [{ participantId: 'b', weight: 1, owedMinor: 1000n }];
    const result = weightsFromMode(
      'personal',
      [{ participantId: 'a' }, { participantId: 'b' }],
      previous,
    );
    expect(result).toEqual([{ participantId: 'b', weight: 1 }]);
  });

  it('falls back to the first participant when there is no matching previous choice', () => {
    const previous: ComputedSplit[] = [{ participantId: 'z', weight: 1, owedMinor: 1000n }];
    const result = weightsFromMode(
      'personal',
      [{ participantId: 'a' }, { participantId: 'b' }],
      previous,
    );
    expect(result).toEqual([{ participantId: 'a', weight: 1 }]);
  });

  it('returns an empty array when there are no participants', () => {
    expect(weightsFromMode('personal', [], [])).toEqual([]);
  });
});

describe('weightsFromMode — percent', () => {
  it('distributes 100 evenly across the selected participants', () => {
    const result = weightsFromMode(
      'percent',
      [{ participantId: 'a' }, { participantId: 'b' }, { participantId: 'c' }],
      [],
    );
    expect(result.reduce((sum, p) => sum + (p.weight ?? 0), 0)).toBe(100);
    expect(result.map((p) => p.weight)).toEqual([34, 33, 33]);
  });
});

describe('weightsFromMode — shares', () => {
  it('preserves a previous weight when the participant is unchanged', () => {
    const previous: ComputedSplit[] = [{ participantId: 'a', weight: 3, owedMinor: 750n }];
    const result = weightsFromMode(
      'shares',
      [{ participantId: 'a' }, { participantId: 'b' }],
      previous,
    );
    expect(result).toEqual([
      { participantId: 'a', weight: 3 },
      { participantId: 'b', weight: 1 },
    ]);
  });
});

describe('weightsFromMode — exact', () => {
  it('preserves previous owed amounts when the participant set is unchanged', () => {
    const previous: ComputedSplit[] = [
      { participantId: 'a', weight: 0, owedMinor: 700n },
      { participantId: 'b', weight: 0, owedMinor: 300n },
    ];
    const result = weightsFromMode(
      'exact',
      [{ participantId: 'a' }, { participantId: 'b' }],
      previous,
    );
    expect(result).toEqual([
      { participantId: 'a', owedMinor: 700n },
      { participantId: 'b', owedMinor: 300n },
    ]);
  });

  it('recomputes an equal split of the previous total when the participant set changes', () => {
    const previous: ComputedSplit[] = [
      { participantId: 'a', weight: 0, owedMinor: 700n },
      { participantId: 'b', weight: 0, owedMinor: 300n },
    ];
    const result = weightsFromMode(
      'exact',
      [{ participantId: 'a' }, { participantId: 'b' }, { participantId: 'c' }],
      previous,
    );
    expect(result.reduce((sum, p) => sum + (p.owedMinor ?? 0n), 0n)).toBe(1000n);
    expect(result.map((p) => p.owedMinor)).toEqual([334n, 333n, 333n]);
  });

  it('returns an empty array when there are no participants', () => {
    expect(weightsFromMode('exact', [], [])).toEqual([]);
  });
});
