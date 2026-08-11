import { tool } from 'ai';
import { z } from 'zod';
import type { SpaceSeriesPoint } from '@/features/dashboard/types';
import { rpcJson } from '@/features/transactions/db';
import { formatToolMoney, type ToolContext } from '../lib/tool-context';

const metricSchema = z.enum(['income', 'expense', 'net']);
const granularitySchema = z.enum(['day', 'week', 'month']);

export function createGetTrendTool(ctx: ToolContext) {
  return tool({
    description: 'Time series for income, expense, or net over a date range.',
    inputSchema: z.object({
      metric: metricSchema.describe('Which metric to chart'),
      granularity: granularitySchema.describe('Bucket size'),
      from: z.string().describe('Start date YYYY-MM-DD inclusive'),
      to: z.string().describe('End date YYYY-MM-DD inclusive'),
    }),
    execute: async ({ metric, granularity, from, to }) => {
      const { data, error } = await rpcJson(ctx.supabase, 'space_series', {
        p_space_id: ctx.spaceId,
        p_from: from,
        p_to: to,
        p_granularity: granularity,
      });
      if (error) throw new Error(error.message);

      const series = data as SpaceSeriesPoint[];
      const points = series.map((point) => {
        const minor =
          metric === 'income'
            ? point.income_minor
            : metric === 'expense'
              ? point.expense_minor
              : point.net_minor;
        return {
          bucketStart: point.bucket_start,
          value: formatToolMoney(minor, ctx.baseCurrency, ctx.locale),
        };
      });

      const { data: txIds, error: idError } = await rpcJson(
        ctx.supabase,
        'ai_period_transaction_ids',
        {
          p_space_id: ctx.spaceId,
          p_from: from,
          p_to: to,
          p_kind: metric === 'income' ? 'income' : metric === 'expense' ? 'expense' : null,
        },
      );
      if (idError) throw new Error(idError.message);

      return { metric, granularity, from, to, points, transactionIds: txIds as string[] };
    },
  });
}
