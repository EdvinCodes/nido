import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

type InsightCandidate = {
  kind: string;
  title: string;
  body: string;
  severity: string;
  evidence: Record<string, unknown>;
  potential_saving_minor?: number | null;
  subject_key?: string | null;
};

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

  const { data: spaces, error: spacesError } = await supabase
    .schema('nido')
    .from('spaces')
    .select('id');
  if (spacesError) {
    return new Response(JSON.stringify({ error: spacesError.message }), { status: 500 });
  }

  let inserted = 0;

  for (const space of spaces ?? []) {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { count: recentCount } = await supabase
      .schema('nido')
      .from('ai_insights')
      .select('*', { count: 'exact', head: true })
      .eq('space_id', space.id)
      .gte('created_at', weekAgo);
    if ((recentCount ?? 0) >= 3) continue;

    const { data: raw, error: detectError } = await supabase
      .schema('nido')
      .rpc('ai_run_insight_detectors', {
        p_space_id: space.id,
      });
    if (detectError) {
      console.error('detectors failed', space.id, detectError);
      continue;
    }

    const candidates = (raw ?? []) as InsightCandidate[];
    for (const candidate of candidates) {
      if ((recentCount ?? 0) + inserted >= 3) break;

      const { data: suppressed } = await supabase.schema('nido').rpc('ai_insight_is_suppressed', {
        p_space_id: space.id,
        p_kind: candidate.kind,
        p_subject_key: candidate.subject_key ?? null,
      });
      if (suppressed) continue;

      const { error: insertError } = await supabase
        .schema('nido')
        .from('ai_insights')
        .insert({
          space_id: space.id,
          kind: candidate.kind,
          title: candidate.title,
          body: candidate.body,
          severity: candidate.severity,
          evidence: candidate.evidence,
          potential_saving_minor: candidate.potential_saving_minor ?? null,
          subject_key: candidate.subject_key ?? null,
        });
      if (!insertError) inserted += 1;
    }
  }

  return new Response(JSON.stringify({ inserted }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
