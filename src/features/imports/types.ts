import type { Database } from '@/lib/supabase/database.types';
import type { ColumnMappingInput } from './schemas';

export type ImportBatchRow = Database['nido']['Tables']['import_batches']['Row'];
export type ImportRowRecord = Database['nido']['Tables']['import_rows']['Row'];
export type CategorizationRuleRow = Database['nido']['Tables']['categorization_rules']['Row'];
export type ImportMappingTemplateRow =
  Database['nido']['Tables']['import_mapping_templates']['Row'];

export type PreviewImportRow = {
  id: string;
  rowIndex: number;
  bookedOn: string | null;
  description: string;
  merchant: string | null;
  amountMinor: bigint | null;
  kind: 'expense' | 'income' | null;
  categoryId: string | null;
  categoryName: string | null;
  decision: 'pending' | 'import' | 'skip' | 'duplicate';
  duplicateOf: string | null;
  externalId: string | null;
  error: string | null;
};

export type ImportPreviewResult = {
  batchId: string;
  rows: PreviewImportRow[];
  counts: {
    toImport: number;
    toSkip: number;
    duplicates: number;
    errors: number;
  };
};

export type SavedMappingTemplate = {
  id: string;
  name: string;
  mapping: ColumnMappingInput;
};

export type SpaceExportPayload = {
  version: 1;
  exportedAt: string;
  space: {
    name: string;
    kind: string;
    baseCurrency: string;
    timezone: string;
  };
  categories: Array<Record<string, unknown>>;
  accounts: Array<Record<string, unknown>>;
  transactions: Array<Record<string, unknown>>;
  rules: Array<Record<string, unknown>>;
};
