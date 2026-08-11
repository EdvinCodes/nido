import { z } from 'zod';

export const columnMappingSchema = z.object({
  date: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  merchant: z.string().nullable().optional(),
  amount: z.string().nullable().optional(),
  debit: z.string().nullable().optional(),
  credit: z.string().nullable().optional(),
  balance: z.string().nullable().optional(),
  externalId: z.string().nullable().optional(),
});

export const uploadImportSchema = z.object({
  spaceId: z.uuid(),
  fileName: z.string().min(1).max(255),
  source: z.enum(['csv', 'xlsx']),
  fileData: z.string().min(1),
  dateOrder: z.enum(['DMY', 'MDY']).optional(),
});

export const saveMappingSchema = z.object({
  spaceId: z.uuid(),
  batchId: z.uuid(),
  accountId: z.uuid().nullable(),
  mapping: columnMappingSchema,
  templateName: z.string().min(1).max(80).optional(),
});

export const previewImportSchema = z.object({
  spaceId: z.uuid(),
  batchId: z.uuid(),
  dateOrder: z.enum(['DMY', 'MDY']).optional(),
});

export const updateImportRowSchema = z.object({
  spaceId: z.uuid(),
  rowId: z.uuid(),
  bookedOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  description: z.string().max(200).optional(),
  merchant: z.string().max(120).nullable().optional(),
  amountMinor: z.number().int().positive().optional(),
  kind: z.enum(['expense', 'income']).optional(),
  categoryId: z.uuid().nullable().optional(),
  decision: z.enum(['import', 'skip', 'duplicate']).optional(),
});

export const bulkUpdateImportRowsSchema = z.object({
  spaceId: z.uuid(),
  batchId: z.uuid(),
  rowIds: z.array(z.uuid()).min(1),
  categoryId: z.uuid().nullable().optional(),
  decision: z.enum(['import', 'skip', 'duplicate']).optional(),
  skipDuplicates: z.boolean().optional(),
  skipBelowMinor: z.number().int().nonnegative().optional(),
});

export const commitImportSchema = z.object({
  spaceId: z.uuid(),
  batchId: z.uuid(),
});

export const undoImportSchema = z.object({
  spaceId: z.uuid(),
  batchId: z.uuid(),
});

export const createRuleSchema = z.object({
  spaceId: z.uuid(),
  matchType: z.enum(['contains', 'starts_with', 'regex', 'exact']),
  pattern: z.string().min(1).max(200),
  field: z.enum(['description', 'merchant', 'notes']).default('merchant'),
  categoryId: z.uuid(),
  setMerchant: z.string().max(120).nullable().optional(),
  priority: z.number().int().min(0).max(32767).default(100),
  autoLearned: z.boolean().default(false),
});

export const updateRuleSchema = createRuleSchema.extend({
  ruleId: z.uuid(),
});

export const deleteRuleSchema = z.object({
  spaceId: z.uuid(),
  ruleId: z.uuid(),
});

export const reorderRulesSchema = z.object({
  spaceId: z.uuid(),
  ruleIds: z.array(z.uuid()).min(1),
});

export const testRuleSchema = z.object({
  spaceId: z.uuid(),
  ruleId: z.uuid(),
  limit: z.number().int().min(1).max(100).default(20),
});

export const applyRuleSchema = z.object({
  spaceId: z.uuid(),
  ruleId: z.uuid(),
});

export const exportLedgerSchema = z.object({
  spaceId: z.uuid(),
  format: z.enum(['csv', 'xlsx']),
  filters: z.record(z.string(), z.unknown()).optional(),
});

export const exportSpaceSchema = z.object({
  spaceId: z.uuid(),
});

export const importSpaceJsonSchema = z.object({
  spaceId: z.uuid(),
  fileData: z.string().min(1),
});

export type ColumnMappingInput = z.infer<typeof columnMappingSchema>;
