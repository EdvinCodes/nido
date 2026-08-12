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

## Eval results

Run manually (not CI):

```bash
AI_PROVIDER=ollama pnpm tsx e2e/ai-eval/run.ts
AI_PROVIDER=anthropic pnpm tsx e2e/ai-eval/run.ts
```

Results are written to `e2e/ai-eval/last-results.json`. Phase gate requires **100% numeric
accuracy** on questions that declare expected minors.

Record the latest successful run here when available:

| Provider  | Model                 | Numeric | Date | Notes                                           |
| --------- | --------------------- | ------- | ---- | ----------------------------------------------- |
| ollama    | _(pending local run)_ | —       | —    | Verify no outbound traffic with a local monitor |
| anthropic | _(pending)_           | —       | —    | Optional cloud cross-check                      |

## Remaining before Done

1. Start Docker Desktop, then `pnpm db:reset && pnpm test:db`.
2. Configure `AI_PROVIDER=ollama` (or anthropic), grant consent in the demo space, run
   `pnpm tsx e2e/ai-eval/run.ts` until numeric accuracy is **30/30**.
3. Record provider results in the table above; confirm Ollama stays on loopback.
4. `pnpm test:e2e` with the local stack up.
5. Then mark the phase Done and commit `chore(phase): complete phase 12 — AI assistant`.
