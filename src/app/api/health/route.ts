import { createClient } from '@/lib/supabase/server';

/**
 * Trivial health check for CI keepalive and deployment probes. Reads one row from
 * `nido.currencies` through the anon client so RLS applies and no service-role secret is
 * required for the probe itself. See docs/01-ARCHITECTURE.md §10.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { error } = await supabase.from('currencies').select('code').limit(1).maybeSingle();

    if (error) {
      return Response.json({ ok: false, error: error.message }, { status: 503 });
    }

    return Response.json({ ok: true });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : 'Health check failed';
    return Response.json({ ok: false, error: message }, { status: 503 });
  }
}
