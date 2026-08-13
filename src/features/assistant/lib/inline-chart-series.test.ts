import { describe, expect, it } from 'vitest';
import { comparisonSeriesFromToolParts } from './inline-chart-series';

describe('comparisonSeriesFromToolParts', () => {
  it('builds a trend series from getTrend output', () => {
    const series = comparisonSeriesFromToolParts([
      {
        type: 'tool-getTrend',
        state: 'output-available',
        output: {
          points: [
            {
              bucketStart: '2026-07-01',
              value: { minor: 4000, currency: 'EUR', formatted: '€40' },
            },
            {
              bucketStart: '2026-07-08',
              value: { minor: 5000, currency: 'EUR', formatted: '€50' },
            },
          ],
        },
      },
    ]);
    expect(series).toEqual({
      kind: 'trend',
      points: [
        { label: '2026-07-01', a: 4000 },
        { label: '2026-07-08', a: 5000 },
      ],
    });
  });

  it('builds a compare series from comparePeriods output', () => {
    const series = comparisonSeriesFromToolParts([
      {
        type: 'tool-comparePeriods',
        state: 'output-available',
        output: {
          groups: [
            {
              label: 'Groceries',
              periodA: { minor: 80_000 },
              periodB: { minor: 90_000 },
            },
          ],
        },
      },
    ]);
    expect(series?.kind).toBe('compare');
    expect(series?.points[0]).toEqual({ label: 'Groceries', a: 80_000, b: 90_000 });
  });
});
