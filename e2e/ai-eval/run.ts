/**
 * Manual AI evaluation runner — not part of CI.
 *
 * Usage:
 *   AI_PROVIDER=ollama pnpm tsx e2e/ai-eval/run.ts
 *   AI_PROVIDER=anthropic pnpm tsx e2e/ai-eval/run.ts
 *
 * Talks to the model + tools directly (no Next.js server required). Needs local Supabase
 * with the demo seed and a configured AI provider.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

type Question = {
  id: string;
  question: string;
  expectedTools: string[];
  golden: {
    kind:
      | 'period_expenses'
      | 'period_income'
      | 'period_net'
      | 'period_count'
      | 'category_top'
      | 'static';
    period?: 'last_month' | 'this_month';
    minors?: number[];
  };
};

type EvalResult = {
  id: string;
  question: string;
  passNumeric: boolean;
  passTools: boolean | null;
  grounded: boolean;
  expectedMinors: number[];
  toolsCalled: string[];
  answerPreview: string;
  error?: string;
};

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

function extractMinorsFromText(text: string): number[] {
  const found = new Set<number>();

  // Explicit verifiable tags from the system prompt.
  for (const match of text.matchAll(/\(minor:\s*(-?\d+)\)/gi)) {
    const n = Number.parseInt(match[1] ?? '', 10);
    if (Number.isFinite(n)) found.add(n);
  }

  // Currency-like amounts, including negatives and EU/US separators.
  const re = /(?:€|EUR|\$)?\s*(-?\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})|-?\d+)/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    const raw = match[1] ?? '';
    const negative = raw.startsWith('-');
    const body = negative ? raw.slice(1) : raw;
    let normalized: string;
    if (body.includes(',') && body.includes('.')) {
      // US 1,234.56 vs EU 1.234,56 — last separator wins as decimal.
      const lastComma = body.lastIndexOf(',');
      const lastDot = body.lastIndexOf('.');
      normalized =
        lastComma > lastDot ? body.replace(/\./g, '').replace(',', '.') : body.replace(/,/g, '');
    } else if (/^\d+,\d{2}$/.test(body)) {
      normalized = body.replace(',', '.');
    } else {
      normalized = body.replace(/,/g, '');
    }
    const asFloat = Number.parseFloat(normalized);
    if (!Number.isFinite(asFloat)) continue;
    const signed = negative ? -asFloat : asFloat;
    if (/\.\d{2}$/.test(normalized) || /,\d{2}$/.test(body)) {
      found.add(Math.round(signed * 100));
    } else {
      found.add(Math.round(signed));
      found.add(Math.round(signed * 100));
    }
  }
  return [...found];
}

function minorsPresent(expected: number[], found: number[]): boolean {
  if (expected.length === 0) return true;
  return expected.every((minor) => {
    if (found.includes(minor)) return true;
    if (minor % 100 === 0 && found.includes(minor / 100)) return true;
    return false;
  });
}

function parseLimitArg(argv: string[]): number | null {
  const flag = argv.find((a) => a.startsWith('--limit='));
  if (!flag) return null;
  const n = Number.parseInt(flag.slice('--limit='.length), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

async function main(): Promise<void> {
  loadEnvLocal();

  const { ToolLoopAgent, stepCountIs } = await import('ai');
  const { createAssistantTools } = await import('../../src/features/assistant/tools');
  const { buildSystemPrompt } = await import('../../src/features/assistant/lib/system-prompt');
  const { getModel, getModelLabel } = await import('../../src/lib/ai/providers');

  const provider = process.env.AI_PROVIDER ?? 'ollama';
  const model = getModel();
  if (!model) {
    throw new Error(`No model resolved for AI_PROVIDER=${provider}`);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }

  const questionsAll = JSON.parse(
    readFileSync(resolve(process.cwd(), 'e2e/ai-eval/questions.json'), 'utf8'),
  ) as Question[];
  const limit = parseLimitArg(process.argv);
  const questions = limit ? questionsAll.slice(0, limit) : questionsAll;
  if (limit) console.log(`Running first ${questions.length} of ${questionsAll.length} questions`);

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
  if (!user) throw new Error('No user after demo sign-in');

  const { data: membership } = await supabase
    .from('space_members')
    .select('space_id')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle();
  if (!membership) throw new Error('Demo user has no space');
  const spaceId = membership.space_id;

  const { data: space } = await supabase
    .from('spaces')
    .select('name, base_currency, timezone, month_starts_on')
    .eq('id', spaceId)
    .single();
  if (!space) throw new Error('Space not found');

  const timezone = String(space.timezone);
  const baseCurrency = String(space.base_currency);
  const spaceName = String(space.name);
  const monthStartsOn = Number(space.month_starts_on);

  const [{ data: categories }, { data: participants }] = await Promise.all([
    supabase
      .from('categories')
      .select('id, name, kind')
      .eq('space_id', spaceId)
      .is('archived_at', null),
    supabase
      .from('participants')
      .select('id, display_name, position')
      .eq('space_id', spaceId)
      .eq('is_active', true)
      .order('position'),
  ]);

  const last = monthBounds(timezone, -1);
  const current = monthBounds(timezone, 0);

  async function periodSummary(from: string, to: string) {
    const { data, error } = await supabase.rpc('space_summary', {
      p_space_id: spaceId,
      p_from: from,
      p_to: to,
      p_participant_id: null,
    });
    if (error) throw error;
    return data as {
      totals: {
        income_minor: number;
        expense_minor: number;
        net_minor: number;
        transaction_count: number;
      };
      categories: { expense: Array<{ name: string; total_minor: number }> };
    };
  }

  const lastSummary = await periodSummary(last.from, last.to);
  const thisSummary = await periodSummary(current.from, current.to);

  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

  const instructions = buildSystemPrompt({
    spaceName,
    baseCurrency,
    timezone,
    monthStartsOn,
    today,
    categories: categories ?? [],
    participants: (participants ?? []).map((p, index) => ({
      id: p.id,
      label: String.fromCharCode(65 + index),
    })),
    locale: 'en',
  });

  const tools = createAssistantTools({
    spaceId,
    userId: user.id,
    baseCurrency,
    locale: 'en',
    supabase: supabase as never,
    useRealNames: false,
  });

  const agent = new ToolLoopAgent({
    model,
    instructions,
    tools,
    stopWhen: stepCountIs(8),
  });

  const results: EvalResult[] = [];

  for (const q of questions) {
    let expectedMinors: number[] = q.golden.minors ?? [];
    if (q.golden.kind === 'period_expenses' && q.golden.period === 'last_month') {
      expectedMinors = [lastSummary.totals.expense_minor];
    } else if (q.golden.kind === 'period_income' && q.golden.period === 'last_month') {
      expectedMinors = [lastSummary.totals.income_minor];
    } else if (q.golden.kind === 'period_net' && q.golden.period === 'last_month') {
      expectedMinors = [lastSummary.totals.net_minor];
    } else if (q.golden.kind === 'period_count' && q.golden.period === 'last_month') {
      expectedMinors = [lastSummary.totals.transaction_count];
    } else if (q.golden.kind === 'category_top' && q.golden.period === 'last_month') {
      const top = lastSummary.categories.expense[0];
      expectedMinors = top ? [top.total_minor] : [];
    } else if (q.golden.kind === 'period_expenses' && q.golden.period === 'this_month') {
      expectedMinors = [thisSummary.totals.expense_minor];
    } else if (q.golden.kind === 'period_income' && q.golden.period === 'this_month') {
      expectedMinors = [thisSummary.totals.income_minor];
    }

    try {
      const result = await agent.generate({
        messages: [{ role: 'user', content: q.question }],
      });

      const answer = typeof result.text === 'string' ? result.text : '';
      const steps = Array.isArray(result.steps) ? result.steps : [];
      const toolsCalled = [
        ...new Set(steps.flatMap((step) => step.toolCalls.map((call) => call.toolName))),
      ];
      const foundMinors = extractMinorsFromText(answer);
      const passNumeric = minorsPresent(expectedMinors, foundMinors);
      const passTools =
        q.expectedTools.length === 0
          ? null
          : q.expectedTools.some((tool) => toolsCalled.includes(tool));
      const grounded = /nido:ledger\?ids=/.test(answer) || toolsCalled.length > 0;

      results.push({
        id: q.id,
        question: q.question,
        passNumeric,
        passTools,
        grounded,
        expectedMinors,
        toolsCalled,
        answerPreview: answer.slice(0, 320),
      });
      console.log(`${passNumeric ? 'PASS' : 'FAIL'} ${q.id} tools=${toolsCalled.join(',') || '-'}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      results.push({
        id: q.id,
        question: q.question,
        passNumeric: false,
        passTools: null,
        grounded: false,
        expectedMinors,
        toolsCalled: [],
        answerPreview: '',
        error: message,
      });
      console.log(`FAIL ${q.id} error=${message}`);
    }
  }

  const numericPass = results.filter((r) => r.passNumeric).length;
  const summary = {
    provider,
    model: getModelLabel(),
    ranAt: new Date().toISOString(),
    total: results.length,
    numericAccuracy: `${numericPass}/${results.length}`,
    numericPassRate: results.length ? numericPass / results.length : 0,
    results,
  };

  const outPath = resolve(process.cwd(), 'e2e/ai-eval/last-results.json');
  writeFileSync(outPath, JSON.stringify(summary, null, 2));
  console.log(`AI eval (${provider}): numeric ${summary.numericAccuracy}`);
  console.log(`Wrote ${outPath}`);
  if (summary.numericPassRate < 1) {
    process.exitCode = 1;
  }
}

void main();
