import { tool } from 'ai';
import { z } from 'zod';
import { listBudgetCards } from '@/features/budgets/queries';
import { formatToolMoney, type ToolContext } from '../lib/tool-context';

export function createGetBudgetStatusTool(ctx: ToolContext) {
  return tool({
    description: 'Every budget with limit, spent, remaining, percentage, and on-pace signal.',
    inputSchema: z.object({
      asOf: z.string().optional().describe('Reference date YYYY-MM-DD; defaults to today UTC'),
    }),
    execute: async ({ asOf }) => {
      const today = asOf ?? new Date().toISOString().slice(0, 10);
      const cards = await listBudgetCards(ctx.spaceId, today);

      return {
        asOf: today,
        budgets: cards.map((b) => {
          const period = b.currentPeriod;
          const limitMinor = period?.limitMinor ?? 0;
          const spentMinor = period?.spentMinor ?? 0;
          return {
            id: b.id,
            name: b.name,
            periodLabel: period ? `${period.startsOn} – ${period.endsOn}` : '',
            limit: formatToolMoney(limitMinor, b.currency, ctx.locale),
            spent: formatToolMoney(spentMinor, b.currency, ctx.locale),
            remaining: formatToolMoney(b.remainingMinor, b.currency, ctx.locale),
            percentUsed: Math.round(b.ratio * 100),
            onPace: b.urgency !== 'over',
            status: b.urgency,
          };
        }),
        transactionIds: [] as string[],
      };
    },
  });
}
