import { tool } from 'ai';
import { z } from 'zod';
import type { SpaceSummary } from '@/features/dashboard/types';
import { rpcJson } from '@/features/transactions/db';
import { formatToolMoney, type ToolContext } from '../lib/tool-context';

export function createGetSpendingByCategoryTool(ctx: ToolContext) {
  return tool({
    description:
      'Ranked expense categories with amount, share, count, and change versus the previous equivalent period.',
    inputSchema: z.object({
      from: z.string().describe('Start date YYYY-MM-DD inclusive'),
      to: z.string().describe('End date YYYY-MM-DD inclusive'),
      participantId: z.uuid().optional().describe('Optional participant filter'),
      limit: z.number().int().min(1).max(20).default(10).describe('Maximum categories to return'),
    }),
    execute: async ({ from, to, participantId, limit }) => {
      const { data, error } = await rpcJson(ctx.supabase, 'space_summary', {
        p_space_id: ctx.spaceId,
        p_from: from,
        p_to: to,
        p_participant_id: participantId ?? null,
      });
      if (error) throw new Error(error.message);
      const summary = data as SpaceSummary;

      const categories = summary.categories.expense.slice(0, limit).map((cat) => ({
        id: cat.id,
        name: cat.name,
        amount: formatToolMoney(cat.total_minor, ctx.baseCurrency, ctx.locale),
        share: cat.share,
        count: cat.count,
        change: formatToolMoney(cat.change_minor, ctx.baseCurrency, ctx.locale),
      }));

      const { data: txIds, error: idError } = await rpcJson(
        ctx.supabase,
        'ai_period_transaction_ids',
        {
          p_space_id: ctx.spaceId,
          p_from: from,
          p_to: to,
          p_participant_id: participantId ?? null,
          p_kind: 'expense',
        },
      );
      if (idError) throw new Error(idError.message);

      return {
        from,
        to,
        categories,
        transactionIds: txIds as string[],
      };
    },
  });
}
