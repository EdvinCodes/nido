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

const POLISH_RULE =
  'Rewrite the household finance insight in one clear, plain sentence. Do not add facts. Do not invent numbers.';

/** Model only rewrites the sentence; never decides whether a finding is true. */
async function polishInsightBody(kind: string, body: string): Promise<string> {
  const provider = Deno.env.get('AI_PROVIDER');
  if (!provider || provider === 'ollama') {
    // Local / unset: keep deterministic detector copy.
    return body;
  }

  const apiKey =
    provider === 'openai'
      ? Deno.env.get('OPENAI_API_KEY')
      : provider === 'anthropic'
        ? Deno.env.get('ANTHROPIC_API_KEY')
        : Deno.env.get('GOOGLE_GENERATIVE_AI_API_KEY');
  if (!apiKey) return body;

  const userContent = `Kind: ${kind}\nFact: ${body}`;

  try {
    if (provider === 'openai') {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: Deno.env.get('AI_MODEL') ?? 'gpt-4o-mini',
          temperature: 0.2,
          messages: [
            { role: 'system', content: POLISH_RULE },
            { role: 'user', content: userContent },
          ],
        }),
      });
      if (!res.ok) return body;
      const json = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const text = json.choices?.[0]?.message?.content?.trim();
      return text || body;
    }

    if (provider === 'anthropic') {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: Deno.env.get('AI_MODEL') ?? 'claude-sonnet-4-20250514',
          max_tokens: 256,
          temperature: 0.2,
          system: POLISH_RULE,
          messages: [{ role: 'user', content: userContent }],
        }),
      });
      if (!res.ok) return body;
      const json = (await res.json()) as {
        content?: Array<{ type?: string; text?: string }>;
      };
      const text = json.content?.find((block) => block.type === 'text')?.text?.trim();
      return text || body;
    }

    if (provider === 'google') {
      const model = Deno.env.get('AI_MODEL') ?? 'gemini-2.0-flash';
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: POLISH_RULE }] },
            contents: [{ role: 'user', parts: [{ text: userContent }] }],
            generationConfig: { temperature: 0.2 },
          }),
        },
      );
      if (!res.ok) return body;
      const json = (await res.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      const text = json.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      return text || body;
    }
  } catch {
    return body;
  }

  return body;
}

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
    let spaceInserted = 0;
    for (const candidate of candidates) {
      if ((recentCount ?? 0) + spaceInserted >= 3) break;

      const { data: suppressed } = await supabase.schema('nido').rpc('ai_insight_is_suppressed', {
        p_space_id: space.id,
        p_kind: candidate.kind,
        p_subject_key: candidate.subject_key ?? null,
      });
      if (suppressed) continue;

      const body = await polishInsightBody(candidate.kind, candidate.body);

      const { error: insertError } = await supabase
        .schema('nido')
        .from('ai_insights')
        .insert({
          space_id: space.id,
          kind: candidate.kind,
          title: candidate.title,
          body,
          severity: candidate.severity,
          evidence: candidate.evidence,
          potential_saving_minor: candidate.potential_saving_minor ?? null,
          subject_key: candidate.subject_key ?? null,
        });
      if (!insertError) {
        spaceInserted += 1;
        inserted += 1;
      }
    }
  }

  return new Response(JSON.stringify({ inserted }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
