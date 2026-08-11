import { createClient } from '@/lib/supabase/server';
import { simplifySettlements } from './lib/simplify';
import type {
  BalanceBreakdownRow,
  BalancesPageModel,
  PairwiseBalance,
  ParticipantBalance,
  SettlementRow,
} from './types';
import type { SettlementMethod } from './schemas';

function asMethod(value: string | null): SettlementMethod | null {
  if (value === 'cash' || value === 'transfer' || value === 'bizum' || value === 'other') {
    return value;
  }
  return null;
}

function mapSettlement(row: {
  id: string;
  from_participant_id: string;
  to_participant_id: string;
  amount_minor: number;
  currency: string;
  method: string | null;
  note: string | null;
  settled_on: string;
  confirmed_at: string | null;
  confirmed_by: string | null;
  disputed_at: string | null;
  dispute_note: string | null;
  reversed_at: string | null;
  reverse_of_id: string | null;
  created_by: string;
  created_at: string;
}): SettlementRow {
  return {
    id: row.id,
    fromParticipantId: row.from_participant_id,
    toParticipantId: row.to_participant_id,
    amountMinor: row.amount_minor,
    currency: row.currency,
    method: asMethod(row.method),
    note: row.note,
    settledOn: row.settled_on,
    confirmedAt: row.confirmed_at,
    confirmedBy: row.confirmed_by,
    disputedAt: row.disputed_at,
    disputeNote: row.dispute_note,
    reversedAt: row.reversed_at,
    reverseOfId: row.reverse_of_id,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

export async function getParticipantBalances(spaceId: string): Promise<ParticipantBalance[]> {
  const supabase = await createClient();
  const [{ data: balances, error }, { data: participants, error: pError }] = await Promise.all([
    supabase
      .from('v_participant_balances')
      .select('participant_id, paid_minor, owed_minor, net_minor')
      .eq('space_id', spaceId),
    supabase
      .from('participants')
      .select('id, display_name, color, position, user_id')
      .eq('space_id', spaceId)
      .eq('is_active', true)
      .order('position'),
  ]);

  if (error) throw new Error(error.message);
  if (pError) throw new Error(pError.message);

  const byId = new Map(balances.map((b) => [b.participant_id, b]));
  return participants.map((p) => {
    const row = byId.get(p.id);
    return {
      participantId: p.id,
      displayName: p.display_name,
      color: p.color,
      position: p.position,
      userId: p.user_id,
      paidMinor: row?.paid_minor ?? 0,
      owedMinor: row?.owed_minor ?? 0,
      netMinor: row?.net_minor ?? 0,
    };
  });
}

export async function getPairwiseBalances(spaceId: string): Promise<PairwiseBalance[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('pairwise_balances', { p_space_id: spaceId });
  if (error) throw new Error(error.message);
  if (!Array.isArray(data)) return [];
  return data
    .map((raw) => {
      const row = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
      const amount = Number(row.amount_minor ?? 0);
      const from = typeof row.from_participant_id === 'string' ? row.from_participant_id : '';
      const to = typeof row.to_participant_id === 'string' ? row.to_participant_id : '';
      if (!from || !to || amount <= 0) return null;
      return {
        fromParticipantId: from,
        toParticipantId: to,
        amountMinor: amount,
      } satisfies PairwiseBalance;
    })
    .filter((row): row is PairwiseBalance => row !== null);
}

export async function listSettlements(spaceId: string): Promise<SettlementRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('settlements')
    .select('*')
    .eq('space_id', spaceId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data.map(mapSettlement);
}

export async function getBalancesPageModel(
  spaceId: string,
  userId: string,
): Promise<BalancesPageModel> {
  const supabase = await createClient();
  const { data: space, error: spaceError } = await supabase
    .from('spaces')
    .select('base_currency')
    .eq('id', spaceId)
    .single();
  if (spaceError) throw new Error(spaceError.message);

  const [balances, pairwise, settlements] = await Promise.all([
    getParticipantBalances(spaceId),
    getPairwiseBalances(spaceId),
    listSettlements(spaceId),
  ]);

  const simplified = simplifySettlements(
    balances.map((b) => ({
      participantId: b.participantId,
      netMinor: BigInt(b.netMinor),
      position: b.position,
    })),
  ).map((t) => ({
    fromId: t.fromId,
    toId: t.toId,
    amountMinor: Number(t.amountMinor),
  }));

  const myParticipantIds = new Set(
    balances.filter((b) => b.userId === userId).map((b) => b.participantId),
  );

  const pendingForMe = settlements.filter(
    (s) =>
      s.confirmedAt === null &&
      s.disputedAt === null &&
      s.createdBy !== userId &&
      (myParticipantIds.has(s.fromParticipantId) || myParticipantIds.has(s.toParticipantId)),
  );

  return {
    balances,
    pairwise,
    simplified,
    settlements,
    pendingForMe,
    currency: space.base_currency,
  };
}

export async function getBalanceBreakdown(input: {
  spaceId: string;
  participantId: string;
  from?: string | null;
  to?: string | null;
}): Promise<BalanceBreakdownRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('balance_breakdown', {
    p_space_id: input.spaceId,
    p_participant_id: input.participantId,
    ...(input.from ? { p_from: input.from } : {}),
    ...(input.to ? { p_to: input.to } : {}),
  });
  if (error) throw new Error(error.message);
  const payload = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
  const rows = Array.isArray(payload.transactions) ? payload.transactions : [];
  return rows
    .map((raw) => {
      const row = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
      const id = typeof row.transaction_id === 'string' ? row.transaction_id : '';
      if (!id) return null;
      return {
        transactionId: id,
        bookedOn: typeof row.booked_on === 'string' ? row.booked_on : '',
        kind: typeof row.kind === 'string' ? row.kind : '',
        description: typeof row.description === 'string' ? row.description : null,
        merchant: typeof row.merchant === 'string' ? row.merchant : null,
        amountMinor: Number(row.amount_minor ?? 0),
        currency: typeof row.currency === 'string' ? row.currency : 'EUR',
        paidMinor: Number(row.paid_minor ?? 0),
        owedMinor: Number(row.owed_minor ?? 0),
        deltaMinor: Number(row.delta_minor ?? 0),
      } satisfies BalanceBreakdownRow;
    })
    .filter((row): row is BalanceBreakdownRow => row !== null);
}

/** Outstanding simplified debts for the dashboard rail (non-solo). */
export async function getOutstandingBalanceRail(spaceId: string): Promise<{
  currency: string;
  transfers: Array<{ fromName: string; toName: string; amountMinor: number }>;
}> {
  const balances = await getParticipantBalances(spaceId);
  const currency =
    (await (await createClient()).from('spaces').select('base_currency').eq('id', spaceId).single())
      .data?.base_currency ?? 'EUR';

  const nameById = new Map(balances.map((b) => [b.participantId, b.displayName]));
  const transfers = simplifySettlements(
    balances.map((b) => ({
      participantId: b.participantId,
      netMinor: BigInt(b.netMinor),
      position: b.position,
    })),
  )
    .slice(0, 4)
    .map((t) => ({
      fromName: nameById.get(t.fromId) ?? '—',
      toName: nameById.get(t.toId) ?? '—',
      amountMinor: Number(t.amountMinor),
    }));

  return { currency, transfers };
}
