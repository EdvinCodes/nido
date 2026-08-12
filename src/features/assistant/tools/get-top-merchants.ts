import { tool } from 'ai';
import { z } from 'zod';
import type { SpaceSummary } from '@/features/dashboard/types';
import { rpcJson } from '@/features/transactions/db';
import { formatToolMoney, wrapUserData, type ToolContext } from '../lib/tool-context';

export function createGetTopMerchantsTool(ctx: ToolContext) {
  return tool({
    description: 'Top merchants by total spend in a date range, with first and last seen dates.',
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

      const top = summary.merchants.slice(0, limit);
      const merchants = await Promise.all(
        top.map(async (m) => {
          const { data: rows } = await ctx.supabase
            .from('transactions')
            .select('id, booked_on')
            .eq('space_id', ctx.spaceId)
            .eq('kind', 'expense')
            .eq('merchant', m.name)
            .gte('booked_on', from)
            .lte('booked_on', to)
            .is('deleted_at', null)
            .order('booked_on', { ascending: true });

          const ids = (rows ?? []).map((r) => r.id);
          const dates = (rows ?? []).map((r) => r.booked_on);
          return {
            name: wrapUserData(m.name),
            total: formatToolMoney(m.total_minor, ctx.baseCurrency, ctx.locale),
            count: m.count,
            firstSeen: dates[0] ?? null,
            lastSeen: dates.at(-1) ?? null,
            transactionIds: ids.slice(0, 50),
          };
        }),
      );

      return {
        from,
        to,
        merchants,
        transactionIds: [...new Set(merchants.flatMap((m) => m.transactionIds))],
      };
    },
  });
}
