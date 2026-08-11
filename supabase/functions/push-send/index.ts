import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3';

type PushBody = {
  notification_id?: string;
  flush_queue?: boolean;
  test?: boolean;
  user_id?: string;
  space_id?: string;
};

Deno.serve(async (req) => {
  const secret = Deno.env.get('CRON_SECRET');
  const auth = req.headers.get('authorization') ?? '';
  if (!secret || auth !== `Bearer ${secret}`) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });
  }

  const vapidPublic = Deno.env.get('VAPID_PUBLIC_KEY');
  const vapidPrivate = Deno.env.get('VAPID_PRIVATE_KEY');
  const vapidSubject = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:support@nido.app';

  if (!vapidPublic || !vapidPrivate) {
    return new Response(JSON.stringify({ skipped: true, reason: 'vapid_not_configured' }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const body = (await req.json().catch(() => ({}))) as PushBody;

  if (body.flush_queue) {
    const count = await flushQueue(supabase, webpush);
    return json({ flushed: count });
  }

  if (body.test && body.user_id && body.space_id) {
    const sent = await sendTestPush(supabase, webpush, body.user_id, body.space_id);
    return json({ sent });
  }

  if (!body.notification_id) {
    return json({ error: 'notification_id required' }, 400);
  }

  const result = await deliverNotification(supabase, webpush, body.notification_id);
  return json(result);
});

async function deliverNotification(
  supabase: ReturnType<typeof createClient>,
  webpushLib: typeof webpush,
  notificationId: string,
) {
  const { data: notification } = await supabase
    .schema('nido')
    .from('notifications')
    .select('id, user_id, space_id, kind, title, body, link, push_sent_at')
    .eq('id', notificationId)
    .single();

  if (!notification || notification.push_sent_at) {
    return { skipped: true };
  }

  const { data: pref } = await supabase
    .schema('nido')
    .from('notification_preferences')
    .select('push')
    .eq('user_id', notification.user_id)
    .eq('space_id', notification.space_id)
    .eq('kind', notification.kind)
    .maybeSingle();

  if (pref?.push !== true) {
    return { skipped: true, reason: 'push_disabled' };
  }

  const { data: inQuiet } = await supabase
    .schema('nido')
    .rpc('is_in_quiet_hours', { p_user_id: notification.user_id });

  if (inQuiet === true) {
    const { data: deliverAfter } = await supabase
      .schema('nido')
      .rpc('quiet_hours_end_at', { p_user_id: notification.user_id });

    await supabase
      .schema('nido')
      .from('push_delivery_queue')
      .upsert(
        {
          notification_id: notification.id,
          user_id: notification.user_id,
          deliver_after: deliverAfter ?? new Date().toISOString(),
        },
        { onConflict: 'notification_id,user_id' },
      );
    return { queued: true };
  }

  const sent = await sendToUser(supabase, webpushLib, notification);
  if (sent > 0) {
    await supabase
      .schema('nido')
      .from('notifications')
      .update({ push_sent_at: new Date().toISOString() })
      .eq('id', notification.id);
  }
  return { sent };
}

async function flushQueue(
  supabase: ReturnType<typeof createClient>,
  webpushLib: typeof webpush,
): Promise<number> {
  const { data: queued } = await supabase
    .schema('nido')
    .from('push_delivery_queue')
    .select('notification_id')
    .lte('deliver_after', new Date().toISOString());

  let count = 0;
  for (const row of queued ?? []) {
    const result = await deliverNotification(supabase, webpushLib, row.notification_id);
    if (result.sent && result.sent > 0) {
      await supabase
        .schema('nido')
        .from('push_delivery_queue')
        .delete()
        .eq('notification_id', row.notification_id);
      count += 1;
    }
  }
  return count;
}

async function sendTestPush(
  supabase: ReturnType<typeof createClient>,
  webpushLib: typeof webpush,
  userId: string,
  spaceId: string,
): Promise<number> {
  return sendToUser(supabase, webpushLib, {
    id: 'test',
    user_id: userId,
    space_id: spaceId,
    kind: 'budget_threshold',
    title: 'Nido test notification',
    body: 'Push notifications are working.',
    link: `/s/${spaceId}/settings/notifications`,
  });
}

async function sendToUser(
  supabase: ReturnType<typeof createClient>,
  webpushLib: typeof webpush,
  notification: {
    id: string;
    user_id: string;
    space_id: string;
    kind: string;
    title: string;
    body: string | null;
    link: string | null;
  },
): Promise<number> {
  const { data: subs } = await supabase
    .schema('nido')
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('user_id', notification.user_id);

  const appUrl = Deno.env.get('NEXT_PUBLIC_APP_URL') ?? 'http://localhost:3000';
  const link = notification.link?.startsWith('http')
    ? notification.link
    : `${appUrl}${notification.link ?? `/s/${notification.space_id}`}`;

  const payload = JSON.stringify({
    title: notification.title,
    body: notification.body,
    icon: `${appUrl}/icons/icon-192.png`,
    badge: `${appUrl}/icons/icon-192.png`,
    link,
    notificationId: notification.id,
    actions: notification.kind.startsWith('budget')
      ? [{ action: 'view', title: 'View budget' }]
      : undefined,
  });

  let sent = 0;
  for (const sub of subs ?? []) {
    try {
      await webpushLib.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        payload,
      );
      sent += 1;
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode;
      if (status === 410 || status === 404) {
        await supabase.schema('nido').from('push_subscriptions').delete().eq('id', sub.id);
      }
    }
  }
  return sent;
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
