import { tool } from 'ai';
import { z } from 'zod';
import { getUpcomingCharges } from '@/features/subscriptions/queries';
import { formatToolMoney, type ToolContext } from '../lib/tool-context';

export function createGetRecurringForecastTool(ctx: ToolContext) {
  return tool({
    description: 'Scheduled recurring charges in the next N days.',
    inputSchema: z.object({
      days: z.number().int().min(1).max(90).default(30).describe('Forecast window in days'),
    }),
    execute: async ({ days }) => {
      const charges = await getUpcomingCharges(ctx.spaceId, days);
      return {
        days,
        charges: charges.map((c) => ({
          ruleId: c.ruleId,
          name: c.name,
          runOn: c.on,
          amount: formatToolMoney(c.amountMinor, c.currency, ctx.locale),
        })),
        transactionIds: [] as string[],
      };
    },
  });
}
