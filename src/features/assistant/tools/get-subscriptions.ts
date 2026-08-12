import { tool } from 'ai';
import { z } from 'zod';
import {
  annualMinor,
  monthlyMinor,
  type RecurrenceFreq,
} from '@/features/subscriptions/lib/annualize';
import { formatToolMoney, wrapUserData, type ToolContext } from '../lib/tool-context';

function asFreq(value: string): RecurrenceFreq {
  if (value === 'day' || value === 'week' || value === 'month' || value === 'year') return value;
  return 'month';
}

export function createGetSubscriptionsTool(ctx: ToolContext) {
  return tool({
    description:
      'Active and cancelled recurring rules with amounts, annualised cost, months charged, and last used signal.',
    inputSchema: z.object({
      includeCancelled: z.boolean().default(false).describe('Include cancelled subscriptions'),
    }),
    execute: async ({ includeCancelled }) => {
      const { data: rules, error } = await ctx.supabase
        .from('recurring_rules')
        .select('*')
        .eq('space_id', ctx.spaceId)
        .order('next_run_on', { ascending: true });
      if (error) throw new Error(error.message);

      const filtered = Array.isArray(rules) ? rules : [];
      const activeOrAll = filtered.filter((r) => {
        const active = r.is_active && !r.cancelled_at;
        return includeCancelled ? true : active;
      });
      const ruleIds = activeOrAll.map((r) => r.id);

      const { data: linkedTxs } =
        ruleIds.length > 0
          ? await ctx.supabase
              .from('transactions')
              .select('id, recurring_rule_id, booked_on, amount_minor')
              .eq('space_id', ctx.spaceId)
              .in('recurring_rule_id', ruleIds)
              .is('deleted_at', null)
              .order('booked_on', { ascending: false })
          : {
              data: [] as Array<{
                id: string;
                recurring_rule_id: string | null;
                booked_on: string;
                amount_minor: number;
              }>,
            };

      const byRule = new Map<
        string,
        { ids: string[]; lastUsed: string | null; months: Set<string> }
      >();
      for (const tx of linkedTxs ?? []) {
        if (!tx.recurring_rule_id) continue;
        const bucket = byRule.get(tx.recurring_rule_id) ?? {
          ids: [],
          lastUsed: null,
          months: new Set<string>(),
        };
        if (bucket.ids.length < 20) bucket.ids.push(tx.id);
        bucket.lastUsed ??= tx.booked_on;
        bucket.months.add(tx.booked_on.slice(0, 7));
        byRule.set(tx.recurring_rule_id, bucket);
      }

      const items = activeOrAll.map((r) => {
        const freq = asFreq(r.freq);
        const monthly = monthlyMinor(r.amount_minor, freq, r.interval_count);
        const annual = annualMinor(r.amount_minor, freq, r.interval_count);
        const meta = byRule.get(r.id);
        return {
          id: r.id,
          name: wrapUserData(r.name),
          merchant: wrapUserData(r.merchant),
          amount: formatToolMoney(r.amount_minor, r.currency, ctx.locale),
          cycle: `${r.interval_count}:${freq}`,
          monthly: formatToolMoney(monthly, r.currency, ctx.locale),
          annual: formatToolMoney(annual, r.currency, ctx.locale),
          nextRunOn: r.next_run_on,
          isActive: r.is_active && !r.cancelled_at,
          monthsCharged: meta?.months.size ?? 0,
          lastUsed: meta?.lastUsed ?? null,
          transactionIds: meta?.ids ?? [],
        };
      });

      const activeItems = items.filter((i) => i.isActive);
      const monthlyTotalMinor = activeItems.reduce((sum, i) => sum + i.monthly.minor, 0);
      const annualTotalMinor = activeItems.reduce((sum, i) => sum + i.annual.minor, 0);

      return {
        count: items.length,
        subscriptions: items,
        monthlyTotal: formatToolMoney(monthlyTotalMinor, ctx.baseCurrency, ctx.locale),
        annualTotal: formatToolMoney(annualTotalMinor, ctx.baseCurrency, ctx.locale),
        transactionIds: [...new Set(items.flatMap((item) => item.transactionIds))],
      };
    },
  });
}
