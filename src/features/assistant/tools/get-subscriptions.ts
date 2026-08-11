import { tool } from 'ai';
import { z } from 'zod';
import { listSubscriptionCards } from '@/features/subscriptions/queries';
import { formatToolMoney, type ToolContext } from '../lib/tool-context';

export function createGetSubscriptionsTool(ctx: ToolContext) {
  return tool({
    description: 'Active and cancelled recurring rules with amounts and annualised cost.',
    inputSchema: z.object({
      includeCancelled: z.boolean().default(false).describe('Include cancelled subscriptions'),
    }),
    execute: async ({ includeCancelled }) => {
      const { active, cancelled, monthlyTotalMinor, annualTotalMinor } =
        await listSubscriptionCards(ctx.spaceId);

      const mapCard = (card: (typeof active)[number]) => ({
        id: card.id,
        name: card.name,
        merchant: card.merchant ?? '',
        amount: formatToolMoney(card.amountMinor, card.currency, ctx.locale),
        cycle: card.cycleKey,
        monthly: formatToolMoney(card.monthlyMinor, card.currency, ctx.locale),
        annual: formatToolMoney(card.annualMinor, card.currency, ctx.locale),
        nextRunOn: card.nextRunOn,
        isActive: card.isActive,
      });

      const items = [...active.map(mapCard), ...(includeCancelled ? cancelled.map(mapCard) : [])];

      return {
        count: items.length,
        subscriptions: items,
        monthlyTotal: formatToolMoney(monthlyTotalMinor, ctx.baseCurrency, ctx.locale),
        annualTotal: formatToolMoney(annualTotalMinor, ctx.baseCurrency, ctx.locale),
        transactionIds: [] as string[],
      };
    },
  });
}
