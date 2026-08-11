/**
 * The single source of validation for the ledger. `transactionSchema` is shared by the
 * transaction form, the Server Actions, and (later) the AI tools, so the shape can never
 * drift between the client and the server. See docs/04-FEATURES.md § 2.
 *
 * Money crosses the wire as integer minor units (`amountMinor`, `owedMinor`), never a float,
 * bounded by `Number.MAX_SAFE_INTEGER` so JSON round-trips are exact.
 */

import { z } from 'zod';

export const transactionKindSchema = z.enum(['expense', 'income', 'transfer']);
export const splitModeSchema = z.enum(['personal', 'equal', 'shares', 'percent', 'exact']);

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected an ISO date (YYYY-MM-DD)');

const minorUnits = z.number().int().max(Number.MAX_SAFE_INTEGER);

export const splitParticipantSchema = z.object({
  participantId: z.uuid(),
  weight: z.number().nonnegative().optional(),
  owedMinor: minorUnits.nonnegative().optional(),
});

export type SplitParticipantInput = z.infer<typeof splitParticipantSchema>;

const transactionFields = {
  spaceId: z.uuid(),
  requestId: z.uuid(),
  kind: transactionKindSchema,
  amountMinor: minorUnits.positive(),
  currency: z.string().length(3).optional(),
  bookedOn: isoDate,
  occurredAt: z.iso.datetime().nullish(),
  description: z.string().trim().max(200).optional(),
  merchant: z.string().trim().max(120).nullish(),
  notes: z.string().trim().max(2000).nullish(),
  categoryId: z.uuid().nullish(),
  accountId: z.uuid().nullish(),
  toAccountId: z.uuid().nullish(),
  payerParticipantId: z.uuid().nullish(),
  splitMode: splitModeSchema.default('personal'),
  participants: z.array(splitParticipantSchema).default([]),
  tagIds: z.array(z.uuid()).default([]),
  isPending: z.boolean().optional(),
  baseRate: z.number().positive().optional(),
  baseRateManual: z.boolean().optional(),
} as const;

function refineShape(
  value: {
    kind: z.infer<typeof transactionKindSchema>;
    accountId?: string | null | undefined;
    toAccountId?: string | null | undefined;
    payerParticipantId?: string | null | undefined;
    participants: SplitParticipantInput[];
  },
  ctx: z.RefinementCtx,
): void {
  if (value.kind === 'transfer') {
    if (!value.accountId) {
      ctx.addIssue({
        code: 'custom',
        path: ['accountId'],
        message: 'Transfers require a source account.',
      });
    }
    if (!value.toAccountId) {
      ctx.addIssue({
        code: 'custom',
        path: ['toAccountId'],
        message: 'Transfers require a destination account.',
      });
    }
    if (value.accountId && value.toAccountId && value.accountId === value.toAccountId) {
      ctx.addIssue({
        code: 'custom',
        path: ['toAccountId'],
        message: 'The destination account must differ from the source.',
      });
    }
    return;
  }

  if (!value.payerParticipantId) {
    ctx.addIssue({
      code: 'custom',
      path: ['payerParticipantId'],
      message: 'Choose who paid.',
    });
  }
  if (value.participants.length < 1) {
    ctx.addIssue({
      code: 'custom',
      path: ['participants'],
      message: 'Add at least one participant.',
    });
  }
}

export const createTransactionSchema = z.object(transactionFields).superRefine(refineShape);

export const updateTransactionSchema = z
  .object({ ...transactionFields, transactionId: z.uuid() })
  .superRefine(refineShape);

export const duplicateTransactionSchema = z.object({
  spaceId: z.uuid(),
  requestId: z.uuid(),
  transactionId: z.uuid(),
});

export const deleteTransactionSchema = z.object({
  spaceId: z.uuid(),
  requestId: z.uuid(),
  transactionId: z.uuid(),
});

export const restoreTransactionSchema = deleteTransactionSchema;

export const bulkUpdateCategorySchema = z.object({
  spaceId: z.uuid(),
  transactionIds: z.array(z.uuid()).min(1).max(500),
  categoryId: z.uuid().nullable(),
});

export const bulkDeleteSchema = z.object({
  spaceId: z.uuid(),
  transactionIds: z.array(z.uuid()).min(1).max(500),
});

export const transactionFiltersSchema = z.object({
  kind: transactionKindSchema.optional(),
  search: z.string().trim().max(200).optional(),
  dateFrom: isoDate.optional(),
  dateTo: isoDate.optional(),
  categoryIds: z.array(z.uuid()).optional(),
  participantIds: z.array(z.uuid()).optional(),
  accountIds: z.array(z.uuid()).optional(),
  tagIds: z.array(z.uuid()).optional(),
  amountMin: minorUnits.nonnegative().optional(),
  amountMax: minorUnits.nonnegative().optional(),
  sharedOnly: z.boolean().optional(),
  mineOnly: z.boolean().optional(),
  /**
   * Attachment rows land in Phase 07. Until then this filter is wired in the URL and
   * query layer so shares/bookmarks keep working; matches are empty by design.
   */
  hasAttachment: z.boolean().optional(),
  /** Resolved from the signed-in member; not stored in the URL. */
  viewerParticipantId: z.uuid().optional(),
});

export const listTransactionsSchema = z.object({
  spaceId: z.uuid(),
  filters: transactionFiltersSchema.default({}),
  cursor: z.object({ bookedOn: isoDate, id: z.uuid() }).nullish(),
  limit: z.number().int().min(1).max(100).default(50),
});

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>;
export type TransactionFilters = z.infer<typeof transactionFiltersSchema>;
export type ListTransactionsInput = z.infer<typeof listTransactionsSchema>;
export type TransactionCursor = { bookedOn: string; id: string };
