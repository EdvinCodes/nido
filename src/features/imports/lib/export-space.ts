import type { createClient } from '@/lib/supabase/server';
import { untyped } from '@/features/transactions/db';
import type { SpaceExportPayload } from '../types';

type Supabase = Awaited<ReturnType<typeof createClient>>;

type ExportCategory = Record<string, unknown> & { id?: string; name?: string };
type ExportTransaction = Record<string, unknown> & { category_id?: string };

function isSpaceExportPayload(value: unknown): value is SpaceExportPayload {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return record.version === 1 && Array.isArray(record.transactions);
}

export async function buildSpaceExport(
  supabase: Supabase,
  spaceId: string,
): Promise<SpaceExportPayload> {
  const { data: space } = await supabase
    .from('spaces')
    .select('name, kind, base_currency, timezone')
    .eq('id', spaceId)
    .single();

  const { data: categories } = await untyped(supabase)
    .from<ExportCategory>('categories')
    .select('id, name, kind, color, icon, parent_id, position')
    .eq('space_id', spaceId);

  const { data: accounts } = await untyped(supabase)
    .from<Record<string, unknown>>('accounts')
    .select('id, name, kind, currency, opening_balance_minor, position')
    .eq('space_id', spaceId);

  const { data: transactions } = await untyped(supabase)
    .from<ExportTransaction>('transactions')
    .select(
      'id, kind, booked_on, amount_minor, currency, description, merchant, notes, category_id, account_id, external_id, split_mode, payer_participant_id',
    )
    .eq('space_id', spaceId)
    .is('deleted_at', null);

  const { data: rules } = await untyped(supabase)
    .from<Record<string, unknown>>('categorization_rules')
    .select('match_type, pattern, field, category_id, set_merchant, priority, auto_learned')
    .eq('space_id', spaceId);

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    space: {
      name: space?.name ?? '',
      kind: space?.kind ?? 'solo',
      baseCurrency: space?.base_currency ?? 'EUR',
      timezone: space?.timezone ?? 'UTC',
    },
    categories: categories ?? [],
    accounts: accounts ?? [],
    transactions: transactions ?? [],
    rules: rules ?? [],
  };
}

export async function parseSpaceImportPayload(
  supabase: Supabase,
  spaceId: string,
  fileData: string,
  userId: string,
  participantId: string,
): Promise<
  | { ok: true; data: { importedTransactions: number } }
  | { ok: false; error: { code: string; message: string } }
> {
  let payload: unknown;
  try {
    payload = JSON.parse(fileData);
  } catch {
    return { ok: false, error: { code: 'invalid_json', message: 'Invalid JSON file' } };
  }

  if (!isSpaceExportPayload(payload)) {
    return { ok: false, error: { code: 'invalid_format', message: 'Unsupported export format' } };
  }

  const typedPayload = payload;

  const categoryIdMap = new Map<string, string>();
  for (const cat of typedPayload.categories) {
    const oldId = typeof cat.id === 'string' ? cat.id : '';
    const { data: inserted } = await untyped(supabase)
      .from<{ id: string }>('categories')
      .insert({
        space_id: spaceId,
        name: typeof cat.name === 'string' ? cat.name : 'Imported',
        kind: cat.kind ?? 'expense',
        color: typeof cat.color === 'string' ? cat.color : '#888888',
        icon: typeof cat.icon === 'string' ? cat.icon : 'tag',
        parent_id: null,
        position: typeof cat.position === 'number' ? cat.position : 0,
      })
      .select('id')
      .single();
    if (inserted && oldId) categoryIdMap.set(oldId, inserted.id);
  }

  let imported = 0;
  for (const tx of typedPayload.transactions) {
    const rawCategoryId = tx.category_id;
    const categoryId =
      typeof rawCategoryId === 'string' ? categoryIdMap.get(rawCategoryId) : undefined;
    const { error } = await untyped(supabase).rpc('create_transaction', {
      p: {
        space_id: spaceId,
        kind: tx.kind,
        booked_on: tx.booked_on,
        amount_minor: tx.amount_minor,
        currency: tx.currency,
        description: typeof tx.description === 'string' ? tx.description : '',
        merchant: typeof tx.merchant === 'string' ? tx.merchant : null,
        notes: typeof tx.notes === 'string' ? tx.notes : null,
        category_id: categoryId,
        account_id: tx.account_id ?? null,
        external_id: tx.external_id ?? null,
        split_mode: 'personal',
        payer_participant_id: participantId,
        participants: [{ participant_id: participantId, weight: 1 }],
      },
    });
    if (!error) imported += 1;
  }

  for (const rule of typedPayload.rules) {
    const rawCategoryId = rule.category_id;
    const categoryId =
      typeof rawCategoryId === 'string' ? categoryIdMap.get(rawCategoryId) : undefined;
    if (!categoryId) continue;
    await untyped(supabase)
      .from('categorization_rules')
      .insert({
        space_id: spaceId,
        match_type: rule.match_type,
        pattern: rule.pattern,
        field: rule.field ?? 'merchant',
        category_id: categoryId,
        set_merchant: rule.set_merchant ?? null,
        priority: typeof rule.priority === 'number' ? rule.priority : 100,
        auto_learned: rule.auto_learned === true,
      });
  }

  void userId;
  return { ok: true, data: { importedTransactions: imported } };
}
