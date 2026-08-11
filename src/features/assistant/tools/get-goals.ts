import { tool } from 'ai';
import { z } from 'zod';
import { listGoalCards } from '@/features/goals/queries';
import { formatToolMoney, type ToolContext } from '../lib/tool-context';

export function createGetGoalsTool(ctx: ToolContext) {
  return tool({
    description: 'Savings goals with target, saved, deadline, required monthly amount, and pace.',
    inputSchema: z.object({}),
    execute: async () => {
      const goals = await listGoalCards(ctx.spaceId);
      return {
        goals: goals.map((g) => ({
          id: g.id,
          name: g.name,
          target: formatToolMoney(g.targetMinor, g.currency, ctx.locale),
          saved: formatToolMoney(g.savedMinor, g.currency, ctx.locale),
          targetDate: g.targetDate,
          requiredMonthly:
            g.projection.requiredMonthlyMinor === null
              ? null
              : formatToolMoney(g.projection.requiredMonthlyMinor, g.currency, ctx.locale),
          onPace: g.projection.onPace,
          status: g.status,
        })),
        transactionIds: [] as string[],
      };
    },
  });
}
