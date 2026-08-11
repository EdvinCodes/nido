import { tool } from 'ai';
import { z } from 'zod';
import type { SpaceSummary } from '@/features/dashboard/types';
import { rpcJson } from '@/features/transactions/db';
import { formatToolMoney, type ToolContext } from '../lib/tool-context';

const groupBySchema = z.enum(['category', 'participant', 'merchant']);

export function createComparePeriodsTool(ctx: ToolContext) {
  return tool({
    description: 'Compare two date ranges and return per-group deltas sorted by absolute impact.',
    inputSchema: z.object({
      periodAFrom: z.string().describe('Period A start YYYY-MM-DD'),
      periodATo: z.string().describe('Period A end YYYY-MM-DD'),
      periodBFrom: z.string().describe('Period B start YYYY-MM-DD'),
      periodBTo: z.string().describe('Period B end YYYY-MM-DD'),
      groupBy: groupBySchema.describe('How to group the comparison'),
    }),
    execute: async ({ periodAFrom, periodATo, periodBFrom, periodBTo, groupBy }) => {
      const [aRes, bRes] = await Promise.all([
        rpcJson(ctx.supabase, 'space_summary', {
          p_space_id: ctx.spaceId,
          p_from: periodAFrom,
          p_to: periodATo,
          p_participant_id: null,
        }),
        rpcJson(ctx.supabase, 'space_summary', {
          p_space_id: ctx.spaceId,
          p_from: periodBFrom,
          p_to: periodBTo,
          p_participant_id: null,
        }),
      ]);
      if (aRes.error) throw new Error(aRes.error.message);
      if (bRes.error) throw new Error(bRes.error.message);

      const a = aRes.data as SpaceSummary;
      const b = bRes.data as SpaceSummary;

      type Row = { key: string; label: string; aMinor: number; bMinor: number };
      let rows: Row[] = [];

      if (groupBy === 'category') {
        const mapB = new Map(b.categories.expense.map((c) => [c.id ?? c.name, c]));
        rows = a.categories.expense.map((c) => {
          const other = mapB.get(c.id ?? c.name);
          return {
            key: c.id ?? c.name,
            label: c.name,
            aMinor: c.total_minor,
            bMinor: other?.total_minor ?? 0,
          };
        });
        for (const c of b.categories.expense) {
          const key = c.id ?? c.name;
          if (!rows.some((r) => r.key === key)) {
            rows.push({ key, label: c.name, aMinor: 0, bMinor: c.total_minor });
          }
        }
      } else if (groupBy === 'participant') {
        const mapB = new Map(b.participants.map((p) => [p.id, p]));
        rows = a.participants.map((p) => {
          const other = mapB.get(p.id);
          return {
            key: p.id,
            label: p.display_name,
            aMinor: p.paid_minor,
            bMinor: other?.paid_minor ?? 0,
          };
        });
      } else {
        const mapB = new Map(b.merchants.map((m) => [m.name, m]));
        rows = a.merchants.map((m) => {
          const other = mapB.get(m.name);
          return {
            key: m.name,
            label: m.name,
            aMinor: m.total_minor,
            bMinor: other?.total_minor ?? 0,
          };
        });
      }

      const groups = rows
        .map((row) => {
          const deltaMinor = row.bMinor - row.aMinor;
          const pct = row.aMinor === 0 ? null : (deltaMinor / row.aMinor) * 100;
          return {
            key: row.key,
            label: row.label,
            periodA: formatToolMoney(row.aMinor, ctx.baseCurrency, ctx.locale),
            periodB: formatToolMoney(row.bMinor, ctx.baseCurrency, ctx.locale),
            delta: formatToolMoney(deltaMinor, ctx.baseCurrency, ctx.locale),
            deltaPercent: pct,
          };
        })
        .sort((x, y) => Math.abs(y.delta.minor) - Math.abs(x.delta.minor));

      const [aIds, bIds] = await Promise.all([
        rpcJson(ctx.supabase, 'ai_period_transaction_ids', {
          p_space_id: ctx.spaceId,
          p_from: periodAFrom,
          p_to: periodATo,
        }),
        rpcJson(ctx.supabase, 'ai_period_transaction_ids', {
          p_space_id: ctx.spaceId,
          p_from: periodBFrom,
          p_to: periodBTo,
        }),
      ]);

      return {
        periodA: { from: periodAFrom, to: periodATo },
        periodB: { from: periodBFrom, to: periodBTo },
        groupBy,
        groups: groups.slice(0, 20),
        transactionIds: [...new Set([...(aIds.data as string[]), ...(bIds.data as string[])])],
      };
    },
  });
}
