'use server';

import { revalidatePath } from 'next/cache';
import { applyMappingToRows } from '@/features/imports/lib/apply-mapping';
import { parseStatementFile } from '@/features/imports/lib/parse-statement-file';
import { exportLedgerCsv, exportLedgerXlsx } from '@/features/imports/lib/export-ledger';
import { buildSpaceExport, parseSpaceImportPayload } from '@/features/imports/lib/export-space';
import { listTransactions } from '@/features/transactions/queries';
import { transactionFingerprint } from '@/features/transactions/lib/transaction-fingerprint';
import { authedAction } from '@/lib/auth/authed-action';
import type { SpaceContext } from '@/lib/auth/authed-action';
import { rpcJson, untyped } from '@/features/transactions/db';
import {
  applyRuleSchema,
  bulkUpdateImportRowsSchema,
  commitImportSchema,
  createRuleSchema,
  deleteRuleSchema,
  exportLedgerSchema,
  exportSpaceSchema,
  importSpaceJsonSchema,
  previewImportSchema,
  reorderRulesSchema,
  saveMappingSchema,
  testRuleSchema,
  undoImportSchema,
  updateImportRowSchema,
  updateRuleSchema,
  uploadImportSchema,
} from './schemas';
import type { ImportPreviewResult, PreviewImportRow } from './types';

function decodeBase64(data: string): Uint8Array {
  const buf = Buffer.from(data, 'base64');
  return new Uint8Array(buf);
}

function revalidateImport(spaceId: string): void {
  revalidatePath(`/s/${spaceId}/import`);
  revalidatePath(`/s/${spaceId}/ledger`);
  revalidatePath(`/s/${spaceId}/settings/rules`);
}

async function buildPreview(
  ctx: SpaceContext,
  spaceId: string,
  batchId: string,
  dateOrder?: 'DMY' | 'MDY',
): Promise<ImportPreviewResult | { error: string }> {
  const batch = await untyped(ctx.supabase)
    .from<{ mapping: Record<string, string | null>; account_id: string | null }>('import_batches')
    .select('mapping, account_id')
    .eq('id', batchId)
    .eq('space_id', spaceId)
    .single();

  if (!batch.data) return { error: 'batch not found' };

  const rowsResult = await untyped(ctx.supabase)
    .from<{
      id: string;
      raw: Record<string, string>;
      decision: string;
      duplicate_of: string | null;
    }>('import_rows')
    .select('id, raw, decision, duplicate_of')
    .eq('batch_id', batchId)
    .eq('space_id', spaceId);

  const { data: categories } = await ctx.supabase
    .from('categories')
    .select('id, name')
    .eq('space_id', spaceId);

  const catMap = new Map((categories ?? []).map((c) => [c.id, c.name]));
  const dbRows = rowsResult.data ?? [];
  const headers = Object.keys(dbRows[0]?.raw ?? {});
  const rawMatrix = dbRows.map((r) => headers.map((h) => r.raw[h] ?? ''));

  const mapped = applyMappingToRows(headers, rawMatrix, batch.data.mapping, 'DMY', dateOrder);

  const { data: space } = await ctx.supabase
    .from('spaces')
    .select('base_currency')
    .eq('id', spaceId)
    .single();

  const currency = space?.base_currency ?? 'EUR';
  const accountId = batch.data.account_id;
  const previewRows: PreviewImportRow[] = [];

  for (let i = 0; i < dbRows.length; i++) {
    const dbRow = dbRows[i];
    const m = mapped[i];
    if (!dbRow || !m) continue;
    const fingerprint =
      m.bookedOn && m.amountMinor
        ? transactionFingerprint({
            spaceId,
            bookedOn: m.bookedOn,
            amountMinor: m.amountMinor,
            currency,
            accountId,
            merchant: m.merchant,
            description: m.description,
          })
        : `pending-${i}`;

    let categoryId: string | null = null;
    let categoryName: string | null = null;
    let merchant = m.merchant;

    const { data: ruleMatch } = await rpcJson(ctx.supabase, 'apply_categorization_rules', {
      p_space_id: spaceId,
      p_text: m.description,
      p_merchant: merchant ?? '',
    });

    if (Array.isArray(ruleMatch) && ruleMatch[0]) {
      const hit = ruleMatch[0] as { category_id: string; set_merchant: string | null };
      categoryId = hit.category_id;
      categoryName = catMap.get(hit.category_id) ?? null;
      if (hit.set_merchant) merchant = hit.set_merchant;
    }

    let duplicateOf: string | null = dbRow.duplicate_of;
    let decision = dbRow.decision as PreviewImportRow['decision'];

    if (!duplicateOf && m.bookedOn && m.amountMinor) {
      const { data: dupId } = await rpcJson(ctx.supabase, 'find_duplicate', {
        p_space_id: spaceId,
        p_fingerprint: fingerprint,
        p_booked_on: m.bookedOn,
        p_amount: m.amountMinor,
        p_external_id: m.externalId,
        p_normalized_text:
          (merchant ?? m.description).trim().toLowerCase().replace(/\s+/g, ' ') || m.description,
      });
      if (typeof dupId === 'string') {
        duplicateOf = dupId;
        if (decision === 'pending') decision = 'duplicate';
      }
    }

    if (decision === 'pending' && !m.error) decision = 'import';
    if (m.error) decision = 'skip';

    const parsed = {
      booked_on: m.bookedOn,
      description: m.description,
      merchant,
      amount_minor: m.amountMinor ? Number(m.amountMinor) : null,
      kind: m.kind,
      category_id: categoryId,
      external_id: m.externalId,
      currency,
      account_id: accountId,
    };

    await untyped(ctx.supabase)
      .from('import_rows')
      .update({
        parsed,
        fingerprint,
        duplicate_of: duplicateOf,
        decision,
      })
      .eq('id', dbRow.id);

    previewRows.push({
      id: dbRow.id,
      rowIndex: m.rowIndex,
      bookedOn: m.bookedOn,
      description: m.description,
      merchant,
      amountMinor: m.amountMinor,
      kind: m.kind,
      categoryId,
      categoryName,
      decision,
      duplicateOf,
      externalId: m.externalId,
      error: m.error,
    });
  }

  return {
    batchId,
    rows: previewRows,
    counts: {
      toImport: previewRows.filter((r) => r.decision === 'import').length,
      toSkip: previewRows.filter((r) => r.decision === 'skip').length,
      duplicates: previewRows.filter((r) => r.decision === 'duplicate').length,
      errors: previewRows.filter((r) => r.error).length,
    },
  };
}

