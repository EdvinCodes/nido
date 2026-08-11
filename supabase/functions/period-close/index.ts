import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

Deno.serve(async (req) => {
  const secret = Deno.env.get('CRON_SECRET');
  const auth = req.headers.get('authorization') ?? '';
  if (!secret || auth !== `Bearer ${secret}`) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const resendKey = Deno.env.get('RESEND_API_KEY');

  const { data, error } = await supabase.schema('nido').rpc('run_period_close_all');
  if (error) {
    console.error('period-close failed', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  if (resendKey && data && typeof data === 'object' && 'snapshot_ids' in data) {
    try {
      await maybeEmailCloses(supabase, resendKey, data as { snapshot_ids?: string[] });
    } catch (emailErr) {
      console.error('period-close email failed', emailErr);
    }
  }

  return new Response(JSON.stringify(data ?? {}), {
    headers: { 'Content-Type': 'application/json' },
  });
});

async function maybeEmailCloses(
  supabase: ReturnType<typeof createClient>,
  resendKey: string,
  result: { snapshot_ids?: string[] },
): Promise<void> {
  const ids = result.snapshot_ids ?? [];
  for (const snapshotId of ids) {
    const { data: snap } = await supabase
      .schema('nido')
      .from('period_snapshots')
      .select('space_id, period_from, period_to, payload')
      .eq('id', snapshotId)
      .single();
    if (!snap) continue;

    const payload = snap.payload as {
      space_name?: string;
      base_currency?: string;
      totals?: { income_minor?: number; expense_minor?: number; savings_rate?: number | null };
    };

    const { data: members } = await supabase
      .schema('nido')
      .from('space_members')
      .select('user_id')
      .eq('space_id', snap.space_id)
      .eq('status', 'active');

    for (const member of members ?? []) {
      const { data: pref } = await supabase
        .schema('nido')
        .from('notification_preferences')
        .select('email')
        .eq('user_id', member.user_id)
        .eq('space_id', snap.space_id)
        .eq('kind', 'period_close')
        .maybeSingle();

      if (pref?.email !== true) continue;

      const { data: profile } = await supabase
        .schema('nido')
        .from('profiles')
        .select('email, display_name')
        .eq('id', member.user_id)
        .single();

      if (!profile?.email) continue;

      const income = payload.totals?.income_minor ?? 0;
      const expense = payload.totals?.expense_minor ?? 0;
      const savings = payload.totals?.savings_rate;

      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'Nido <reports@nido.app>',
          to: profile.email,
          subject: `Monthly close: ${snap.period_from} – ${snap.period_to}`,
          html: `<p>Hi ${profile.display_name ?? ''},</p>
<p>Your household close for <strong>${payload.space_name ?? 'your space'}</strong> is ready.</p>
<ul>
<li>Income: ${income / 100} ${payload.base_currency ?? 'EUR'}</li>
<li>Expenses: ${expense / 100} ${payload.base_currency ?? 'EUR'}</li>
<li>Savings rate: ${savings == null ? '—' : `${Math.round(savings * 100)}%`}</li>
</ul>`,
        }),
      });
    }
  }
}
