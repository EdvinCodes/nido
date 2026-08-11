import { tool } from 'ai';
import { z } from 'zod';
import type { SpaceSummary } from '@/features/dashboard/types';
import { rpcJson } from '@/features/transactions/db';
import { formatToolMoney, type ToolContext } from '../lib/tool-context';

export function createGetTopMerchantsTool(ctx: ToolContext) {
  return tool({
    description: 'Top merchants by total spend in a date range.',
    inputSchema: z.object({
      from: z.string().describe('Start date YYYY-MM-DD inclusive'),
      to: z.string().describe('End date YYYY-MM-DD inclusive'),
      limit: z.number().int().min(1).max(20).default(10).describe('Maximum merchants'),
    }),
    execute: async ({ from, to, limit }) => {
      const { data, error } = await rpcJson(ctx.supabase, 'space_summary', {
        p_space_id: ctx.spaceId,
        p_from: from,
        p_to: to,
        p_participant_id: null,
      });
      if (error) throw new Error(error.message);
      const summary = data as SpaceSummary;

      const merchants = summary.merchants.slice(0, limit).map((m) => ({
        name: m.name,
        total: formatToolMoney(m.total_minor, ctx.baseCurrency, ctx.locale),
        count: m.count,
      }));

      const { data: txIds, error: idError } = await rpcJson(
        ctx.supabase,
        'ai_period_transaction_ids',
        {
          p_space_id: ctx.spaceId,
          p_from: from,
          p_to: to,
          p_kind: 'expense',
        },
      );
      if (idError) throw new Error(idError.message);

      return { from, to, merchants, transactionIds: txIds as string[] };
    },
  });
}
