'use server';

import { revalidatePath } from 'next/cache';
import { authedAction } from '@/lib/auth/authed-action';
import { exportLedgerCsv } from '@/features/imports/lib/export-ledger';
import { listTransactions } from '@/features/transactions/queries';
import { generateLiveSnapshot } from './queries';
import { comparePeriodsSchema, exportReportSchema, updateBaseCurrencySchema } from './schemas';
import { buildReportPdf } from './lib/export-pdf';
import { buildReportXlsx } from './lib/export-xlsx';

export const exportReportAction = authedAction()
  .schema(exportReportSchema)
  .space(({ input }) => input.spaceId, { action: 'space.read' })
  .action(async ({ input }) => {
    const payload = await generateLiveSnapshot(input.spaceId, input.from, input.to);

    if (input.format === 'pdf') {
      const bytes = await buildReportPdf(payload);
      return {
        ok: true as const,
        data: {
          filename: `report-${input.from}-${input.to}.pdf`,
          mimeType: 'application/pdf',
          base64: Buffer.from(bytes).toString('base64'),
        },
      };
    }

    if (input.format === 'xlsx') {
      const bytes = buildReportXlsx(payload);
      return {
        ok: true as const,
        data: {
          filename: `report-${input.from}-${input.to}.xlsx`,
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          base64: Buffer.from(bytes).toString('base64'),
        },
      };
    }

    const { rows } = await listTransactions({
      spaceId: input.spaceId,
      filters: { dateFrom: input.from, dateTo: input.to },
      limit: 500,
    });
    const bytes = exportLedgerCsv(rows);
    return {
      ok: true as const,
      data: {
        filename: `ledger-${input.from}-${input.to}.csv`,
        mimeType: 'text/csv',
        base64: Buffer.from(bytes).toString('base64'),
      },
    };
  });

export const updateBaseCurrencyAction = authedAction()
  .schema(updateBaseCurrencySchema)
  .space(({ input }) => input.spaceId, { action: 'space.update' })
  .action(async ({ input, ctx }) => {
    const { error } = await ctx.supabase.schema('nido').rpc('update_space_base_currency', {
      p_space_id: input.spaceId,
      p_base_currency: input.baseCurrency,
    });
    if (error) {
      return {
        ok: false as const,
        error: { code: 'base_currency_update_failed', message: error.message },
      };
    }
    revalidatePath(`/s/${input.spaceId}`);
    revalidatePath(`/s/${input.spaceId}/reports`);
    return { ok: true as const, data: { updated: true as const } };
  });

export const comparePeriodsAction = authedAction()
  .schema(comparePeriodsSchema)
  .space(({ input }) => input.spaceId, { action: 'space.read' })
  .action(async ({ input }) => {
    const [left, right] = await Promise.all([
      generateLiveSnapshot(input.spaceId, input.leftFrom, input.leftTo),
      generateLiveSnapshot(input.spaceId, input.rightFrom, input.rightTo),
    ]);
    return { ok: true as const, data: { left, right } };
  });
