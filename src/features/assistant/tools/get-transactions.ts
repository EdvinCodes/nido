import { tool } from 'ai';
import { z } from 'zod';
import { rpcJson } from '@/features/transactions/db';
import { formatToolMoney, wrapUserData, type ToolContext } from '../lib/tool-context';

type FilterRow = {
  id: string;
  booked_on: string;
  kind: string;
  amount_minor: number;
  currency: string;
  merchant: string | null;
  description: string | null;
  category_id: string | null;
  category_name: string | null;
  payer_participant_id: string | null;
};

export function createGetTransactionsTool(ctx: ToolContext) {
  return tool({
    description:
      'List up to 50 matching transactions with compact rows. Use for drill-down, not aggregation.',
    inputSchema: z.object({
      from: z.string().optional().describe('Start date YYYY-MM-DD inclusive'),
      to: z.string().optional().describe('End date YYYY-MM-DD inclusive'),
      categoryId: z.uuid().optional().describe('Category filter'),
      participantId: z.uuid().optional().describe('Payer participant filter'),
      merchant: z.string().optional().describe('Merchant substring match'),
      text: z.string().optional().describe('Full-text search over description, merchant, notes'),
      amountMinMinor: z.number().int().optional().describe('Minimum amount in minor units'),
      amountMaxMinor: z.number().int().optional().describe('Maximum amount in minor units'),
      limit: z.number().int().min(1).max(50).default(50).describe('Row cap (max 50)'),
    }),
    execute: async (input) => {
      const { data, error } = await rpcJson(ctx.supabase, 'ai_filter_transactions', {
        p_space_id: ctx.spaceId,
        p_from: input.from ?? null,
        p_to: input.to ?? null,
        p_category_id: input.categoryId ?? null,
        p_participant_id: input.participantId ?? null,
        p_merchant: input.merchant ?? null,
        p_text: input.text ?? null,
        p_amount_min_minor: input.amountMinMinor ?? null,
        p_amount_max_minor: input.amountMaxMinor ?? null,
        p_limit: input.limit,
      });
      if (error) throw new Error(error.message);

      const rows = (data as FilterRow[] | null) ?? [];
      return {
        count: rows.length,
        transactions: rows.map((row) => ({
          id: row.id,
          bookedOn: row.booked_on,
          kind: row.kind,
          amount: formatToolMoney(row.amount_minor, row.currency, ctx.locale),
          merchant: wrapUserData(row.merchant),
          description: wrapUserData(row.description),
          categoryId: row.category_id,
          categoryName: row.category_name ?? '',
          payerParticipantId: row.payer_participant_id,
        })),
        transactionIds: rows.map((r) => r.id),
      };
    },
  });
}
