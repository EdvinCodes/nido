'use server';

import { revalidatePath } from 'next/cache';
import { authedAction } from '@/lib/auth/authed-action';
import { invalidateDashboardCache } from '@/features/dashboard/cache';
import { invalidateSubscriptionsCache } from './cache';
import {
  acceptCandidateSchema,
  cancelRuleSchema,
  createRuleSchema,
  ghostAnswerSchema,
  updateRuleSchema,
} from './schemas';

function revalidateSubs(spaceId: string, ruleId?: string): void {
  revalidatePath(`/s/${spaceId}`);
  revalidatePath(`/s/${spaceId}/subscriptions`);
  if (ruleId) revalidatePath(`/s/${spaceId}/subscriptions/${ruleId}`);
  invalidateSubscriptionsCache(spaceId);
  invalidateDashboardCache(spaceId);
}

function toSplitConfig(
  splitConfig: Array<{
    participantId: string;
    weight?: number | undefined;
    owedMinor?: number | undefined;
  }>,
) {
  return splitConfig.map((s) => {
    const row: Record<string, string | number> = { participant_id: s.participantId };
    if (s.weight !== undefined) row.weight = s.weight;
    if (s.owedMinor !== undefined) row.owed_minor = s.owedMinor;
    return row;
  });
}

export const createSubscription = authedAction()
  .schema(createRuleSchema)
  .space(({ input }) => input.spaceId)
  .action(async ({ input, ctx }) => {
    const { data, error } = await ctx.supabase
      .from('recurring_rules')
      .insert({
        space_id: input.spaceId,
        kind: input.kind,
        name: input.name,
        merchant: input.merchant ?? null,
        amount_minor: input.amountMinor,
        currency: input.currency,
        category_id: input.categoryId ?? null,
        account_id: input.accountId ?? null,
        payer_participant_id: input.payerParticipantId ?? null,
        split_mode: input.splitMode,
        split_config: toSplitConfig(input.splitConfig),
        freq: input.freq,
        interval_count: input.intervalCount,
        by_month_day: input.byMonthDay ?? null,
        by_weekday: input.byWeekday ?? null,
        starts_on: input.startsOn,
        next_run_on: input.nextRunOn,
        auto_create: input.autoCreate,
        reminder_days_before: input.reminderDaysBefore,
        created_by: ctx.userId,
      })
      .select('id')
      .single();

    if (error) {
      return {
        ok: false as const,
        error: { code: 'rule_create_failed', message: error.message },
      };
    }

    revalidateSubs(input.spaceId, data.id);
    return { ok: true as const, data: { id: data.id } };
  });

export const updateSubscription = authedAction()
  .schema(updateRuleSchema)
  .space(({ input }) => input.spaceId)
  .action(async ({ input, ctx }) => {
    const { error } = await ctx.supabase
      .from('recurring_rules')
      .update({
        kind: input.kind,
        name: input.name,
        merchant: input.merchant ?? null,
        amount_minor: input.amountMinor,
        category_id: input.categoryId ?? null,
        account_id: input.accountId ?? null,
        payer_participant_id: input.payerParticipantId ?? null,
        split_mode: input.splitMode,
        split_config: toSplitConfig(input.splitConfig),
        freq: input.freq,
        interval_count: input.intervalCount,
        by_month_day: input.byMonthDay ?? null,
        by_weekday: input.byWeekday ?? null,
        starts_on: input.startsOn,
        next_run_on: input.nextRunOn,
        auto_create: input.autoCreate,
        reminder_days_before: input.reminderDaysBefore,
        cancel_url: input.cancelUrl || null,
        ...(input.isActive !== undefined ? { is_active: input.isActive } : {}),
      })
      .eq('id', input.ruleId)
      .eq('space_id', input.spaceId);

    if (error) {
      return {
        ok: false as const,
        error: { code: 'rule_update_failed', message: error.message },
      };
    }

    revalidateSubs(input.spaceId, input.ruleId);
    return { ok: true as const, data: { updated: true as const } };
  });

