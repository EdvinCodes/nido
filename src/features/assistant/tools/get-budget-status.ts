import { tool } from 'ai';
import { z } from 'zod';
import { urgencyFromRatio } from '@/features/budgets/lib/budget-math';
import { rpcJson } from '@/features/transactions/db';
import { formatToolMoney, type ToolContext } from '../lib/tool-context';

export function createGetBudgetStatusTool(ctx: ToolContext) {
  return tool({
    description:
      'Every budget for a period with limit, spent, remaining, percentage, and whether it is on pace.',
    inputSchema: z.object({
      period: z
        .string()
        .optional()
        .describe('Reference date YYYY-MM-DD inside the budget period; defaults to today UTC'),
      asOf: z.string().optional().describe('Deprecated alias for period — prefer period'),
    }),
    execute: async ({ period, asOf }) => {
      const today = period ?? asOf ?? new Date().toISOString().slice(0, 10);
      const { data: budgets, error } = await ctx.supabase
        .from('budgets')
        .select('*')
        .eq('space_id', ctx.spaceId)
        .eq('is_active', true);
      if (error) throw new Error(error.message);

      const budgetRows = Array.isArray(budgets) ? budgets : [];
      const mapped = await Promise.all(
        budgetRows.map(async (b) => {
          const { data: periods } = await ctx.supabase
            .from('budget_periods')
            .select('*')
            .eq('budget_id', b.id)
            .lte('starts_on', today)
            .gte('ends_on', today)
            .order('starts_on', { ascending: false })
            .limit(1);

          const current = periods?.[0] ?? null;
          const limitMinor = current?.limit_minor ?? 0;
          const spentMinor = current?.spent_minor ?? 0;
          const remainingMinor = limitMinor - spentMinor;
          const ratio = limitMinor > 0 ? spentMinor / limitMinor : 0;
          const daysInPeriod =
            current != null
              ? Math.max(
                  1,
                  Math.round(
                    (Date.parse(current.ends_on) - Date.parse(current.starts_on)) / 86_400_000,
                  ) + 1,
                )
              : 1;
          const dayIndex =
            current != null
              ? Math.min(
                  daysInPeriod,
                  Math.max(
                    1,
                    Math.round((Date.parse(today) - Date.parse(current.starts_on)) / 86_400_000) +
                      1,
                  ),
                )
              : 1;
          const expectedSpend = (limitMinor * dayIndex) / daysInPeriod;
          const onPace = spentMinor <= expectedSpend * 1.05;
          const urgency = urgencyFromRatio(ratio, spentMinor);

          let transactionIds: string[] = [];
          if (current && b.category_id) {
            const { data: txIds } = await rpcJson(ctx.supabase, 'ai_period_transaction_ids', {
              p_space_id: ctx.spaceId,
              p_from: current.starts_on,
              p_to: current.ends_on,
              p_participant_id: b.participant_id,
              p_category_id: b.category_id,
              p_kind: 'expense',
              p_limit: 50,
            });
            transactionIds = (txIds as string[] | null) ?? [];
          }

          return {
            id: b.id,
            name: b.name,
            periodLabel: current ? `${current.starts_on} – ${current.ends_on}` : '',
            period: current ? { from: current.starts_on, to: current.ends_on } : null,
            limit: formatToolMoney(limitMinor, b.currency, ctx.locale),
            spent: formatToolMoney(spentMinor, b.currency, ctx.locale),
            remaining: formatToolMoney(remainingMinor, b.currency, ctx.locale),
            percentUsed: Math.round(ratio * 100),
            onPace,
            status: urgency,
            transactionIds,
          };
        }),
      );

      return {
        period: today,
        asOf: today,
        budgets: mapped,
        transactionIds: [...new Set(mapped.flatMap((b) => b.transactionIds))],
      };
    },
  });
}
