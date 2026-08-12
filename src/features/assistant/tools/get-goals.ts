import { tool } from 'ai';
import { z } from 'zod';
import { formatToolMoney, wrapUserData, type ToolContext } from '../lib/tool-context';

type GoalProjection = {
  remaining_minor?: number;
  required_monthly_minor?: number | null;
  on_pace?: boolean | null;
};

export function createGetGoalsTool(ctx: ToolContext) {
  return tool({
    description: 'Savings goals with target, saved, deadline, required monthly amount, and pace.',
    inputSchema: z.object({}),
    execute: async () => {
      const { data: goals, error } = await ctx.supabase
        .from('goals')
        .select('*')
        .eq('space_id', ctx.spaceId)
        .neq('status', 'archived')
        .order('created_at', { ascending: true });
      if (error) throw new Error(error.message);

      const goalRows = Array.isArray(goals) ? goals : [];
      const goalIds = goalRows.map((g) => g.id);
      const { data: contribs } =
        goalIds.length > 0
          ? await ctx.supabase
              .from('goal_contributions')
              .select('goal_id, transaction_id')
              .in('goal_id', goalIds)
              .not('transaction_id', 'is', null)
              .limit(100)
          : { data: [] as Array<{ goal_id: string; transaction_id: string | null }> };

      const idsByGoal = new Map<string, string[]>();
      for (const row of contribs ?? []) {
        if (!row.transaction_id) continue;
        const list = idsByGoal.get(row.goal_id) ?? [];
        if (list.length < 20) list.push(row.transaction_id);
        idsByGoal.set(row.goal_id, list);
      }

      const mapped = await Promise.all(
        goalRows.map(async (g) => {
          const { data: projection } = await ctx.supabase.rpc('goal_projection', {
            p_goal_id: g.id,
          });
          const proj = (projection ?? {}) as GoalProjection;
          return {
            id: g.id,
            name: wrapUserData(g.name),
            target: formatToolMoney(g.target_minor, g.currency, ctx.locale),
            saved: formatToolMoney(g.saved_minor, g.currency, ctx.locale),
            targetDate: g.target_date,
            requiredMonthly:
              proj.required_monthly_minor == null
                ? null
                : formatToolMoney(proj.required_monthly_minor, g.currency, ctx.locale),
            onPace: proj.on_pace ?? null,
            status: g.status,
            transactionIds: idsByGoal.get(g.id) ?? [],
          };
        }),
      );

      return {
        goals: mapped,
        transactionIds: [...new Set(mapped.flatMap((g) => g.transactionIds))],
      };
    },
  });
}
