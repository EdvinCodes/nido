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

  const { data, error } = await supabase.schema('nido').rpc('reconcile_open_budget_periods');
  if (error) {
    console.error('budget-reconcile failed', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  const drifts = (data ?? []) as Array<{
    period_id: string;
    budget_id: string;
    before_minor: number;
    after_minor: number;
  }>;

  for (const row of drifts) {
    console.warn(
      `budget drift corrected budget=${row.budget_id} period=${row.period_id} before=${row.before_minor} after=${row.after_minor}`,
    );
  }

  return new Response(JSON.stringify({ corrected: drifts.length, drifts }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
