import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

type EmailBody = {
  notification_id?: string;
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

  const resendKey = Deno.env.get('RESEND_API_KEY');
  if (!resendKey) {
    return new Response(JSON.stringify({ skipped: true, reason: 'resend_not_configured' }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const body = (await req.json().catch(() => ({}))) as EmailBody;
  const appUrl = Deno.env.get('NEXT_PUBLIC_APP_URL') ?? 'http://localhost:3000';

  if (body.test && body.user_id && body.space_id) {
    const sent = await sendTestEmail(supabase, resendKey, appUrl, body.user_id, body.space_id);
    return json({ sent });
  }

  if (!body.notification_id) {
    return json({ error: 'notification_id required' }, 400);
  }

  const { data: notification } = await supabase
    .schema('nido')
    .from('notifications')
    .select('id, user_id, space_id, kind, title, body, link, email_sent_at')
    .eq('id', body.notification_id)
    .single();

  if (!notification || notification.email_sent_at) {
    return json({ skipped: true });
  }

  const { data: pref } = await supabase
    .schema('nido')
    .from('notification_preferences')
    .select('email')
    .eq('user_id', notification.user_id)
    .eq('space_id', notification.space_id)
    .eq('kind', notification.kind)
    .maybeSingle();

  if (pref?.email !== true) {
    return json({ skipped: true, reason: 'email_disabled' });
  }

  const { data: profile } = await supabase
    .schema('nido')
    .from('profiles')
    .select('email, display_name')
    .eq('id', notification.user_id)
    .single();

  if (!profile?.email) {
    return json({ skipped: true, reason: 'no_email' });
  }

  const link = notification.link?.startsWith('http')
    ? notification.link
    : `${appUrl}${notification.link ?? `/s/${notification.space_id}`}`;

  const unsubscribe = `${appUrl}/s/${notification.space_id}/settings/notifications?unsubscribe=${notification.kind}`;

  const html = `<!doctype html><html><body style="font-family:system-ui,sans-serif;background:#1c1a18;color:#f5f3ef;padding:24px">
<h1 style="color:#e6a848;font-weight:600">${escapeHtml(notification.title)}</h1>
<p>${escapeHtml(notification.body ?? '')}</p>
<p><a href="${link}" style="color:#e6a848">Open in Nido</a></p>
<hr style="border:none;border-top:1px solid #3d3935;margin:24px 0"/>
<p style="font-size:12px;color:#9a9590"><a href="${unsubscribe}" style="color:#9a9590">Unsubscribe from this kind</a></p>
</body></html>`;

  const text = `${notification.title}\n\n${notification.body ?? ''}\n\nOpen: ${link}\n\nUnsubscribe: ${unsubscribe}`;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Nido <notifications@nido.app>',
      to: profile.email,
      subject: notification.title,
      html,
      text,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    return json({ error: err }, 500);
  }

  await supabase
    .schema('nido')
    .from('notifications')
    .update({ email_sent_at: new Date().toISOString() })
    .eq('id', notification.id);

  return json({ sent: true });
});

async function sendTestEmail(
  supabase: ReturnType<typeof createClient>,
  resendKey: string,
  appUrl: string,
  userId: string,
  spaceId: string,
): Promise<boolean> {
  const { data: profile } = await supabase
    .schema('nido')
    .from('profiles')
    .select('email, display_name')
    .eq('id', userId)
    .single();

  if (!profile?.email) return false;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Nido <notifications@nido.app>',
      to: profile.email,
      subject: 'Nido test email',
      html: `<p>Hi ${escapeHtml(profile.display_name ?? '')},</p><p>This is a test email from Nido.</p>`,
      text: 'This is a test email from Nido.',
    }),
  });

  return res.ok;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
