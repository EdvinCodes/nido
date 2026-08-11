import { createClient } from '@/lib/supabase/server';
import type { PeriodSnapshotRow } from './types';
import { parseSnapshotPayload } from './types';

export async function listPeriodSnapshots(spaceId: string): Promise<PeriodSnapshotRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema('nido')
    .from('period_snapshots')
    .select('id, space_id, period_from, period_to, payload, created_at')
    .eq('space_id', spaceId)
    .order('period_from', { ascending: false });

  if (error) throw error;

  return data.map((row) => ({
    ...row,
    payload: parseSnapshotPayload(row.payload),
  }));
}

export async function getPeriodSnapshot(
  spaceId: string,
  snapshotId: string,
): Promise<PeriodSnapshotRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema('nido')
    .from('period_snapshots')
    .select('id, space_id, period_from, period_to, payload, created_at')
    .eq('space_id', spaceId)
    .eq('id', snapshotId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    ...data,
    payload: parseSnapshotPayload(data.payload),
  };
}

export async function getRecentCurrencies(spaceId: string, limit = 5): Promise<string[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema('nido')
    .from('transactions')
    .select('currency')
    .eq('space_id', spaceId)
    .is('deleted_at', null)
    .order('booked_on', { ascending: false })
    .limit(50);

  if (error) throw error;

  const seen = new Set<string>();
  for (const row of data) {
    if (row.currency && !seen.has(row.currency)) {
      seen.add(row.currency);
      if (seen.size >= limit) break;
    }
  }
  return [...seen];
}

export async function generateLiveSnapshot(
  spaceId: string,
  from: string,
  to: string,
): Promise<PeriodSnapshotRow['payload']> {
  const supabase = await createClient();
  const { data, error } = await supabase.schema('nido').rpc('period_snapshot', {
    p_space_id: spaceId,
    p_from: from,
    p_to: to,
  });
  if (error) throw error;
  return parseSnapshotPayload(data);
}

export async function getSavingsRateSeries(
  spaceId: string,
): Promise<Array<{ periodFrom: string; periodTo: string; savingsRate: number | null }>> {
  const snapshots = await listPeriodSnapshots(spaceId);
  return snapshots
    .slice()
    .reverse()
    .map((s) => ({
      periodFrom: s.period_from,
      periodTo: s.period_to,
      savingsRate: s.payload.totals.savings_rate,
    }));
}
