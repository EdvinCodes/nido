'use server';

import { revalidatePath } from 'next/cache';
import { authedAction } from '@/lib/auth/authed-action';
import { untyped } from '@/features/transactions/db';
import { persistPeriodPreferenceSchema, searchTransactionsSchema } from './schemas';
import type { SearchTransactionHit } from './types';

export const persistPeriodPreference = authedAction()
  .schema(persistPeriodPreferenceSchema)
  .action(async ({ input, ctx }) => {
    const { error } = await ctx.supabase
      .from('profiles')
      .update({
        default_period_preset: input.preset,
        default_period_from: input.preset === 'custom' ? input.from : null,
        default_period_to: input.preset === 'custom' ? input.to : null,
      })
      .eq('id', ctx.userId);

    if (error) {
      return {
        ok: false as const,
        error: { code: 'period_pref_failed', message: error.message },
      };
    }

    revalidatePath(`/s/${input.spaceId}`);
    return { ok: true as const, data: { saved: true as const } };
  });

export const searchTransactionsAction = authedAction()
  .schema(searchTransactionsSchema)
  .space(({ input }) => input.spaceId)
  .action(async ({ input, ctx }) => {
    const { data, error } = await untyped(ctx.supabase).rpc('search_transactions', {
      p_space_id: input.spaceId,
      p_query: input.query,
      p_limit: input.limit,
    });

    if (error) {
      return {
        ok: false as const,
        error: { code: 'search_failed', message: error.message },
      };
    }

    return {
      ok: true as const,
      data: data as SearchTransactionHit[],
    };
  });
