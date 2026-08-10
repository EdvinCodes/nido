/**
 * Server-side reads for accounts. `getAccountBalance` delegates to `nido.account_balance`,
 * which sums the opening balance with every non-deleted transaction touching the account,
 * transfers signed correctly. See Phase 02 task 3 and migration 20260810140300.
 */

import { createClient } from '@/lib/supabase/server';
import { untyped } from '@/features/transactions/db';
import type { AccountRow } from '@/features/transactions/types';

export async function listAccounts(
  spaceId: string,
  includeArchived = false,
): Promise<AccountRow[]> {
  const supabase = await createClient();
  let query = untyped(supabase)
    .from<AccountRow>('accounts')
    .select('*')
    .eq('space_id', spaceId)
    .order('position', { ascending: true });

  if (!includeArchived) query = query.is('archived_at', null);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getAccountBalance(accountId: string): Promise<number> {
  const supabase = await createClient();
  const { data, error } = await untyped(supabase).rpc('account_balance', {
    p_account_id: accountId,
  });
  if (error) throw new Error(error.message);
  return typeof data === 'number' ? data : Number(data ?? 0);
}