export const cancelSubscription = authedAction()
  .schema(cancelRuleSchema)
  .space(({ input }) => input.spaceId)
  .action(async ({ input, ctx }) => {
    const { error } = await ctx.supabase
      .from('recurring_rules')
      .update({
        is_active: false,
        cancelled_at: new Date().toISOString(),
        cancel_url: input.cancelUrl || null,
      })
      .eq('id', input.ruleId)
      .eq('space_id', input.spaceId);

    if (error) {
      return {
        ok: false as const,
        error: { code: 'rule_cancel_failed', message: error.message },
      };
    }

    revalidateSubs(input.spaceId, input.ruleId);
    return { ok: true as const, data: { cancelled: true as const } };
  });

export const answerGhost = authedAction()
  .schema(ghostAnswerSchema)
  .space(({ input }) => input.spaceId)
  .action(async ({ input, ctx }) => {
    const today = new Date();
    if (input.answer === 'yes') {
      const until = new Date(today);
      until.setMonth(until.getMonth() + 6);
      const { error } = await ctx.supabase
        .from('recurring_rules')
        .update({
          marked_in_use_at: new Date().toISOString(),
          ghost_snoozed_until: until.toISOString().slice(0, 10),
        })
        .eq('id', input.ruleId)
        .eq('space_id', input.spaceId);
      if (error) {
        return { ok: false as const, error: { code: 'ghost_failed', message: error.message } };
      }
    } else if (input.answer === 'unsure') {
      const until = new Date(today);
      until.setMonth(until.getMonth() + 1);
      const { error } = await ctx.supabase
        .from('recurring_rules')
        .update({ ghost_snoozed_until: until.toISOString().slice(0, 10) })
        .eq('id', input.ruleId)
        .eq('space_id', input.spaceId);
      if (error) {
        return { ok: false as const, error: { code: 'ghost_failed', message: error.message } };
      }
    } else {
      const { error } = await ctx.supabase
        .from('recurring_rules')
        .update({
          is_active: false,
          cancelled_at: new Date().toISOString(),
          cancel_url: input.cancelUrl || null,
        })
        .eq('id', input.ruleId)
        .eq('space_id', input.spaceId);
      if (error) {
        return { ok: false as const, error: { code: 'ghost_failed', message: error.message } };
      }
    }

    revalidateSubs(input.spaceId, input.ruleId);
    return { ok: true as const, data: { answered: true as const } };
  });

export const acceptCandidate = authedAction()
  .schema(acceptCandidateSchema)
  .space(({ input }) => input.spaceId)
  .action(async ({ input, ctx }) => {
    const splitConfig =
      input.payerParticipantId && input.splitMode === 'personal'
        ? [{ participant_id: input.payerParticipantId }]
        : [];

    const { data, error } = await ctx.supabase
      .from('recurring_rules')
      .insert({
        space_id: input.spaceId,
        kind: 'subscription',
        name: input.merchant,
        merchant: input.merchant,
        amount_minor: input.amountMinor,
        currency: input.currency,
        category_id: input.categoryId ?? null,
        account_id: input.accountId ?? null,
        payer_participant_id: input.payerParticipantId ?? null,
        split_mode: input.splitMode,
        split_config: splitConfig,
        freq: input.freq,
        interval_count: input.intervalCount,
        starts_on: input.startsOn,
        next_run_on: input.nextRunOn,
        created_by: ctx.userId,
      })
      .select('id')
      .single();

    if (error) {
      return {
        ok: false as const,
        error: { code: 'candidate_accept_failed', message: error.message },
      };
    }

    if (input.transactionIds.length > 0) {
      await ctx.supabase
        .from('transactions')
        .update({ recurring_rule_id: data.id })
        .in('id', input.transactionIds)
        .eq('space_id', input.spaceId);
    }

    revalidateSubs(input.spaceId, data.id);
    return { ok: true as const, data: { id: data.id } };
  });
