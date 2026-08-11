import { tool } from 'ai';
import { z } from 'zod';
import { rpcJson } from '@/features/transactions/db';
import { formatToolMoney, type ToolContext } from '../lib/tool-context';

type AnomalyRow = {
  type: string;
  transaction_id: string | null;
  booked_on: string;
  amount_minor: number;
  category_id: string | null;
  category_name: string | null;
  merchant: string | null;
};

export function createFindAnomaliesTool(ctx: ToolContext) {
  return tool({
    description:
      'Unusual transactions or category spikes beyond median absolute deviation sensitivity.',
    inputSchema: z.object({
      from: z.string().describe('Start date YYYY-MM-DD inclusive'),
      to: z.string().describe('End date YYYY-MM-DD inclusive'),
      sensitivity: z.number().min(1.5).max(6).default(3).describe('MAD multiplier threshold'),
    }),
    execute: async ({ from, to, sensitivity }) => {
      const { data, error } = await rpcJson(ctx.supabase, 'ai_find_anomalies', {
        p_space_id: ctx.spaceId,
        p_from: from,
        p_to: to,
        p_sensitivity: sensitivity,
      });
      if (error) throw new Error(error.message);

      const rows = (data as AnomalyRow[] | null) ?? [];
      return {
        from,
        to,
        anomalies: rows.map((row) => ({
          type: row.type,
          bookedOn: row.booked_on,
          amount: formatToolMoney(row.amount_minor, ctx.baseCurrency, ctx.locale),
          categoryName: row.category_name ?? '',
          merchant: row.merchant ?? '',
          transactionId: row.transaction_id,
        })),
        transactionIds: rows.map((r) => r.transaction_id).filter((id): id is string => Boolean(id)),
      };
    },
  });
}
