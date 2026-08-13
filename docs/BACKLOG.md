# Backlog

Anything discovered during a phase that does not belong to it. One line per item: what,
why it was deferred, and where it should land. Do not build from this file directly —
promote an item into a phase file first.

## Format

```
- [ ] <what> — deferred from Phase NN because <reason>. Target: Phase MM / post-v1.
```

## Open

- [x] Wire transaction composer `edit` mode — done 2026-08-12 with `update_transaction` balance fix.
- [ ] Phase 12 AI eval gate (30/30 numeric + Ollama outbound proof + full e2e green) — parked 2026-08-12, confirmed 2026-08-13; not blocking v1. Needs a tool-capable cloud key (Anthropic/OpenAI) or a stronger local model than `llama3.2:3b`. Target: Phase 12 resume.
- [x] Product polish pass on shipped app (empty/loading/error consistency, a11y, mobile budgets/ledger friction) — first pass 2026-08-12 (`2f648da`); second pass 2026-08-13 (hreflang, banking CTA, empty states, view transitions, count-up, ledger scroll restore, changelog fallback).
- [ ] Perf seed of 10k transactions for ledger virtualization FPS checks — deferred from Phase 02 because seeding 10k via `create_transaction` on every `db:reset` is too slow; demo seed keeps ~150 realistic rows. Target: tooling / Phase 02 follow-up.
- [x] Wire `hasAttachment` ledger filter to real attachment rows — done in Phase 07.
- [ ] Re-run Lighthouse (perf ≥ 95, a11y 100) on a production `pnpm start` build of the seeded dashboard — deferred from Phase 03 because local `pnpm dev` is not a valid perf baseline; axe e2e already covers a11y. Target: Phase 03 follow-up / CI.
- [x] Fix `nido.update_transaction` so amount changes update splits before the balance trigger fires (or defer the check) — done 2026-08-12 (`20260812120000_fix_update_transaction_balance.sql`).
- [ ] Schedule `budget-alerts` (hourly) and `budget-reconcile` (nightly) via `pg_cron` against deployed Edge Function URLs — deferred from Phase 04 because local cron→functions wiring needs project-specific URLs and `CRON_SECRET`. Target: deploy / Phase 10 ops.
- [ ] Schedule `recurring-run` daily (space-local 03:00) via `pg_cron` against the Edge Function URL — deferred from Phase 05 for the same deploy/ops reason as budget cron. Target: deploy / Phase 10 ops.
- [ ] SQL trigger cannot delete `storage.objects` (protect_delete); attachment file removal stays in the app/Edge Storage API — deferred from Phase 07 schema because Postgres forbids direct storage deletes. Target: Phase 07 Edge purge.

## Post-v1 ideas

- [ ] Native app with Expo, sharing the domain logic package. See ADR-008.
- [ ] Shared shopping list that converts to an expense on checkout.
- [ ] Splitwise and Tricount import, so people can migrate their history in.
- [ ] Household inventory and warranty tracking off the back of receipt photos.
- [ ] Per-category spending forecasts from historical seasonality.
- [ ] Multi-space consolidated view for someone who runs two households.
- [ ] Apple Wallet pass or a Shortcuts action for one-tap expense capture on iOS.
- [ ] Voice capture: "add twelve euros, groceries, split with Ana".
- [ ] Public anonymised benchmark: how does our grocery spend compare with similar households.
