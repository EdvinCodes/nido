import { describe, expect, it } from 'vitest';
import { parseLedgerFilters, parseLedgerFiltersFromSearchParams } from './parse-ledger-filters';

const VIEWER = '00000000-0000-4000-8000-0000000000a3';
const TAG = '00000000-0000-4000-8000-0000000000c1';

describe('parseLedgerFilters', () => {
  it('maps URL params into validated filters', () => {
    expect(
      parseLedgerFilters(
        {
          q: ' coffee ',
          kind: 'expense',
          from: '2026-01-01',
          to: '2026-01-31',
          tags: [TAG],
          amountMin: 100,
          amountMax: 5000,
          shared: true,
          mine: false,
          hasAttachment: true,
        },
        VIEWER,
      ),
    ).toEqual({
      search: 'coffee',
      kind: 'expense',
      dateFrom: '2026-01-01',
      dateTo: '2026-01-31',
      tagIds: [TAG],
      amountMin: 100,
      amountMax: 5000,
      sharedOnly: true,
      hasAttachment: true,
    });
  });

  it('attaches viewerParticipantId only when mine is on', () => {
    expect(parseLedgerFilters({ mine: true }, VIEWER)).toEqual({
      mineOnly: true,
      viewerParticipantId: VIEWER,
    });
    expect(parseLedgerFilters({ mine: true })).toEqual({ mineOnly: true });
  });

  it('ignores unknown kind values', () => {
    expect(parseLedgerFilters({ kind: 'subscription' })).toEqual({});
  });
});

describe('parseLedgerFiltersFromSearchParams', () => {
  it('parses Next.js searchParams shape', () => {
    expect(
      parseLedgerFiltersFromSearchParams(
        {
          q: 'rent',
          kind: 'transfer',
          tags: `${TAG},`,
          min: '250',
          max: 'not-a-number',
          shared: '1',
          mine: '1',
        },
        VIEWER,
      ),
    ).toEqual({
      search: 'rent',
      kind: 'transfer',
      tagIds: [TAG],
      amountMin: 250,
      sharedOnly: true,
      mineOnly: true,
      viewerParticipantId: VIEWER,
    });
  });

  it('accepts tx as an alias for ids deep-links', () => {
    const id = '00000000-0000-4000-8000-0000000000d1';
    const id2 = '00000000-0000-4000-8000-0000000000d2';
    expect(parseLedgerFiltersFromSearchParams({ tx: id })).toEqual({
      transactionIds: [id],
    });
    expect(parseLedgerFiltersFromSearchParams({ ids: `${id},${id2}` })).toEqual({
      transactionIds: [id, id2],
    });
  });
});
