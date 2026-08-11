'use server';

import { revalidatePath } from 'next/cache';
import { randomUUID } from 'node:crypto';
import { invalidateBudgetsCache } from '@/features/budgets/cache';
import { invalidateDashboardCache } from '@/features/dashboard/cache';
import { authedAction } from '@/lib/auth/authed-action';
import { rpcJson, untyped } from './db';
import { listTransactions } from './queries';
import {
  bulkDeleteSchema,
  bulkUpdateCategorySchema,
  createTransactionSchema,
  deleteTransactionSchema,
  duplicateTransactionSchema,
  listTransactionsSchema,
  restoreTransactionSchema,
  updateTransactionSchema,
  type CreateTransactionInput,
  type UpdateTransactionInput,
} from './schemas';
import type { TransactionRpcPayload, TransactionView } from './types';

function toRpcPayload(
  input: CreateTransactionInput | UpdateTransactionInput,
): TransactionRpcPayload {
  const isTransfer = input.kind === 'transfer';
  const participants: TransactionRpcPayload['participants'] = isTransfer
    ? []
    : input.participants.map((p) => {
        const row: NonNullable<TransactionRpcPayload['participants']>[number] = {
          participant_id: p.participantId,
        };
        if (p.weight !== undefined) row.weight = p.weight;
        if (p.owedMinor !== undefined) row.owed_minor = p.owedMinor;
        return row;
      });

  const payload: TransactionRpcPayload = {
    request_id: input.requestId,
    space_id: input.spaceId,
    kind: input.kind,
    booked_on: input.bookedOn,
    amount_minor: input.amountMinor,
    split_mode: isTransfer ? 'personal' : input.splitMode,
    description: input.description ?? '',
    merchant: input.merchant ?? null,
    notes: input.notes ?? null,
    category_id: isTransfer ? null : (input.categoryId ?? null),
    account_id: input.accountId ?? null,
    to_account_id: isTransfer ? (input.toAccountId ?? null) : null,
    payer_participant_id: isTransfer ? null : (input.payerParticipantId ?? null),
    participants,
    tag_ids: input.tagIds,
    occurred_at: input.occurredAt ?? null,
  };
  if (input.currency !== undefined) payload.currency = input.currency;
  if (input.isPending !== undefined) payload.is_pending = input.isPending;
  if (input.baseRateManual) {
    payload.base_rate_manual = true;
    if (input.baseRate !== undefined) payload.base_rate = input.baseRate;
  }
  return payload;
}

function revalidateLedger(spaceId: string): void {
  revalidatePath(`/s/${spaceId}`);
  revalidatePath(`/s/${spaceId}/ledger`);
  revalidatePath(`/s/${spaceId}/budgets`);
  invalidateDashboardCache(spaceId);
  invalidateBudgetsCache(spaceId);
}

export const createTransaction = authedAction()
  .schema(createTransactionSchema)
  .space(({ input }) => input.spaceId, { action: 'transactions.create' })
  .action(async ({ input, ctx }) => {
    const { data, error } = await rpcJson(ctx.supabase, 'create_transaction', {
      p: toRpcPayload(input),
    });
    if (error) {
      return {
        ok: false as const,
        error: { code: 'transaction_create_failed', message: error.message },
      };
    }
    revalidateLedger(input.spaceId);
    const id =
      data && typeof data === 'object' && 'id' in data && typeof data.id === 'string'
        ? data.id
        : '';
    return { ok: true as const, data: { id } };
  });

export const updateTransaction = authedAction()
  .schema(updateTransactionSchema)
  .space(({ input }) => input.spaceId, { action: 'transactions.update' })
  .action(async ({ input, ctx }) => {
    const { error } = await rpcJson(ctx.supabase, 'update_transaction', {
      p_id: input.transactionId,
      p: toRpcPayload(input),
    });
    if (error) {
      return {
        ok: false as const,
        error: { code: 'transaction_update_failed', message: error.message },
      };
    }
    revalidateLedger(input.spaceId);
    return { ok: true as const, data: { id: input.transactionId } };
  });

export const deleteTransaction = authedAction()
  .schema(deleteTransactionSchema)
  .space(({ input }) => input.spaceId, { action: 'transactions.delete' })
  .action(async ({ input, ctx }) => {
    const { error } = await rpcJson(ctx.supabase, 'delete_transaction', {
      p_id: input.transactionId,
      p_request_id: input.requestId,
    });
    if (error) {
      return {
        ok: false as const,
        error: { code: 'transaction_delete_failed', message: error.message },
      };
    }
    revalidateLedger(input.spaceId);
    return { ok: true as const, data: { id: input.transactionId } };
  });

