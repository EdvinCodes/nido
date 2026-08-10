'use server';

import { revalidatePath } from 'next/cache';
import { authedAction } from '@/lib/auth/authed-action';
import { markAllReadSchema, markReadSchema, updatePreferenceSchema } from './schemas';

function revalidateNotifications(spaceId: string): void {
  revalidatePath(`/s/${spaceId}`);
  revalidatePath(`/s/${spaceId}/settings/notifications`);
}

export const markNotificationRead = authedAction()
  .schema(markReadSchema)
  .space(({ input }) => input.spaceId)
  .action(async ({ input, ctx }) => {
    const { error } = await ctx.supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', input.notificationId)
      .eq('user_id', ctx.userId)
      .eq('space_id', input.spaceId);

    if (error) {
      return {
        ok: false as const,
        error: { code: 'notification_update_failed', message: error.message },
      };
    }
    revalidateNotifications(input.spaceId);
    return { ok: true as const, data: { read: true as const } };
  });

export const markAllNotificationsRead = authedAction()
  .schema(markAllReadSchema)
  .space(({ input }) => input.spaceId)
  .action(async ({ input, ctx }) => {
    const { error } = await ctx.supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('user_id', ctx.userId)
      .eq('space_id', input.spaceId)
      .is('read_at', null);

    if (error) {
      return {
        ok: false as const,
        error: { code: 'notification_update_failed', message: error.message },
      };
    }
    revalidateNotifications(input.spaceId);
    return { ok: true as const, data: { read: true as const } };
  });

export const updateNotificationPreference = authedAction()
  .schema(updatePreferenceSchema)
  .space(({ input }) => input.spaceId)
  .action(async ({ input, ctx }) => {
    const { error } = await ctx.supabase.from('notification_preferences').upsert(
      {
        user_id: ctx.userId,
        space_id: input.spaceId,
        kind: input.kind,
        in_app: input.inApp,
        push: false,
        email: false,
      },
      { onConflict: 'user_id,space_id,kind' },
    );

    if (error) {
      return {
        ok: false as const,
        error: { code: 'preference_update_failed', message: error.message },
      };
    }
    revalidateNotifications(input.spaceId);
    return { ok: true as const, data: { updated: true as const } };
  });
