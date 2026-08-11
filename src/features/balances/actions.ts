'use server';

import { revalidatePath } from 'next/cache';
import { authedAction } from '@/lib/auth/authed-action';
import { invalidateDashboardCache } from '@/features/dashboard/cache';
import { invalidateBalancesCache } from './cache';
import {
  balanceBreakdownSchema,
  confirmSettlementSchema,
  disputeSettlementSchema,
  proposeSettlementSchema,
  reverseSettlementSchema,
  spaceIdSchema,
} from './schemas';
import { getBalanceBreakdown, getBalancesPageModel } from './queries';

function revalidateBalances(spaceId: string): void {
  revalidatePath(`/s/${spaceId}`);
  revalidatePath(`/s/${spaceId}/balances`);
  invalidateBalancesCache(spaceId);
  invalidateDashboardCache(spaceId);
}

export const proposeSettlement = authedAction()
  .schema(proposeSettlementSchema)
  .space(({ input }) => input.spaceId)
  .action(async ({ input, ctx }) => {
    const { data, error } = await ctx.supabase.rpc('propose_settlement', {
      p: {
        space_id: input.spaceId,
        from_participant_id: input.fromParticipantId,
        to_participant_id: input.toParticipantId,
        amount_minor: input.amountMinor,
        currency: input.currency,
        method: input.method ?? null,
        note: input.note ?? null,
        settled_on: input.settledOn ?? null,
      },
    });

    if (error) {
      return {
        ok: false as const,
        error: { code: 'settlement_propose_failed', message: error.message },
      };
    }

    revalidateBalances(input.spaceId);
    const payload = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
    return {
      ok: true as const,
      data: {
        id: typeof payload.id === 'string' ? payload.id : '',
        confirmed: Boolean(payload.confirmed),
      },
    };
  });

export const confirmSettlement = authedAction()
  .schema(confirmSettlementSchema)
  .space(({ input }) => input.spaceId)
  .action(async ({ input, ctx }) => {
    const { error } = await ctx.supabase.rpc('confirm_settlement', {
      p_id: input.settlementId,
      ...(input.amountMinor !== undefined ? { p_amount_minor: input.amountMinor } : {}),
    });
    if (error) {
      return {
        ok: false as const,
        error: { code: 'settlement_confirm_failed', message: error.message },
      };
    }
    revalidateBalances(input.spaceId);
    return { ok: true as const, data: { confirmed: true as const } };
  });

export const disputeSettlement = authedAction()
  .schema(disputeSettlementSchema)
  .space(({ input }) => input.spaceId)
  .action(async ({ input, ctx }) => {
    const { error } = await ctx.supabase.rpc('dispute_settlement', {
      p_id: input.settlementId,
      p_note: input.note,
    });
    if (error) {
      return {
        ok: false as const,
        error: { code: 'settlement_dispute_failed', message: error.message },
      };
    }
    revalidateBalances(input.spaceId);
    return { ok: true as const, data: { disputed: true as const } };
  });

export const reverseSettlement = authedAction()
  .schema(reverseSettlementSchema)
  .space(({ input }) => input.spaceId)
  .action(async ({ input, ctx }) => {
    const { data, error } = await ctx.supabase.rpc('reverse_settlement', {
      p_id: input.settlementId,
    });
    if (error) {
      return {
        ok: false as const,
        error: { code: 'settlement_reverse_failed', message: error.message },
      };
    }
    revalidateBalances(input.spaceId);
    const payload = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
    return {
      ok: true as const,
      data: {
        reversalId: typeof payload.reversal_id === 'string' ? payload.reversal_id : '',
      },
    };
  });

export const fetchBalanceBreakdown = authedAction()
  .schema(balanceBreakdownSchema)
  .space(({ input }) => input.spaceId)
  .action(async ({ input }) => {
    try {
      const rows = await getBalanceBreakdown({
        spaceId: input.spaceId,
        participantId: input.participantId,
        ...(input.from != null ? { from: input.from } : {}),
        ...(input.to != null ? { to: input.to } : {}),
      });
      return { ok: true as const, data: { rows } };
    } catch (error) {
      return {
        ok: false as const,
        error: {
          code: 'breakdown_failed',
          message: error instanceof Error ? error.message : 'Failed to load breakdown',
        },
      };
    }
  });

export const refreshBalancesModel = authedAction()
  .schema(spaceIdSchema)
  .space(({ input }) => input.spaceId)
  .action(async ({ input, ctx }) => {
    try {
      const model = await getBalancesPageModel(input.spaceId, ctx.userId);
      return { ok: true as const, data: { model } };
    } catch (error) {
      return {
        ok: false as const,
        error: {
          code: 'balances_refresh_failed',
          message: error instanceof Error ? error.message : 'Failed to refresh balances',
        },
      };
    }
  });