export const uploadImportAction = authedAction()
  .schema(uploadImportSchema)
  .space(({ input }) => input.spaceId, { action: 'transactions.create' })
  .action(async ({ input, ctx }) => {
    const bytes = decodeBase64(input.fileData);
    const parsed = parseStatementFile(bytes, input.fileName, {
      ...(input.dateOrder ? { dateOrder: input.dateOrder } : {}),
    });

    const { data: batch, error: batchError } = await untyped(ctx.supabase)
      .from<{ id: string }>('import_batches')
      .insert({
        space_id: input.spaceId,
        source: input.source,
        file_name: input.fileName,
        mapping: parsed.suggestedMapping,
        status: 'mapping',
        row_count: parsed.rowCount,
        created_by: ctx.userId,
      })
      .select('id')
      .single();

    if (batchError || !batch) {
      return {
        ok: false as const,
        error: { code: 'import_upload_failed', message: batchError?.message ?? 'upload failed' },
      };
    }

    const rawRows = parsed.rows.map((row, rowIndex) => ({
      batch_id: batch.id,
      space_id: input.spaceId,
      raw: Object.fromEntries(parsed.headers.map((h, idx) => [h, row[idx] ?? ''])),
      fingerprint: `pending-${rowIndex}`,
      decision: 'pending',
    }));

    if (rawRows.length > 0) {
      const { error: rowsError } = await untyped(ctx.supabase).from('import_rows').insert(rawRows);
      if (rowsError) {
        return {
          ok: false as const,
          error: { code: 'import_rows_failed', message: rowsError.message },
        };
      }
    }

    revalidateImport(input.spaceId);
    return {
      ok: true as const,
      data: {
        batchId: batch.id,
        encoding: parsed.encoding,
        delimiter: parsed.delimiter,
        rowCount: parsed.rowCount,
        headers: parsed.headers,
        suggestedMapping: parsed.suggestedMapping,
        dateFormat: parsed.dateFormat,
      },
    };
  });

