'use server';

import { revalidatePath } from 'next/cache';
import { authedAction } from '@/lib/auth/authed-action';
import { getServerEnv } from '@/lib/env';
import {
  markAllReadSchema,
  markReadSchema,
  pushSubscriptionSchema,
  quietHoursSchema,
  sendTestNotificationSchema,
  updatePreferenceSchema,
} from './schemas';

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
    const { data: existing } = await ctx.supabase
      .from('notification_preferences')
      .select('in_app, push, email')
      .eq('user_id', ctx.userId)
      .eq('space_id', input.spaceId)
      .eq('kind', input.kind)
      .maybeSingle();

    const { error } = await ctx.supabase.from('notification_preferences').upsert(
      {
        user_id: ctx.userId,
        space_id: input.spaceId,
        kind: input.kind,
        in_app: input.inApp ?? existing?.in_app ?? true,
        push: input.push ?? existing?.push ?? false,
        email: input.email ?? existing?.email ?? false,
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

export const savePushSubscription = authedAction()
  .schema(pushSubscriptionSchema)
  .action(async ({ input, ctx }) => {
    const { error } = await ctx.supabase.from('push_subscriptions').upsert(
      {
        user_id: ctx.userId,
        endpoint: input.endpoint,
        p256dh: input.p256dh,
        auth: input.auth,
        user_agent: input.userAgent ?? null,
      },
      { onConflict: 'endpoint' },
    );

    if (error) {
      return {
        ok: false as const,
        error: { code: 'push_subscription_failed', message: error.message },
      };
    }
    return { ok: true as const, data: { saved: true as const } };
  });

export const removePushSubscription = authedAction()
  .schema(pushSubscriptionSchema.pick({ endpoint: true }))
  .action(async ({ input, ctx }) => {
    const { error } = await ctx.supabase
      .from('push_subscriptions')
      .delete()
      .eq('user_id', ctx.userId)
      .eq('endpoint', input.endpoint);

    if (error) {
      return {
        ok: false as const,
        error: { code: 'push_unsubscribe_failed', message: error.message },
      };
    }
    return { ok: true as const, data: { removed: true as const } };
  });

export const updateQuietHours = authedAction()
  .schema(quietHoursSchema)
  .action(async ({ input, ctx }) => {
    const { error } = await ctx.supabase.from('notification_quiet_hours').upsert(
      {
        user_id: ctx.userId,
        enabled: input.enabled,
        start_minute: input.startMinute,
        end_minute: input.endMinute,
        timezone: input.timezone,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    );

    if (error) {
      return {
        ok: false as const,
        error: { code: 'quiet_hours_failed', message: error.message },
      };
    }
    revalidateNotifications(input.spaceId);
    return { ok: true as const, data: { updated: true as const } };
  });

export const sendTestNotification = authedAction()
  .schema(sendTestNotificationSchema)
  .space(({ input }) => input.spaceId)
  .action(async ({ input, ctx }) => {
    const env = getServerEnv();
    const cronSecret = env.CRON_SECRET ?? 'local-dev-cron';
    const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321';

    const functionName = input.channel === 'email' ? 'email-send' : 'push-send';

    if (input.channel === 'email' && !env.RESEND_API_KEY) {
      return {
        ok: false as const,
        error: { code: 'email_not_configured', message: 'RESEND_API_KEY is not set' },
      };
    }

    if (input.channel === 'push' && (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY)) {
      return {
        ok: false as const,
        error: { code: 'push_not_configured', message: 'VAPID keys are not configured' },
      };
    }

    const res = await fetch(`${baseUrl}/functions/v1/${functionName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cronSecret}`,
      },
      body: JSON.stringify({
        test: true,
        user_id: ctx.userId,
        space_id: input.spaceId,
      }),
    });

    if (!res.ok) {
      const message = await res.text();
      return {
        ok: false as const,
        error: { code: 'test_send_failed', message },
      };
    }

    return { ok: true as const, data: { sent: true as const } };
  });
