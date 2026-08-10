'use server';

import { revalidatePath } from 'next/cache';
import { authedAction } from '@/lib/auth/authed-action';
import type { Database } from '@/lib/supabase/database.types';
import {
  createCategorySchema,
  reorderCategoriesSchema,
  updateCategorySchema,
} from '@/features/spaces/schemas';

export const createCategoryAction = authedAction()
  .schema(createCategorySchema)
  .space(({ input }) => input.spaceId, { action: 'categories.create' })
  .action(async ({ input, ctx }) => {
    let query = ctx.supabase
      .from('categories')
      .select('position')
      .eq('space_id', input.spaceId)
      .order('position', { ascending: false })
      .limit(1);

    query = input.parentId ? query.eq('parent_id', input.parentId) : query.is('parent_id', null);

    const { data: maxPos } = await query.maybeSingle();

    const { data, error } = await ctx.supabase
      .from('categories')
      .insert({
        space_id: input.spaceId,
        name: input.name,
        kind: input.kind,
        color: input.color,
        icon: input.icon,
        parent_id: input.parentId ?? null,
        position: (maxPos?.position ?? -1) + 1,
      })
      .select('id')
      .single();

    if (error) {
      return {
        ok: false as const,
        error: {
          code: 'category_create_failed',
          message: error.message,
        },
      };
    }

    revalidatePath(`/s/${input.spaceId}/settings/categories`);
    return { ok: true as const, data: { id: data.id } };
  });

export const updateCategoryAction = authedAction()
  .schema(updateCategorySchema)
  .space(({ input }) => input.spaceId, { action: 'categories.update' })
  .action(async ({ input, ctx }) => {
    const patch: Database['nido']['Tables']['categories']['Update'] = {};
    if (input.name !== undefined) patch.name = input.name;
    if (input.color !== undefined) patch.color = input.color;
    if (input.icon !== undefined) patch.icon = input.icon;
    if (input.parentId !== undefined) patch.parent_id = input.parentId;
    if (input.position !== undefined) patch.position = input.position;
    if (input.archived === true) patch.archived_at = new Date().toISOString();
    if (input.archived === false) patch.archived_at = null;

    const { error } = await ctx.supabase
      .from('categories')
      .update(patch)
      .eq('id', input.categoryId)
      .eq('space_id', input.spaceId);

    if (error) {
      return {
        ok: false as const,
        error: { code: 'category_update_failed', message: error.message },
      };
    }

    revalidatePath(`/s/${input.spaceId}/settings/categories`);
    return { ok: true as const, data: { updated: true as const } };
  });

export const reorderCategoriesAction = authedAction()
  .schema(reorderCategoriesSchema)
  .space(({ input }) => input.spaceId, { action: 'categories.update' })
  .action(async ({ input, ctx }) => {
    for (const item of input.items) {
      const { error } = await ctx.supabase
        .from('categories')
        .update({ parent_id: item.parentId, position: item.position })
        .eq('id', item.id)
        .eq('space_id', input.spaceId);
      if (error) {
        return { ok: false as const, error: { code: 'reorder_failed', message: error.message } };
      }
    }

    revalidatePath(`/s/${input.spaceId}/settings/categories`);
    return { ok: true as const, data: { reordered: true as const } };
  });