export const restoreTransaction = authedAction()
  .schema(restoreTransactionSchema)
  .space(({ input }) => input.spaceId, { action: 'transactions.update' })
  .action(async ({ input, ctx }) => {
    const { error } = await rpcJson(ctx.supabase, 'restore_transaction', {
      p_id: input.transactionId,
      p_request_id: input.requestId,
    });
    if (error) {
      return {
        ok: false as const,
        error: { code: 'transaction_restore_failed', message: error.message },
      };
    }
    revalidateLedger(input.spaceId);
    return { ok: true as const, data: { id: input.transactionId } };
  });

export const duplicateTransaction = authedAction()
  .schema(duplicateTransactionSchema)
  .space(({ input }) => input.spaceId, { action: 'transactions.create' })
  .action(async ({ input, ctx }) => {
    const { data: source, error: readError } = await untyped(ctx.supabase)
      .from<TransactionView>('v_transactions')
      .select('*')
      .eq('id', input.transactionId)
      .eq('space_id', input.spaceId)
      .maybeSingle();

    if (readError) {
      return {
        ok: false as const,
        error: { code: 'transaction_read_failed', message: readError.message },
      };
    }
    if (!source) {
      return {
        ok: false as const,
        error: { code: 'not_found', message: 'Transaction not found.' },
      };
    }

    const payload: TransactionRpcPayload = {
      request_id: input.requestId,
      space_id: source.space_id,
      kind: source.kind,
      booked_on: source.booked_on,
      amount_minor: source.amount_minor,
      currency: source.currency,
      split_mode: source.split_mode,
      description: source.description,
      merchant: source.merchant,
      notes: source.notes,
      category_id: source.category_id,
      account_id: source.account_id,
      to_account_id: source.to_account_id,
      payer_participant_id: source.payer_participant_id,
      participants:
        source.kind === 'transfer'
          ? []
          : source.splits.map((s) => ({
              participant_id: s.participant_id,
              weight: s.weight,
              owed_minor: s.owed_minor,
            })),
      tag_ids: source.tags.map((t) => t.id),
    };

    const { data, error } = await rpcJson(ctx.supabase, 'create_transaction', {
      p: payload,
    });
    if (error) {
      return {
        ok: false as const,
        error: { code: 'transaction_duplicate_failed', message: error.message },
      };
    }
    revalidateLedger(input.spaceId);
    const id =
      data && typeof data === 'object' && 'id' in data && typeof data.id === 'string'
        ? data.id
        : '';
    return { ok: true as const, data: { id } };
  });

export const bulkUpdateCategory = authedAction()
  .schema(bulkUpdateCategorySchema)
  .space(({ input }) => input.spaceId, { action: 'transactions.update' })
  .action(async ({ input, ctx }) => {
    const { error } = await untyped(ctx.supabase)
      .from('transactions')
      .update({ category_id: input.categoryId })
      .eq('space_id', input.spaceId)
      .neq('kind', 'transfer')
      .in('id', input.transactionIds);
    if (error) {
      return {
        ok: false as const,
        error: { code: 'bulk_recategorize_failed', message: error.message },
      };
    }
    revalidateLedger(input.spaceId);
    return { ok: true as const, data: { updated: input.transactionIds.length } };
  });

export const bulkDelete = authedAction()
  .schema(bulkDeleteSchema)
  .space(({ input }) => input.spaceId, { action: 'transactions.delete' })
  .action(async ({ input, ctx }) => {
    for (const id of input.transactionIds) {
      const { error } = await rpcJson(ctx.supabase, 'delete_transaction', {
        p_id: id,
        p_request_id: randomUUID(),
      });
      if (error) {
        return {
          ok: false as const,
          error: { code: 'bulk_delete_failed', message: error.message },
        };
      }
    }
    revalidateLedger(input.spaceId);
    return { ok: true as const, data: { deleted: input.transactionIds.length } };
  });

export const fetchTransactionsPage = authedAction()
  .schema(listTransactionsSchema)
  .space(({ input }) => input.spaceId, { action: 'space.read' })
  .action(async ({ input }) => {
    const page = await listTransactions(input);
    return { ok: true as const, data: page };
  });
