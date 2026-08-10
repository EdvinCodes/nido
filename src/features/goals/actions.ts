'use server';

import { revalidatePath } from 'next/cache';
import { authedAction } from '@/lib/auth/authed-action';
import { invalidateDashboardCache } from '@/features/dashboard/cache';
import { invalidateGoalsCache } from './cache';
import {
  contributeGoalSchema,
  createGoalSchema,
  deleteGoalSchema,
  updateGoalSchema,
} from './schemas';

function revalidateGoals(spaceId: string, goalId?: string): void {
  revalidatePath(`/s/${spaceId}`);
  revalidatePath(`/s/${spaceId}/goals`);
  if (goalId) revalidatePath(`/s/${spaceId}/goals/${goalId}`);
  invalidateGoalsCache(spaceId);
  invalidateDashboardCache(spaceId);
}

export const createGoal = authedAction()
  .schema(createGoalSchema)
  .space(({ input }) => input.spaceId)
  .action(async ({ input, ctx }) => {
    const { data, error } = await ctx.supabase
      .from('goals')
      .insert({
        space_id: input.spaceId,
        name: input.name,
        description: input.description ?? null,
        target_minor: input.targetMinor,
        currency: input.currency,
        target_date: input.targetDate ?? null,
        account_id: input.accountId ?? null,
        color: input.color,
        icon: input.icon,
        created_by: ctx.userId,
      })
      .select('id')
      .single();

    if (error) {
      return {
        ok: false as const,
        error: { code: 'goal_create_failed', message: error.message },
      };
    }

    revalidateGoals(input.spaceId, data.id);
    return { ok: true as const, data: { id: data.id } };
  });

export const updateGoal = authedAction()
  .schema(updateGoalSchema)
  .space(({ input }) => input.spaceId)
  .action(async ({ input, ctx }) => {
    const { error } = await ctx.supabase
      .from('goals')
      .update({
        name: input.name,
        description: input.description ?? null,
        target_minor: input.targetMinor,
        currency: input.currency,
        target_date: input.targetDate ?? null,
        account_id: input.accountId ?? null,
        color: input.color,
        icon: input.icon,
        ...(input.status ? { status: input.status } : {}),
      })
      .eq('id', input.goalId)
      .eq('space_id', input.spaceId);

    if (error) {
      return {
        ok: false as const,
        error: { code: 'goal_update_failed', message: error.message },
      };
    }

    revalidateGoals(input.spaceId, input.goalId);
    return { ok: true as const, data: { updated: true as const } };
  });

export const archiveGoal = authedAction()
  .schema(deleteGoalSchema)
  .space(({ input }) => input.spaceId)
  .action(async ({ input, ctx }) => {
    const { error } = await ctx.supabase
      .from('goals')
      .update({ status: 'archived' })
      .eq('id', input.goalId)
      .eq('space_id', input.spaceId);

    if (error) {
      return {
        ok: false as const,
        error: { code: 'goal_archive_failed', message: error.message },
      };
    }

    revalidateGoals(input.spaceId, input.goalId);
    return { ok: true as const, data: { archived: true as const } };
  });

export const contributeToGoal = authedAction()
  .schema(contributeGoalSchema)
  .space(({ input }) => input.spaceId)
  .action(async ({ input, ctx }) => {
    let transactionId: string | null = null;

    if (input.asTransfer && input.fromAccountId && input.toAccountId) {
      const { data: tx, error: txError } = await ctx.supabase.rpc('create_transaction', {
        p: {
          space_id: input.spaceId,
          kind: 'transfer',
          booked_on: input.contributedOn,
          amount_minor: Math.abs(input.amountMinor),
          account_id: input.fromAccountId,
          to_account_id: input.toAccountId,
          description: 'Goal contribution',
          goal_id: input.goalId,
        },
      });

      if (txError) {
        return {
          ok: false as const,
          error: { code: 'goal_transfer_failed', message: txError.message },
        };
      }

      const id =
        tx && typeof tx === 'object' && 'id' in tx && typeof tx.id === 'string' ? tx.id : null;
      transactionId = id;
    }

    const { error } = await ctx.supabase.from('goal_contributions').insert({
      goal_id: input.goalId,
      space_id: input.spaceId,
      participant_id: input.participantId,
      amount_minor: input.amountMinor,
      contributed_on: input.contributedOn,
      note: input.note ?? null,
      transaction_id: transactionId,
    });

    if (error) {
      return {
        ok: false as const,
        error: { code: 'goal_contribute_failed', message: error.message },
      };
    }

    revalidateGoals(input.spaceId, input.goalId);
    return { ok: true as const, data: { contributed: true as const } };
  });
