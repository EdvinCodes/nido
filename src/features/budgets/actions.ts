'use server';

import { revalidatePath } from 'next/cache';
import { authedAction } from '@/lib/auth/authed-action';
import { invalidateDashboardCache } from '@/features/dashboard/cache';
import { invalidateBudgetsCache } from './cache';
import {
  acceptSuggestionsSchema,
  createBudgetSchema,
  deleteBudgetSchema,
  updateBudgetSchema,
} from './schemas';

function revalidateBudgets(spaceId: string): void {
  revalidatePath(`/s/${spaceId}`);
  revalidatePath(`/s/${spaceId}/budgets`);
  invalidateBudgetsCache(spaceId);
  invalidateDashboardCache(spaceId);
}

export const createBudget = authedAction()
  .schema(createBudgetSchema)
  .space(({ input }) => input.spaceId)
  .action(async ({ input, ctx }) => {
    const { data: space } = await ctx.supabase
      .from('spaces')
      .select('base_currency')
      .eq('id', input.spaceId)
      .maybeSingle();

    const { data, error } = await ctx.supabase
      .from('budgets')
      .insert({
        space_id: input.spaceId,
        name: input.name,
        scope: input.scope,
        category_id: input.categoryId ?? null,
        participant_id: input.participantId ?? null,
        period: input.period,
        limit_minor: input.limitMinor,
        currency: space?.base_currency ?? 'EUR',
        include_subcategories: input.includeSubcategories,
        rollover: input.rollover,
        starts_on: input.startsOn,
        ends_on: input.endsOn ?? null,
        alert_thresholds: input.alertThresholds,
        created_by: ctx.userId,
      })
      .select('id')
      .single();

    if (error) {
      return {
        ok: false as const,
        error: { code: 'budget_create_failed', message: error.message },
      };
    }

    revalidateBudgets(input.spaceId);
    return { ok: true as const, data: { id: data.id } };
  });

export const updateBudget = authedAction()
  .schema(updateBudgetSchema)
  .space(({ input }) => input.spaceId)
  .action(async ({ input, ctx }) => {
    const { error } = await ctx.supabase
      .from('budgets')
      .update({
        name: input.name,
        scope: input.scope,
        category_id: input.categoryId ?? null,
        participant_id: input.participantId ?? null,
        period: input.period,
        limit_minor: input.limitMinor,
        include_subcategories: input.includeSubcategories,
        rollover: input.rollover,
        starts_on: input.startsOn,
        ends_on: input.endsOn ?? null,
        alert_thresholds: input.alertThresholds,
        ...(input.isActive !== undefined ? { is_active: input.isActive } : {}),
      })
      .eq('id', input.budgetId)
      .eq('space_id', input.spaceId);

    if (error) {
      return {
        ok: false as const,
        error: { code: 'budget_update_failed', message: error.message },
      };
    }

    await ctx.supabase.rpc('ensure_budget_periods', {
      p_budget_id: input.budgetId,
      p_through: input.endsOn ?? new Date().toISOString().slice(0, 10),
    });

    revalidateBudgets(input.spaceId);
    revalidatePath(`/s/${input.spaceId}/budgets/${input.budgetId}`);
    return { ok: true as const, data: { updated: true as const } };
  });

export const archiveBudget = authedAction()
  .schema(deleteBudgetSchema)
  .space(({ input }) => input.spaceId)
  .action(async ({ input, ctx }) => {
    const { error } = await ctx.supabase
      .from('budgets')
      .update({ is_active: false })
      .eq('id', input.budgetId)
      .eq('space_id', input.spaceId);

    if (error) {
      return {
        ok: false as const,
        error: { code: 'budget_archive_failed', message: error.message },
      };
    }
    revalidateBudgets(input.spaceId);
    return { ok: true as const, data: { archived: true as const } };
  });

export const acceptBudgetSuggestions = authedAction()
  .schema(acceptSuggestionsSchema)
  .space(({ input }) => input.spaceId)
  .action(async ({ input, ctx }) => {
    const { data: space } = await ctx.supabase
      .from('spaces')
      .select('base_currency')
      .eq('id', input.spaceId)
      .maybeSingle();

    const startsOn = new Date().toISOString().slice(0, 10);
    const rows = input.items.map((item) => ({
      space_id: input.spaceId,
      name: item.name,
      scope: 'category' as const,
      category_id: item.categoryId,
      period: 'month' as const,
      limit_minor: item.limitMinor,
      currency: space?.base_currency ?? 'EUR',
      starts_on: startsOn,
      alert_thresholds: [50, 80, 100],
      created_by: ctx.userId,
    }));

    const { error } = await ctx.supabase.from('budgets').insert(rows);
    if (error) {
      return {
        ok: false as const,
        error: { code: 'budget_suggest_failed', message: error.message },
      };
    }
    revalidateBudgets(input.spaceId);
    return { ok: true as const, data: { created: rows.length } };
  });
