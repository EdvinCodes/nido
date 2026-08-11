import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const FX_URL = Deno.env.get('FX_API_URL') ?? 'https://api.frankfurter.app';

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

  try {
    const { data: currencies, error: curErr } = await supabase
      .schema('nido')
      .from('currencies')
      .select('code');
    if (curErr) throw curErr;

    const codes = (currencies ?? []).map((c) => c.code as string).filter((c) => c !== 'EUR');

    if (codes.length === 0) {
      return new Response(JSON.stringify({ upserted: 0 }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const symbols = codes.join(',');
    const res = await fetch(`${FX_URL}/latest?from=EUR&to=${symbols}`);
    if (!res.ok) {
      console.error('frankfurter failed', res.status, await res.text());
      return new Response(JSON.stringify({ error: 'fx_fetch_failed', upserted: 0 }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const body = (await res.json()) as {
      date?: string;
      rates?: Record<string, number>;
    };

    const asOf = body.date ?? new Date().toISOString().slice(0, 10);
    const rates = body.rates ?? {};
    const rows = Object.entries(rates).map(([quote, rate]) => ({
      base: 'EUR',
      quote,
      rate,
      as_of: asOf,
      source: 'frankfurter',
    }));

    if (rows.length === 0) {
      return new Response(JSON.stringify({ upserted: 0 }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { data, error } = await supabase.schema('nido').rpc('upsert_exchange_rates', {
      p_rates: rows,
    });
    if (error) throw error;

    return new Response(JSON.stringify({ upserted: data ?? rows.length }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('fx-refresh failed', err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
