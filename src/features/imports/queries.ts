import { createClient } from '@/lib/supabase/server';
import { untyped } from '@/features/transactions/db';
import type {
  CategorizationRuleRow,
  ImportBatchRow,
  ImportMappingTemplateRow,
  ImportRowRecord,
} from './types';

export async function getImportBatch(
  spaceId: string,
  batchId: string,
): Promise<ImportBatchRow | null> {
  const supabase = await createClient();
  const { data } = await untyped(supabase)
    .from<ImportBatchRow>('import_batches')
    .select('*')
    .eq('space_id', spaceId)
    .eq('id', batchId)
    .maybeSingle();
  return data;
}

export async function listImportRows(spaceId: string, batchId: string): Promise<ImportRowRecord[]> {
  const supabase = await createClient();
  const { data } = await untyped(supabase)
    .from<ImportRowRecord>('import_rows')
    .select('*')
    .eq('space_id', spaceId)
    .eq('batch_id', batchId)
    .order('created_at', { ascending: true });
  return data ?? [];
}

export async function listCategorizationRules(spaceId: string): Promise<CategorizationRuleRow[]> {
  const supabase = await createClient();
  const { data } = await untyped(supabase)
    .from<CategorizationRuleRow>('categorization_rules')
    .select('*')
    .eq('space_id', spaceId)
    .order('priority', { ascending: true })
    .order('created_at', { ascending: true });
  return data ?? [];
}

export async function listMappingTemplates(spaceId: string): Promise<ImportMappingTemplateRow[]> {
  const supabase = await createClient();
  const { data } = await untyped(supabase)
    .from<ImportMappingTemplateRow>('import_mapping_templates')
    .select('*')
    .eq('space_id', spaceId)
    .order('name', { ascending: true });
  return data ?? [];
}

export async function getRecentImportBatch(spaceId: string): Promise<ImportBatchRow | null> {
  const supabase = await createClient();
  const { data } = await untyped(supabase)
    .from<ImportBatchRow>('import_batches')
    .select('*')
    .eq('space_id', spaceId)
    .eq('status', 'committed')
    .order('committed_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}
