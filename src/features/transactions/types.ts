/**
 * Row shapes for the Phase 02 ledger tables and the `nido.v_transactions` read model.
 *
 * TODO(db:types): `src/lib/supabase/database.types.ts` does not yet include the accounts,
 * transactions, splits, tags, or `v_transactions` relations — they are added by the
 * `20260810140*` migrations. Once `pnpm db:reset && pnpm db:types` has run against a database
 * with those migrations applied, these hand-written shapes can be replaced by the generated
 * `Database['nido']` types and `src/features/transactions/db.ts` can drop its casts.
 */

import type { Database } from '@/lib/supabase/database.types';

export type TxKind = Database['nido']['Enums']['tx_kind'];
export type SplitMode = Database['nido']['Enums']['split_mode'];
export type AccountKind = Database['nido']['Enums']['account_kind'];

/** A single participant's share of a transaction, as aggregated by `v_transactions.splits`. */
export type TransactionSplitView = {
  id: string;
  participant_id: string;
  display_name: string;
  color: string;
  avatar_url: string | null;
  /** numeric(12,4) — returned by PostgREST as a JSON number. */
  weight: number;
  /** bigint minor units — within JS safe-integer range for realistic amounts. */
  owed_minor: number;
  base_owed_minor: number;
};

export type TransactionTagView = {
  id: string;
  name: string;
  color: string;
};

/** One row of `nido.v_transactions`. Money columns are minor units as numbers. */
export type TransactionView = {
  id: string;
  space_id: string;
  kind: TxKind;
  booked_on: string;
  occurred_at: string | null;
  amount_minor: number;
  currency: string;
  base_amount_minor: number;
  base_rate: number;
  description: string;
  merchant: string | null;
  notes: string | null;
  category_id: string | null;
  account_id: string | null;
  to_account_id: string | null;
  payer_participant_id: string | null;
  split_mode: SplitMode;
  external_id: string | null;
  is_pending: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
  category_name: string | null;
  category_color: string | null;
  category_icon: string | null;
  account_name: string | null;
  account_color: string | null;
  to_account_name: string | null;
  payer_name: string | null;
  payer_color: string | null;
  payer_avatar_url: string | null;
  splits: TransactionSplitView[];
  tags: TransactionTagView[];
  attachment_count: number;
};

/** One row of `nido.accounts`. */
export type AccountRow = {
  id: string;
  space_id: string;
  name: string;
  kind: AccountKind;
  currency: string;
  owner_participant_id: string | null;
  opening_balance_minor: number;
  color: string;
  icon: string;
  include_in_totals: boolean;
  position: number;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

/** One row of `nido.tags`. */
export type TagRow = {
  id: string;
  space_id: string;
  name: string;
  color: string;
  created_at: string;
};

/** A single element of the `p.participants` array sent to the create/update RPC. */
export type RpcParticipant = {
  participant_id: string;
  weight?: number;
  owed_minor?: number;
};

/** The `p` jsonb payload for `nido.create_transaction` / `nido.update_transaction`. */
export type TransactionRpcPayload = {
  request_id?: string;
  space_id: string;
  kind: TxKind;
  booked_on: string;
  amount_minor: number;
  currency?: string;
  split_mode?: SplitMode;
  description?: string;
  merchant?: string | null;
  notes?: string | null;
  category_id?: string | null;
  account_id?: string | null;
  to_account_id?: string | null;
  payer_participant_id?: string | null;
  participants?: RpcParticipant[];
  tag_ids?: string[];
  is_pending?: boolean;
  occurred_at?: string | null;
};
