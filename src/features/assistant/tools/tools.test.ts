import { describe, expect, it, vi } from 'vitest';
import { createAssistantTools } from './index';
import type { ToolContext } from '../lib/tool-context';

function mockCtx(): ToolContext {
  const rpc = vi.fn((name: string) => {
    if (name === 'ai_period_transaction_ids') {
      return Promise.resolve({
        data: ['00000000-0000-4000-8000-0000000000d1', '00000000-0000-4000-8000-0000000000d2'],
        error: null,
      });
    }
    return Promise.resolve({
      data: {
        totals: {
          income_minor: 300_000,
          expense_minor: 120_450,
          net_minor: 179_550,
          transaction_count: 12,
          savings_rate: 0.5985,
        },
        previous_totals: {
          income_minor: 300_000,
          expense_minor: 100_000,
          net_minor: 200_000,
          transaction_count: 10,
          savings_rate: 0.6667,
        },
        categories: {
          expense: [
            {
              id: '00000000-0000-4000-8000-0000000000c1',
              name: 'Groceries',
              color: '#000',
              icon: 'cart',
              total_minor: 80_000,
              share: 0.66,
              count: 4,
              change_minor: 5_000,
            },
          ],
          income: [],
        },
        merchants: [{ name: 'Mercadona', total_minor: 50_000, count: 3 }],
        participants: [],
        accounts: [],
        daily: [],
        from: '2026-07-01',
        to: '2026-07-31',
        previous_from: '2026-06-01',
        previous_to: '2026-06-30',
      },
      error: null,
    });
  });

  const supabase = {
    rpc,
    from: vi.fn(() => {
      const builder: Record<string, unknown> = {};
      const chain = () => builder;
      for (const method of [
        'select',
        'eq',
        'in',
        'is',
        'gte',
        'lte',
        'order',
        'limit',
        'neq',
        'not',
      ]) {
        builder[method] = chain;
      }
      builder.single = () => Promise.resolve({ data: { base_currency: 'EUR' }, error: null });
      return Object.assign(Promise.resolve({ data: [], error: null }), builder);
    }),
  };

  return {
    spaceId: '00000000-0000-4000-8000-000000000001',
    userId: '00000000-0000-4000-8000-0000000000a1',
    baseCurrency: 'EUR',
    locale: 'en',
    supabase: supabase as never,
    useRealNames: false,
  };
}

describe('assistant tools', () => {
  it('registers all twelve tools', () => {
    const tools = createAssistantTools(mockCtx());
    expect(Object.keys(tools).sort()).toEqual(
      [
        'comparePeriods',
        'findAnomalies',
        'getBalances',
        'getBudgetStatus',
        'getGoals',
        'getPeriodSummary',
        'getRecurringForecast',
        'getSpendingByCategory',
        'getSubscriptions',
        'getTopMerchants',
        'getTransactions',
        'getTrend',
      ].sort(),
    );
  });

  it('getPeriodSummary returns known-correct seed-shaped figures', async () => {
    const tools = createAssistantTools(mockCtx());
    const tool = tools.getPeriodSummary;
    expect(tool).toBeDefined();
    expect(tool).toHaveProperty('execute');
    const execute = (tool as { execute?: (input: unknown, opts: unknown) => Promise<unknown> })
      .execute;
    expect(execute).toBeTypeOf('function');
    const result = (await execute!(
      { from: '2026-07-01', to: '2026-07-31' },
      { toolCallId: 't1', messages: [] },
    )) as {
      expenses: { minor: number };
      income: { minor: number };
      transactionCount: number;
      transactionIds: string[];
    };
    expect(result.expenses.minor).toBe(120_450);
    expect(result.income.minor).toBe(300_000);
    expect(result.transactionCount).toBe(12);
    expect(result.transactionIds).toHaveLength(2);
  });
});
