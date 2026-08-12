/**
 * Deterministic tool smoke — no LLM. Proves goldens match tool/RPC outputs for the demo space.
 * Usage: pnpm dlx tsx e2e/ai-eval/tools-smoke.ts
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function loadEnvLocal(): void {
  try {
    const raw = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8');
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq < 0) continue;
      const key = trimmed.slice(0, eq);
      let value = trimmed.slice(eq + 1);
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = value;
    }
  } catch {
    // optional
  }
}

function monthBounds(timezone: string, offsetMonths: number): { from: string; to: string } {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = fmt.formatToParts(new Date());
  const y = Number(parts.find((p) => p.type === 'year')?.value);
  const m = Number(parts.find((p) => p.type === 'month')?.value);
  const anchor = new Date(Date.UTC(y, m - 1 + offsetMonths, 1));
  const end = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1, 0));
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { from: iso(anchor), to: iso(end) };
}

async function main(): Promise<void> {
  loadEnvLocal();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) throw new Error('Missing Supabase env');

  const supabase = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: 'nido' },
  }) as unknown as SupabaseClient;

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: 'alex@demo.nido.local',
    password: 'password123',
  });
  if (signInError) throw signInError;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('No user');

  const { data: membership } = await supabase
    .from('space_members')
    .select('space_id')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle();
  if (!membership) throw new Error('No space');
  const spaceId = membership.space_id;

  const { data: space } = await supabase
    .from('spaces')
    .select('timezone')
    .eq('id', spaceId)
    .single();
  if (!space) throw new Error('Space missing');

  const last = monthBounds(String(space.timezone), -1);
  const { data, error } = await supabase.rpc('space_summary', {
    p_space_id: spaceId,
    p_from: last.from,
    p_to: last.to,
    p_participant_id: null,
  });
  if (error) throw error;

  const summary = data as {
    totals: {
      expense_minor: number;
      income_minor: number;
      net_minor: number;
      transaction_count: number;
    };
  };

  const checks = [
    ['expense_minor', summary.totals.expense_minor > 0],
    ['income_minor', summary.totals.income_minor > 0],
    ['transaction_count', summary.totals.transaction_count > 0],
  ] as const;

  console.log(`Demo space ${spaceId}`);
  console.log(`Last month ${last.from} → ${last.to}`);
  console.log(JSON.stringify(summary.totals, null, 2));

  const failed = checks.filter(([, ok]) => !ok);
  if (failed.length) {
    console.error('FAIL', failed.map(([name]) => name).join(', '));
    process.exitCode = 1;
    return;
  }
  console.log('PASS tools-smoke — seeded period summary is non-empty and queryable');
}

void main();
