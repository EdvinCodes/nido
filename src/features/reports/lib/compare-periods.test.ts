import { describe, expect, it } from 'vitest';
import { formatMoney, money } from '@/lib/money';
import { buildCategoryDeltas, buildDriverSentence, comparePeriodTotals } from './compare-periods';

describe('buildCategoryDeltas', () => {
  it('includes categories present in only one period', () => {
    const deltas = buildCategoryDeltas(
      [{ id: 'a', name: 'Groceries', color: '#f00', totalMinor: 10_000 }],
      [{ id: 'b', totalMinor: 3_000 }],
    );
    expect(deltas).toHaveLength(2);
    expect(deltas.find((d) => d.id === 'b')?.changeMinor).toBe(-3_000);
  });
});

describe('buildDriverSentence', () => {
  it('names top movers', () => {
    const sentence = buildDriverSentence(
      [
        {
          id: 'a',
          name: 'Groceries',
          color: '#f00',
          currentMinor: 18_700,
          previousMinor: 10_000,
          changeMinor: 8_700,
        },
        {
          id: 'b',
          name: 'Eating out',
          color: '#0f0',
          currentMinor: 2_000,
          previousMinor: 6_200,
          changeMinor: -4_200,
        },
      ],
      (m) => formatMoney(money(BigInt(m), 'EUR'), { locale: 'en-US' }),
    );
    expect(sentence).toContain('Groceries up');
    expect(sentence).toContain('Eating out down');
  });
});

describe('comparePeriodTotals', () => {
  it('computes arithmetic deltas', () => {
    const summary = comparePeriodTotals(
      { incomeMinor: 200_000, expenseMinor: 120_000 },
      { incomeMinor: 180_000, expenseMinor: 100_000 },
      [],
      () => '',
    );
    expect(summary.incomeDelta).toBe(20_000);
    expect(summary.expenseDelta).toBe(20_000);
    expect(summary.netDelta).toBe(0);
  });
});
