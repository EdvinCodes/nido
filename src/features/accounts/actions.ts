'use server';

import { revalidatePath } from 'next/cache';
import { authedAction } from '@/lib/auth/authed-action';
import { untyped } from '@/features/transactions/db';
import {
  archiveAccountSchema,
  createAccountSchema,
  reorderAccountsSchema,
  updateAccountSchema,
} from './schemas';

function revalidateAccounts(spaceId: string): void {
  revalidatePath(`/s/${spaceId}/ledger`);
  revalidatePath(`/s/${spaceId}/settings/accounts`);
}

export const createAccount = authedAction()
  .schema(createAccountSchema)
  .space(({ input }) => input.spaceId, { action: 'accounts.create' })
  .action(async ({ input, ctx }) => {
    let currency = input.currency;
    if (!currency) {
      const { data: space } = await ctx.supabase
        .from('spaces')
        .select('base_currency')
        .eq('id', input.spaceId)
        .maybeSingle();
      currency = space?.base_currency ?? 'EUR';
    }

    const { data: last } = await untyped(ctx.supabase)
      .from<{ position: number }>('accounts')
      .select('position')
      .eq('space_id', input.spaceId)
      .order('position', { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data, error } = await untyped(ctx.supabase)
      .from<{ id: string }>('accounts')
      .insert({
        space_id: input.spaceId,
        name: input.name,
        kind: input.kind,
        currency,
        owner_participant_id: input.ownerParticipantId ?? null,
        opening_balance_minor: input.openingBalanceMinor,
        color: input.color,
        icon: input.icon,
        include_in_totals: input.includeInTotals,
        position: (last?.position ?? -1) + 1,
      })
      .select('id')
      .single();

    if (error) {
      return {
        ok: false as const,
        error: { code: 'account_create_failed', message: error.message },
      };
    }
    revalidateAccounts(input.spaceId);
    return { ok: true as const, data: { id: data?.id ?? '' } };
  });

export const updateAccount = authedAction()
  .schema(updateAccountSchema)
  .space(({ input }) => input.spaceId, { action: 'accounts.update' })
  .action(async ({ input, ctx }) => {
    const patch: Record<string, unknown> = {};
    if (input.name !== undefined) patch.name = input.name;
    if (input.kind !== undefined) patch.kind = input.kind;
    if (input.ownerParticipantId !== undefined)
      patch.owner_participant_id = input.ownerParticipantId;
    if (input.openingBalanceMinor !== undefined)
      patch.opening_balance_minor = input.openingBalanceMinor;
    if (input.color !== undefined) patch.color = input.color;
    if (input.icon !== undefined) patch.icon = input.icon;
    if (input.includeInTotals !== undefined) patch.include_in_totals = input.includeInTotals;

    const { error } = await untyped(ctx.supabase)
      .from('accounts')
      .update(patch)
      .eq('id', input.accountId)
      .eq('space_id', input.spaceId);

    if (error) {
      return {
        ok: false as const,
        error: { code: 'account_update_failed', message: error.message },
      };
    }
    revalidateAccounts(input.spaceId);
    return { ok: true as const, data: { updated: true as const } };
  });

export const archiveAccount = authedAction()
  .schema(archiveAccountSchema)
  .space(({ input }) => input.spaceId, { action: 'accounts.update' })
  .action(async ({ input, ctx }) => {
    const { error } = await untyped(ctx.supabase)
      .from('accounts')
      .update({ archived_at: input.archived ? new Date().toISOString() : null })
      .eq('id', input.accountId)
      .eq('space_id', input.spaceId);

    if (error) {
      return {
        ok: false as const,
        error: { code: 'account_archive_failed', message: error.message },
      };
    }
    revalidateAccounts(input.spaceId);
    return { ok: true as const, data: { archived: input.archived } };
  });

export const reorderAccounts = authedAction()
  .schema(reorderAccountsSchema)
  .space(({ input }) => input.spaceId, { action: 'accounts.update' })
  .action(async ({ input, ctx }) => {
    for (const item of input.items) {
      const { error } = await untyped(ctx.supabase)
        .from('accounts')
        .update({ position: item.position })
        .eq('id', item.id)
        .eq('space_id', input.spaceId);
      if (error) {
        return {
          ok: false as const,
          error: { code: 'account_reorder_failed', message: error.message },
        };
      }
    }
    revalidateAccounts(input.spaceId);
    return { ok: true as const, data: { reordered: true as const } };
  });