export const saveImportMappingAction = authedAction()
  .schema(saveMappingSchema)
  .space(({ input }) => input.spaceId, { action: 'transactions.create' })
  .action(async ({ input, ctx }) => {
    const { error } = await untyped(ctx.supabase)
      .from('import_batches')
      .update({
        mapping: input.mapping,
        account_id: input.accountId,
        status: 'previewing',
      })
      .eq('id', input.batchId)
      .eq('space_id', input.spaceId);

    if (error) {
      return {
        ok: false as const,
        error: { code: 'mapping_save_failed', message: error.message },
      };
    }

    if (input.templateName) {
      const { data: existing } = await untyped(ctx.supabase)
        .from<{ id: string }>('import_mapping_templates')
        .select('id')
        .eq('space_id', input.spaceId)
        .eq('name', input.templateName)
        .maybeSingle();

      if (existing) {
        await untyped(ctx.supabase)
          .from('import_mapping_templates')
          .update({ mapping: input.mapping })
          .eq('id', existing.id);
      } else {
        await untyped(ctx.supabase).from('import_mapping_templates').insert({
          space_id: input.spaceId,
          name: input.templateName,
          mapping: input.mapping,
          created_by: ctx.userId,
        });
      }
    }

    revalidateImport(input.spaceId);
    return { ok: true as const, data: { batchId: input.batchId } };
  });

export const previewImportAction = authedAction()
  .schema(previewImportSchema)
  .space(({ input }) => input.spaceId, { action: 'transactions.create' })
  .action(async ({ input, ctx }) => {
    const result = await buildPreview(ctx, input.spaceId, input.batchId, input.dateOrder);
    if ('error' in result) {
      return { ok: false as const, error: { code: 'preview_failed', message: result.error } };
    }
    revalidateImport(input.spaceId);
    return { ok: true as const, data: result };
  });

export const updateImportRowAction = authedAction()
  .schema(updateImportRowSchema)
  .space(({ input }) => input.spaceId, { action: 'transactions.create' })
  .action(async ({ input, ctx }) => {
    const { data: row } = await untyped(ctx.supabase)
      .from<{ parsed: Record<string, unknown> }>('import_rows')
      .select('parsed')
      .eq('id', input.rowId)
      .eq('space_id', input.spaceId)
      .single();

    if (!row) {
      return { ok: false as const, error: { code: 'not_found', message: 'Row not found' } };
    }

    const parsed = { ...row.parsed };
    if (input.bookedOn) parsed.booked_on = input.bookedOn;
    if (input.description !== undefined) parsed.description = input.description;
    if (input.merchant !== undefined) parsed.merchant = input.merchant;
    if (input.amountMinor !== undefined) parsed.amount_minor = input.amountMinor;
    if (input.kind) parsed.kind = input.kind;
    if (input.categoryId !== undefined) parsed.category_id = input.categoryId;

    const patch: Record<string, unknown> = { parsed };
    if (input.decision) patch.decision = input.decision;

    const { error } = await untyped(ctx.supabase)
      .from('import_rows')
      .update(patch)
      .eq('id', input.rowId)
      .eq('space_id', input.spaceId);

    if (error) {
      return { ok: false as const, error: { code: 'update_failed', message: error.message } };
    }

    revalidateImport(input.spaceId);
    return { ok: true as const, data: { rowId: input.rowId } };
  });

export const bulkUpdateImportRowsAction = authedAction()
  .schema(bulkUpdateImportRowsSchema)
  .space(({ input }) => input.spaceId, { action: 'transactions.create' })
  .action(async ({ input, ctx }) => {
    for (const rowId of input.rowIds) {
      const { data: row } = await untyped(ctx.supabase)
        .from<{ parsed: Record<string, unknown>; decision: string; duplicate_of: string | null }>(
          'import_rows',
        )
        .select('parsed, decision, duplicate_of')
        .eq('id', rowId)
        .eq('batch_id', input.batchId)
        .single();

      if (!row) continue;

      const parsed = { ...row.parsed };
      if (input.categoryId !== undefined) parsed.category_id = input.categoryId;

      let decision = input.decision ?? row.decision;
      if (input.skipDuplicates && row.duplicate_of) decision = 'skip';
      if (input.skipBelowMinor !== undefined) {
        const amt = Number(parsed.amount_minor ?? 0);
        if (amt < input.skipBelowMinor) decision = 'skip';
      }

      await untyped(ctx.supabase).from('import_rows').update({ parsed, decision }).eq('id', rowId);
    }

    revalidateImport(input.spaceId);
    return { ok: true as const, data: { updated: input.rowIds.length } };
  });

