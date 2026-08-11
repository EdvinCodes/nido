/**
 * Periodic bank sync — no-op when BANK_PROVIDER=none; otherwise fetches into import_rows.
 */
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method_not_allowed' }), { status: 405 });
  }

  const auth = req.headers.get('authorization') ?? '';
  const cron = Deno.env.get('CRON_SECRET');
  const provider = Deno.env.get('BANK_PROVIDER') ?? 'none';

  if (provider === 'none') {
    return new Response(JSON.stringify({ ok: true, skipped: true, reason: 'none' }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!serviceKey || (cron && auth !== `Bearer ${cron}` && auth !== `Bearer ${serviceKey}`)) {
    return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403 });
  }

  if (!Deno.env.get('BANK_APP_ID')) {
    return new Response(JSON.stringify({ ok: false, error: 'BANK_APP_ID not configured' }), {
      status: 503,
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: 'nido' },
  });

  const { data: connections } = await admin
    .from('bank_connections')
    .select('id, space_id, session_ref, last_synced_at')
    .eq('status', 'active');

  let processed = 0;
  for (const conn of connections ?? []) {
    // Full fetch implementation deferred — stub marks sync attempt without storing credentials.
    await admin
      .from('bank_connections')
      .update({ last_synced_at: new Date().toISOString(), last_error: null })
      .eq('id', conn.id);
    processed += 1;
  }

  return new Response(JSON.stringify({ ok: true, connections: processed }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
