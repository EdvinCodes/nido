/**
 * Server-side reads for the ledger. Everything goes through `nido.v_transactions`, never the
 * base table, so soft-deleted rows are excluded and category/account/payer/splits/tags come
 * pre-joined. See docs/04-FEATURES.md § 2 and Phase 02 task 3.
 */

import { createClient } from '@/lib/supabase/server';
import { untyped } from './db';
import {
  listTransactionsSchema,
  type ListTransactionsInput,
  type TransactionCursor,
} from './schemas';
import type { TagRow, TransactionView } from './types';

export type TransactionsPage = {
  rows: TransactionView[];
  nextCursor: TransactionCursor | null;
};

/** Escapes the PostgREST reserved characters in a free-text search term. */
function sanitizeSearch(term: string): string {
  return term
    .replace(/[%,().*]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function listTransactions(input: ListTransactionsInput): Promise<TransactionsPage> {
  const parsed = listTransactionsSchema.parse(input);
  const { filters } = parsed;
  const supabase = await createClient();

  let query = untyped(supabase)
    .from<TransactionView>('v_transactions')
    .select('*')
    .eq('space_id', parsed.spaceId);

  if (filters.kind) query = query.eq('kind', filters.kind);
  if (filters.dateFrom) query = query.gte('booked_on', filters.dateFrom);
  if (filters.dateTo) query = query.lte('booked_on', filters.dateTo);
  if (filters.categoryIds?.length) query = query.in('category_id', filters.categoryIds);
  if (filters.accountIds?.length) query = query.in('account_id', filters.accountIds);
  if (filters.participantIds?.length)
    query = query.in('payer_participant_id', filters.participantIds);
  if (filters.amountMin != null) query = query.gte('amount_minor', filters.amountMin);
  if (filters.amountMax != null) query = query.lte('amount_minor', filters.amountMax);

  if (filters.sharedOnly) {
    query = query.neq('split_mode', 'personal');
  }

  if (filters.mineOnly && filters.viewerParticipantId) {
    // "Mine" = I paid or I appear in the split. Prefer an explicit `or` + `cs` clause
    // (same shape as the tags filter) over `.contains` on the view's aggregated jsonb.
    const pid = filters.viewerParticipantId;
    query = query.or(`payer_participant_id.eq.${pid},splits.cs.[{"participant_id":"${pid}"}]`);
  }

  if (filters.hasAttachment) {
    const { data: attached, error: attError } = await supabase
      .from('attachments')
      .select('transaction_id')
      .eq('space_id', parsed.spaceId)
      .not('transaction_id', 'is', null);
    if (attError) throw new Error(attError.message);
    const ids = [
      ...new Set(
        attached
          .map((row) => row.transaction_id)
          .filter((id): id is string => typeof id === 'string'),
      ),
    ];
    if (ids.length === 0) {
      return { rows: [], nextCursor: null };
    }
    query = query.in('id', ids);
  }

  if (filters.tagIds?.length) {
    const tagClauses = filters.tagIds.map((id) => `tags.cs.[{"id":"${id}"}]`).join(',');
    query = query.or(tagClauses);
  }

  if (filters.search) {
    const term = sanitizeSearch(filters.search);
    if (term) {
      query = query.or(
        `description.ilike.%${term}%,merchant.ilike.%${term}%,notes.ilike.%${term}%`,
      );
    }
  }

  // Keyset pagination on (booked_on desc, id desc): stable and index-friendly for 10k+ rows.
  if (parsed.cursor) {
    query = query.or(
      `booked_on.lt.${parsed.cursor.bookedOn},and(booked_on.eq.${parsed.cursor.bookedOn},id.lt.${parsed.cursor.id})`,
    );
  }

  query = query
    .order('booked_on', { ascending: false })
    .order('id', { ascending: false })
    .limit(parsed.limit + 1);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const rows = data ?? [];
  const hasMore = rows.length > parsed.limit;
  const page = hasMore ? rows.slice(0, parsed.limit) : rows;
  const last = page.at(-1);
  const nextCursor = hasMore && last ? { bookedOn: last.booked_on, id: last.id } : null;

  return { rows: page, nextCursor };
}

export async function getTransaction(id: string): Promise<TransactionView | null> {
  const supabase = await createClient();
  const { data, error } = await untyped(supabase)
    .from<TransactionView>('v_transactions')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export type ActiveParticipant = {
  id: string;
  display_name: string;
  color: string;
  avatar_url: string | null;
  position: number;
  user_id: string | null;
};

export async function getActiveParticipants(spaceId: string): Promise<ActiveParticipant[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('participants')
    .select('id, display_name, color, avatar_url, position, user_id')
    .eq('space_id', spaceId)
    .eq('is_active', true)
    .order('position', { ascending: true });
  return data ?? [];
}

export async function listTags(spaceId: string): Promise<TagRow[]> {
  const supabase = await createClient();
  const { data, error } = await untyped(supabase)
    .from<TagRow>('tags')
    .select('*')
    .eq('space_id', spaceId)
    .order('name', { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}
