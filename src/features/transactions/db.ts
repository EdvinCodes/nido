/**
 * Thin, strongly-typed facade over the Supabase client for relations and RPCs that are not
 * yet present in the generated `Database` types (the Phase 02 ledger tables and view).
 *
 * TODO(db:types): once `pnpm db:reset && pnpm db:types` regenerates
 * `src/lib/supabase/database.types.ts` with the accounts/transactions/tags/v_transactions
 * relations and the `create_transaction` family of functions, callers can use the generated
 * client directly and this module can be deleted.
 */

import type { createClient as createServerClient } from '@/lib/supabase/server';

export type AnySupabaseClient = Awaited<ReturnType<typeof createServerClient>>;

type ListResult<Row> = {
  data: Row[] | null;
  error: { message: string } | null;
  count: number | null;
};

type MaybeSingleResult<Row> = {
  data: Row | null;
  error: { message: string } | null;
};

type FilterValue = string | number | boolean | null;

export interface QueryBuilder<Row> extends PromiseLike<ListResult<Row>> {
  select(
    columns?: string,
    options?: { count?: 'exact' | 'planned' | 'estimated'; head?: boolean },
  ): QueryBuilder<Row>;
  insert(values: Record<string, unknown> | Record<string, unknown>[]): QueryBuilder<Row>;
  update(values: Record<string, unknown>): QueryBuilder<Row>;
  delete(): QueryBuilder<Row>;
  eq(column: string, value: FilterValue): QueryBuilder<Row>;
  neq(column: string, value: FilterValue): QueryBuilder<Row>;
  gt(column: string, value: string | number): QueryBuilder<Row>;
  gte(column: string, value: string | number): QueryBuilder<Row>;
  lt(column: string, value: string | number): QueryBuilder<Row>;
  lte(column: string, value: string | number): QueryBuilder<Row>;
  in(column: string, values: readonly (string | number)[]): QueryBuilder<Row>;
  is(column: string, value: null | boolean): QueryBuilder<Row>;
  ilike(column: string, pattern: string): QueryBuilder<Row>;
  contains(column: string, value: unknown): QueryBuilder<Row>;
  or(filters: string): QueryBuilder<Row>;
  order(column: string, options?: { ascending?: boolean; nullsFirst?: boolean }): QueryBuilder<Row>;
  range(from: number, to: number): QueryBuilder<Row>;
  limit(count: number): QueryBuilder<Row>;
  single(): PromiseLike<MaybeSingleResult<Row>>;
  maybeSingle(): PromiseLike<MaybeSingleResult<Row>>;
}

type UntypedClient = {
  from<Row>(relation: string): QueryBuilder<Row>;
  rpc(
    fn: string,
    args: Record<string, unknown>,
  ): PromiseLike<{ data: unknown; error: { message: string } | null }>;
};

/**
 * Reinterprets the client so it can address relations/functions the generated types do not
 * know about yet. The caller supplies the row/return type, keeping every call site typed.
 */
export function untyped(client: AnySupabaseClient): UntypedClient {
  return client as unknown as UntypedClient;
}

export async function rpcJson(
  client: AnySupabaseClient,
  fn: string,
  args: Record<string, unknown>,
): Promise<{ data: unknown; error: { message: string } | null }> {
  return untyped(client).rpc(fn, args);
}
