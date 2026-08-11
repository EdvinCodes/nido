import { tool } from 'ai';
import { z } from 'zod';
import { getBalancesPageModel } from '@/features/balances/queries';
import { formatToolMoney, type ToolContext } from '../lib/tool-context';

export function createGetBalancesTool(ctx: ToolContext) {
  return tool({
    description: 'Net position per participant and the simplified settlement plan.',
    inputSchema: z.object({}),
    execute: async () => {
      const page = await getBalancesPageModel(ctx.spaceId, ctx.userId);
      return {
        participants: page.balances.map((p) => ({
          id: p.participantId,
          name: ctx.useRealNames ? p.displayName : `Participant ${p.position + 1}`,
          net: formatToolMoney(p.netMinor, page.currency, ctx.locale),
        })),
        settlements: page.simplified.map((s) => ({
          from: s.fromId,
          to: s.toId,
          amount: formatToolMoney(s.amountMinor, page.currency, ctx.locale),
        })),
        transactionIds: [] as string[],
      };
    },
  });
}