export const commitImportAction = authedAction()
  .schema(commitImportSchema)
  .space(({ input }) => input.spaceId, { action: 'transactions.create' })
  .action(async ({ input, ctx }) => {
    await buildPreview(ctx, input.spaceId, input.batchId);

    const { data, error } = await rpcJson(ctx.supabase, 'commit_import', {
      p_batch_id: input.batchId,
    });

    if (error) {
      return { ok: false as const, error: { code: 'commit_failed', message: error.message } };
    }

    revalidateImport(input.spaceId);
    const result = data as { imported?: number; skipped?: number };
    return {
      ok: true as const,
      data: { imported: result.imported ?? 0, skipped: result.skipped ?? 0 },
    };
  });

export const undoImportAction = authedAction()
  .schema(undoImportSchema)
  .space(({ input }) => input.spaceId, { action: 'transactions.create' })
  .action(async ({ input, ctx }) => {
    const { data, error } = await rpcJson(ctx.supabase, 'undo_import', {
      p_batch_id: input.batchId,
    });

    if (error) {
      return { ok: false as const, error: { code: 'undo_failed', message: error.message } };
    }

    revalidateImport(input.spaceId);
    return { ok: true as const, data: { undone: (data as { undone?: number }).undone ?? 0 } };
  });

export const createCategorizationRuleAction = authedAction()
  .schema(createRuleSchema)
  .space(({ input }) => input.spaceId, { action: 'categories.create' })
  .action(async ({ input, ctx }) => {
    const { data, error } = await untyped(ctx.supabase)
      .from<{ id: string }>('categorization_rules')
      .insert({
        space_id: input.spaceId,
        match_type: input.matchType,
        pattern: input.pattern,
        field: input.field,
        category_id: input.categoryId,
        set_merchant: input.setMerchant ?? null,
        priority: input.priority,
        auto_learned: input.autoLearned,
      })
      .select('id')
      .single();

    if (error || !data) {
      return {
        ok: false as const,
        error: { code: 'rule_create_failed', message: error?.message ?? 'failed' },
      };
    }

    revalidateImport(input.spaceId);
    return { ok: true as const, data: { id: data.id } };
  });

export const updateCategorizationRuleAction = authedAction()
  .schema(updateRuleSchema)
  .space(({ input }) => input.spaceId, { action: 'categories.update' })
  .action(async ({ input, ctx }) => {
    const { error } = await untyped(ctx.supabase)
      .from('categorization_rules')
      .update({
        match_type: input.matchType,
        pattern: input.pattern,
        field: input.field,
        category_id: input.categoryId,
        set_merchant: input.setMerchant ?? null,
        priority: input.priority,
      })
      .eq('id', input.ruleId)
      .eq('space_id', input.spaceId);

    if (error) {
      return { ok: false as const, error: { code: 'rule_update_failed', message: error.message } };
    }

    revalidateImport(input.spaceId);
    return { ok: true as const, data: { id: input.ruleId } };
  });

export const deleteCategorizationRuleAction = authedAction()
  .schema(deleteRuleSchema)
  .space(({ input }) => input.spaceId, { action: 'categories.delete' })
  .action(async ({ input, ctx }) => {
    const { error } = await untyped(ctx.supabase)
      .from('categorization_rules')
      .delete()
      .eq('id', input.ruleId)
      .eq('space_id', input.spaceId);

    if (error) {
      return { ok: false as const, error: { code: 'rule_delete_failed', message: error.message } };
    }

    revalidateImport(input.spaceId);
    return { ok: true as const, data: { id: input.ruleId } };
  });

export const reorderCategorizationRulesAction = authedAction()
  .schema(reorderRulesSchema)
  .space(({ input }) => input.spaceId, { action: 'categories.update' })
  .action(async ({ input, ctx }) => {
    for (let i = 0; i < input.ruleIds.length; i++) {
      const ruleId = input.ruleIds[i];
      if (!ruleId) continue;
      await untyped(ctx.supabase)
        .from('categorization_rules')
        .update({ priority: i })
        .eq('id', ruleId)
        .eq('space_id', input.spaceId);
    }
    revalidateImport(input.spaceId);
    return { ok: true as const, data: { count: input.ruleIds.length } };
  });

