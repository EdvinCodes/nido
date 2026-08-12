import { tool } from 'ai';
import { z } from 'zod';
import { formatToolMoney, wrapUserData, type ToolContext } from '../lib/tool-context';

export function createGetRecurringForecastTool(ctx: ToolContext) {
  return tool({
    description: 'Scheduled recurring charges in the next N days.',
    inputSchema: z.object({
      days: z.number().int().min(1).max(90).default(30).describe('Forecast window in days'),
    }),
    execute: async ({ days }) => {
      const today = new Date();
      const until = new Date(today);
      until.setDate(until.getDate() + days);
      const todayStr = today.toISOString().slice(0, 10);
      const untilStr = until.toISOString().slice(0, 10);

      const { data: rules, error } = await ctx.supabase
        .from('recurring_rules')
        .select('id, name, merchant, amount_minor, currency, next_run_on, is_active, cancelled_at')
        .eq('space_id', ctx.spaceId)
        .eq('is_active', true)
        .is('cancelled_at', null)
        .gte('next_run_on', todayStr)
        .lte('next_run_on', untilStr)
        .order('next_run_on', { ascending: true });
      if (error) throw new Error(error.message);

      const ruleRows = Array.isArray(rules) ? rules : [];
      return {
        days,
        charges: ruleRows.map((c) => ({
          ruleId: c.id,
          name: wrapUserData(c.name),
          runOn: c.next_run_on,
          amount: formatToolMoney(c.amount_minor, c.currency, ctx.locale),
        })),
        transactionIds: [] as string[],
      };
    },
  });
}
