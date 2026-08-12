import { tool } from 'ai';
import { z } from 'zod';
import { simplifySettlements } from '@/features/balances/lib/simplify';
import { anonymizedParticipantLabel, formatToolMoney, type ToolContext } from '../lib/tool-context';

export function createGetBalancesTool(ctx: ToolContext) {
  return tool({
    description: 'Net position per participant and the simplified settlement plan.',
    inputSchema: z.object({}),
    execute: async () => {
      const [{ data: space }, { data: participants }, { data: balances }] = await Promise.all([
        ctx.supabase.from('spaces').select('base_currency').eq('id', ctx.spaceId).single(),
        ctx.supabase
          .from('participants')
          .select('id, display_name, position, user_id')
          .eq('space_id', ctx.spaceId)
          .eq('is_active', true)
          .order('position'),
        ctx.supabase
          .from('v_participant_balances')
          .select('participant_id, paid_minor, owed_minor, net_minor')
          .eq('space_id', ctx.spaceId),
      ]);
      if (!space) throw new Error('Space not found');

      const sorted = [...(participants ?? [])].sort((a, b) => a.position - b.position);
      const balanceById = new Map((balances ?? []).map((b) => [b.participant_id, b]));

      const participantRows = sorted.map((p, index) => {
        const row = balanceById.get(p.id);
        return {
          id: p.id,
          name: ctx.useRealNames ? p.display_name : anonymizedParticipantLabel(index),
          position: p.position,
          netMinor: row?.net_minor ?? 0,
        };
      });

      const simplified = simplifySettlements(
        participantRows.map((p) => ({
          participantId: p.id,
          netMinor: BigInt(p.netMinor),
          position: p.position,
        })),
      ).map((t) => ({
        fromId: t.fromId,
        toId: t.toId,
        amountMinor: Number(t.amountMinor),
      }));

      const labelById = new Map(participantRows.map((p) => [p.id, p.name]));

      return {
        participants: participantRows.map((p) => ({
          id: p.id,
          name: p.name,
          net: formatToolMoney(p.netMinor, space.base_currency, ctx.locale),
        })),
        settlements: simplified.map((s) => ({
          from: labelById.get(s.fromId) ?? s.fromId,
          to: labelById.get(s.toId) ?? s.toId,
          fromId: s.fromId,
          toId: s.toId,
          amount: formatToolMoney(s.amountMinor, space.base_currency, ctx.locale),
        })),
        transactionIds: [] as string[],
      };
    },
  });
}
