import { tool } from 'ai';
import { z } from 'zod';
import type { SpaceSummary } from '@/features/dashboard/types';
import { rpcJson } from '@/features/transactions/db';
import { formatToolMoney, type ToolContext } from '../lib/tool-context';

export function createGetPeriodSummaryTool(ctx: ToolContext) {
  return tool({
    description:
      'Income, expenses, net, savings rate, and transaction count for a date range in the space base currency.',
    inputSchema: z.object({
      from: z.string().describe('Start date YYYY-MM-DD inclusive'),
      to: z.string().describe('End date YYYY-MM-DD inclusive'),
      participantId: z.uuid().optional().describe('Optional participant filter'),
    }),
    execute: async ({ from, to, participantId }) => {
      const { data, error } = await rpcJson(ctx.supabase, 'space_summary', {
        p_space_id: ctx.spaceId,
        p_from: from,
        p_to: to,
        p_participant_id: participantId ?? null,
      });
      if (error) throw new Error(error.message);
      const summary = data as SpaceSummary;

      const { data: txIds, error: idError } = await rpcJson(
        ctx.supabase,
        'ai_period_transaction_ids',
        {
          p_space_id: ctx.spaceId,
          p_from: from,
          p_to: to,
          p_participant_id: participantId ?? null,
        },
      );
      if (idError) throw new Error(idError.message);

      const totals = summary.totals;
      return {
        from,
        to,
        income: formatToolMoney(totals.income_minor, ctx.baseCurrency, ctx.locale),
        expenses: formatToolMoney(totals.expense_minor, ctx.baseCurrency, ctx.locale),
        net: formatToolMoney(totals.net_minor, ctx.baseCurrency, ctx.locale),
        savingsRate: totals.savings_rate,
        transactionCount: totals.transaction_count,
        transactionIds: txIds as string[],
      };
    },
  });
}
