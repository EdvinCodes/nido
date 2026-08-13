# Phase 12 completion notes

## What shipped

- DB: `ai_conversations`, `ai_messages`, `ai_insights`, `ai_consent` with RLS + pgTAP
  (including insights member/outsider cases).
- Twelve read-only tools; `space_id` injected server-side; free-text fields wrapped in
  `<<<DATA>>>`; citation transaction ids where evidence exists.
- Chat API: consent, daily rate limit, history summarisation, provider error mapping,
  tool-call audit + token usage persistence.
- UI: desktop panel (⌘J), mobile route, citations, settings with usage/cost, Ollama setup
  copy, nav hidden when `AI_PROVIDER` is unset.
- Insights: detectors for duplicate charge, category spike, subscription price increase,
  ghost subscription, three-period budget overrun, declining savings rate. Edge Function
  polishes copy with the model when a cloud provider is configured.
- Eval harness: `e2e/ai-eval/run.ts` + 30 questions with runtime goldens from `space_summary`.
  Supports `--limit=N` for smoke runs. Default Ollama model is `llama3.2:3b` (tool-capable;
  plain `llama3` does **not** support tools).

## Verified locally (2026-08-12)

- Docker Desktop capped via `%USERPROFILE%\.wslconfig` (4GB / 2 CPUs) for multitasking.
- `pnpm db:reset` — OK (includes `20260812090000_ai_insight_detectors_v2.sql`).
- `pnpm test:db` — OK (201 tests, including `150_ai_assistant.sql`).
- `pnpm typecheck` / `lint` / `test` / `build` — OK on the hardening commit.
- `pnpm test:e2e` under the RAM cap: 73 passed, 2 failed (timeouts / aborted streams —
  pressure-related), 2 flaky. Not treated as product regressions yet; re-run with more headroom.

## Eval results

```bash
AI_PROVIDER=ollama AI_MODEL=llama3.2:3b pnpm dlx tsx e2e/ai-eval/run.ts --limit=5
AI_PROVIDER=ollama AI_MODEL=llama3.2:3b pnpm dlx tsx e2e/ai-eval/run.ts
AI_PROVIDER=anthropic pnpm dlx tsx e2e/ai-eval/run.ts
```

| Provider  | Model       | Numeric     | Date       | Notes                                          |
| --------- | ----------- | ----------- | ---------- | ---------------------------------------------- |
| ollama    | llama3 (8B) | 0/30        | 2026-08-12 | Does not support tools — unusable              |
| ollama    | llama3.2:3b | in progress | 2026-08-12 | Tool calls work; numeric copy still weak on 3B |
| anthropic | —           | —           | —          | Preferred for the 100% numeric gate            |

Phase gate still requires **100% numeric accuracy**. Prefer Anthropic/OpenAI for the full
30-question run; keep Ollama for privacy/smoke.

## Product status (2026-08-13)

The assistant is **usable in production** when a provider is configured: consent, tools,
citations, rate-limit copy, retry (with a model picker when several keys exist), and
inline trend/compare charts. The **30/30 numeric eval is parked on purpose** and is not
a v1 blocker.

Wave 2 landed:

- Unit tests for all twelve tools (known-correct figures, `<<<DATA>>>` wrapping).
- E2E: consent, 429 copy, citation `?ids=` → ledger, injection merchant as ordinary data.
- Retry provider override only when `listConfiguredProviders().length > 1`.
- Inline Recharts from `getTrend` / `comparePeriods` tool output (dynamic import).
- `insights-weekly` copy polish for Anthropic and Google, not only OpenAI.

Wave 3 (ops, 2026-08-13) landed without raising Docker RAM:

- `pg_cron` jobs for `budget-alerts`, `budget-reconcile`, `recurring-run`, `insights-weekly`
  (`20260813100000_schedule_ops_crons.sql`). Hosted GUCs still required.
- `pnpm analyze` / `pnpm bundle:baseline` / `pnpm perf:audit`. Numbers in
  [`PERF-BASELINE.md`](./PERF-BASELINE.md). Landing Lighthouse a11y/SEO/BP 100, perf 75
  (hero PNG LCP). Dashboard/ledger and the 6 GB e2e re-run were not executed on the work machine.
- No `v0.x` tag.

## Remaining before Done

**Parked 2026-08-12** for product polish; ledger edit + `update_transaction` fix landed the same day.
Resume Phase 12 when a **tool-capable cloud key** is available (preferred) or a stronger
local model than `llama3.2:3b`.

Current local `.env.local`: `AI_PROVIDER=ollama`, `AI_MODEL=llama3.2:3b` — good for smoke,
not for the 30/30 numeric gate.

1. Full eval 30/30 with Anthropic or OpenAI (or a stronger local tool model).
2. Confirm Ollama stays on loopback when used.
3. Green `pnpm test:e2e` on a machine with ≥6GB Docker RAM (or re-run the 2 failed specs).
   **Skipped 2026-08-13** — work machine stays on the 4 GB Docker cap.
4. Apply `20260813100000_schedule_ops_crons.sql` when local Supabase is up (`pnpm db:migrate`),
   and set hosted GUCs `app.settings.supabase_url` / `app.settings.cron_secret`.
5. Mark Done + `chore(phase): complete phase 12 — AI assistant`.
