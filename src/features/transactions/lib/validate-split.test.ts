import { describe, expect, it } from 'vitest';
import { validateSplit } from './validate-split';

describe('validateSplit — amount', () => {
  it('rejects a zero or negative amount', () => {
    expect(validateSplit('equal', [{ participantId: 'a' }], 0n)).toEqual({
      ok: false,
      remainderMinor: 0n,
      errorKey: 'split.amountInvalid',
    });
    expect(validateSplit('equal', [{ participantId: 'a' }], -100n)).toEqual({
      ok: false,
      remainderMinor: -100n,
      errorKey: 'split.amountInvalid',
    });
  });
});

describe('validateSplit — participants', () => {
  it('rejects an empty participant list', () => {
    expect(validateSplit('equal', [], 1000n)).toEqual({
      ok: false,
      remainderMinor: 1000n,
      errorKey: 'split.noParticipants',
    });
  });
});

describe('validateSplit — personal', () => {
  it('requires exactly one participant', () => {
    expect(validateSplit('personal', [{ participantId: 'a' }], 1000n)).toEqual({ ok: true });
    expect(
      validateSplit('personal', [{ participantId: 'a' }, { participantId: 'b' }], 1000n),
    ).toEqual({ ok: false, remainderMinor: 1000n, errorKey: 'split.personalNeedsOne' });
  });
});

describe('validateSplit — equal', () => {
  it('is always valid once there is at least one participant', () => {
    expect(validateSplit('equal', [{ participantId: 'a' }, { participantId: 'b' }], 1000n)).toEqual(
      { ok: true },
    );
  });
});

describe('validateSplit — shares', () => {
  it('rejects when every weight is zero', () => {
    expect(
      validateSplit(
        'shares',
        [
          { participantId: 'a', weight: 0 },
          { participantId: 'b', weight: 0 },
        ],
        1000n,
      ),
    ).toEqual({ ok: false, remainderMinor: 1000n, errorKey: 'split.zeroWeight' });
  });

  it('accepts any positive total weight', () => {
    expect(
      validateSplit(
        'shares',
        [
          { participantId: 'a', weight: 2 },
          { participantId: 'b', weight: 0 },
        ],
        1000n,
      ),
    ).toEqual({ ok: true });
  });

  it('rejects a negative weight', () => {
    expect(
      validateSplit(
        'shares',
        [
          { participantId: 'a', weight: -1 },
          { participantId: 'b', weight: 2 },
        ],
        1000n,
      ),
    ).toEqual({ ok: false, remainderMinor: 1000n, errorKey: 'split.zeroWeight' });
  });
});

describe('validateSplit — percent', () => {
  it('accepts weights that total exactly 100', () => {
    expect(
      validateSplit(
        'percent',
        [
          { participantId: 'a', weight: 60 },
          { participantId: 'b', weight: 40 },
        ],
        1000n,
      ),
    ).toEqual({ ok: true });
  });

  it('accepts fractional percentages that total exactly 100', () => {
    expect(
      validateSplit(
        'percent',
        [
          { participantId: 'a', weight: 33.33 },
          { participantId: 'b', weight: 33.33 },
          { participantId: 'c', weight: 33.34 },
        ],
        10_000n,
      ),
    ).toEqual({ ok: true });
  });

  it('reports the shortfall as a minor-unit remainder when under 100', () => {
    const result = validateSplit(
      'percent',
      [
        { participantId: 'a', weight: 50 },
        { participantId: 'b', weight: 40 },
      ],
      1000n,
    );
    expect(result).toEqual({ ok: false, remainderMinor: 100n, errorKey: 'split.percentNot100' });
  });

  it('reports a negative remainder when over 100', () => {
    const result = validateSplit(
      'percent',
      [
        { participantId: 'a', weight: 60 },
        { participantId: 'b', weight: 50 },
      ],
      1000n,
    );
    expect(result).toEqual({ ok: false, remainderMinor: -100n, errorKey: 'split.percentNot100' });
  });
});

describe('validateSplit — exact', () => {
  it('accepts amounts that sum exactly to the total', () => {
    expect(
      validateSplit(
        'exact',
        [
          { participantId: 'a', owedMinor: 700n },
          { participantId: 'b', owedMinor: 300n },
        ],
        1000n,
      ),
    ).toEqual({ ok: true });
  });

  it('reports the unallocated remainder', () => {
    const result = validateSplit(
      'exact',
      [
        { participantId: 'a', owedMinor: 700n },
        { participantId: 'b', owedMinor: 200n },
      ],
      1000n,
    );
    expect(result).toEqual({ ok: false, remainderMinor: 100n, errorKey: 'split.exactUnbalanced' });
  });

  it('reports over-allocation as a negative remainder', () => {
    const result = validateSplit(
      'exact',
      [
        { participantId: 'a', owedMinor: 700n },
        { participantId: 'b', owedMinor: 400n },
      ],
      1000n,
    );
    expect(result).toEqual({
      ok: false,
      remainderMinor: -100n,
      errorKey: 'split.exactUnbalanced',
    });
  });

  it('treats a missing owedMinor as fully unallocated', () => {
    const result = validateSplit('exact', [{ participantId: 'a' }], 1000n);
    expect(result).toEqual({
      ok: false,
      remainderMinor: 1000n,
      errorKey: 'split.exactUnbalanced',
    });
  });
});