export const testCategorizationRuleAction = authedAction()
  .schema(testRuleSchema)
  .space(({ input }) => input.spaceId, { action: 'categories.create' })
  .action(async ({ input, ctx }) => {
    const { data: rule } = await untyped(ctx.supabase)
      .from<{ match_type: string; pattern: string; field: string }>('categorization_rules')
      .select('match_type, pattern, field')
      .eq('id', input.ruleId)
      .eq('space_id', input.spaceId)
      .single();

    if (!rule) {
      return { ok: false as const, error: { code: 'not_found', message: 'Rule not found' } };
    }

    const page = await listTransactions({ spaceId: input.spaceId, filters: {}, limit: 500 });
    const matches = page.rows.filter((tx) => {
      const hay =
        rule.field === 'merchant'
          ? (tx.merchant ?? '')
          : rule.field === 'notes'
            ? (tx.notes ?? '')
            : tx.description;
      const lower = hay.toLowerCase();
      if (rule.match_type === 'contains') return lower.includes(rule.pattern.toLowerCase());
      if (rule.match_type === 'starts_with') return lower.startsWith(rule.pattern.toLowerCase());
      if (rule.match_type === 'exact') return lower === rule.pattern.toLowerCase();
      try {
        return new RegExp(rule.pattern, 'i').test(hay);
      } catch {
        return false;
      }
    });

    return {
      ok: true as const,
      data: {
        count: matches.length,
        sample: matches.slice(0, input.limit).map((tx) => ({
          id: tx.id,
          description: tx.description,
          merchant: tx.merchant,
          bookedOn: tx.booked_on,
          amountMinor: tx.amount_minor,
        })),
      },
    };
  });

export const applyCategorizationRuleAction = authedAction()
  .schema(applyRuleSchema)
  .space(({ input }) => input.spaceId, { action: 'categories.update' })
  .action(async ({ input, ctx }) => {
    const { data, error } = await rpcJson(ctx.supabase, 'apply_rule_to_ledger', {
      p_rule_id: input.ruleId,
    });

    if (error) {
      return { ok: false as const, error: { code: 'apply_failed', message: error.message } };
    }

    revalidateImport(input.spaceId);
    return { ok: true as const, data: { updated: typeof data === 'number' ? data : 0 } };
  });

export const exportLedgerAction = authedAction()
  .schema(exportLedgerSchema)
  .space(({ input }) => input.spaceId, { action: 'space.read' })
  .action(async ({ input }) => {
    const page = await listTransactions({ spaceId: input.spaceId, filters: {}, limit: 10_000 });
    const buffer =
      input.format === 'csv' ? exportLedgerCsv(page.rows) : exportLedgerXlsx(page.rows);
    return {
      ok: true as const,
      data: {
        fileName: `ledger-${input.spaceId.slice(0, 8)}.${input.format}`,
        base64: Buffer.from(buffer).toString('base64'),
        mimeType:
          input.format === 'csv'
            ? 'text/csv'
            : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      },
    };
  });

export const exportSpaceAction = authedAction()
  .schema(exportSpaceSchema)
  .space(({ input }) => input.spaceId, { action: 'space.read' })
  .action(async ({ input, ctx }) => {
    const payload = await buildSpaceExport(ctx.supabase, input.spaceId);
    return {
      ok: true as const,
      data: {
        fileName: `nido-export-${input.spaceId.slice(0, 8)}.json`,
        json: JSON.stringify(payload, null, 2),
      },
    };
  });

export const importSpaceJsonAction = authedAction()
  .schema(importSpaceJsonSchema)
  .space(({ input }) => input.spaceId, { action: 'transactions.create' })
  .action(async ({ input, ctx }) => {
    const result = await parseSpaceImportPayload(
      ctx.supabase,
      input.spaceId,
      input.fileData,
      ctx.userId,
      ctx.participantId,
    );
    if (!result.ok) {
      return { ok: false as const, error: result.error };
    }
    revalidateImport(input.spaceId);
    return { ok: true as const, data: result.data };
  });
