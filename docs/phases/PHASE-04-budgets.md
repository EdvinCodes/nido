# Phase 04 — Budgets and alerts

## Goal

Limits that actually change behaviour: the household sets a monthly cap on groceries, sees
how much they can spend per day for the rest of the period, and gets told — once, calmly,
and immediately — when they cross 80 %.

## Required reading

- [`../02-DATA-MODEL.md`](../02-DATA-MODEL.md) — § 6
- [`../04-FEATURES.md`](../04-FEATURES.md) — § 4
- [`../01-ARCHITECTURE.md`](../01-ARCHITECTURE.md) — § 4 (background jobs)

## Tasks

### 1. Database

1. `nido.budgets` with the scope shape constraint.
2. `nido.budget_periods`.
3. `nido.notifications` and `nido.notification_preferences` (the push table waits for
   Phase 10).
4. `nido.ensure_budget_periods(p_budget_id uuid, p_through date)` — generates missing period
   rows from `starts_on` through the given date, honouring the space's `week_starts_on` and
   `month_starts_on`, and applying rollover from the previous period's unspent amount when
   enabled. Idempotent.
5. `nido.recompute_budget_period(p_period_id uuid)` — recalculates `spent_minor` from the
   ledger. The authoritative definition of "spent".
6. A trigger on `transaction_splits` (insert, update, delete) and on `transactions`
   (category, date, amount, or soft-delete changes) that adjusts `spent_minor` incrementally
   for every affected budget period. Handle the awkward cases explicitly: a transaction
   moved between periods, a category change that moves it between budgets, and a soft delete
   followed by a restore.
7. `nido.evaluate_budget_thresholds(p_period_id uuid)` — compares `spent_minor` against the
   limit and the configured thresholds, inserts a notification for each newly crossed
   threshold and each entitled recipient, and appends to `notified` so it can never fire
   twice for the same threshold in the same period.
8. `nido.suggest_budgets(p_space_id uuid)` — returns proposed limits from the median of the
   last three complete periods per category, rounded up to the nearest 5 or 10.
9. RLS and pgTAP for all of it.

**Spend definition, stated once so it is not reinvented:** a budget consumes
`transaction_splits.base_owed_minor` when its scope includes a participant, and
`transactions.base_amount_minor` when it does not. Only `kind = 'expense'` counts.
Transfers and income never count. Subcategories count when `include_subcategories` is true.

### 2. Background jobs

- Edge Function `budget-alerts`, scheduled hourly by `pg_cron`: ensure periods exist for
  every active budget, evaluate thresholds, and deliver notifications. Guarded by
  `CRON_SECRET`.
- Edge Function `budget-reconcile`, nightly: run `recompute_budget_period` for every open
  period, compare against the trigger-maintained value, correct any drift, and log a warning
  with the budget id when they disagree. Drift means a trigger bug, and this is how it gets
  found before a user does.

Synchronous evaluation also runs inside the transaction Server Action, so an alert triggered
by manual entry appears immediately rather than up to an hour later.

### 3. Budgets UI

`/s/[spaceId]/budgets`:

- Cards sorted by urgency: over limit, then approaching, then healthy, then not started.
- Each card: a `<ProgressRing>`, spent versus limit, remaining, days left, the implied daily
  allowance for the rest of the period, a sparkline of the last six periods, and the scope
  rendered in plain language ("Groceries · everyone · monthly").
- Over-limit cards render the excess portion in `--color-danger` and state the overspend
  amount rather than just showing a full ring.
- Create and edit in a sheet: scope picker that reveals the right fields, amount, period,
  rollover toggle with an explanation, thresholds as chips, start and optional end date, and
  a live preview of what the budget would have looked like over the last three periods
  against real data. That preview is what stops people setting unrealistic limits.
- A "suggest budgets" flow presenting the computed proposals with accept-all and per-row
  accept.
- Budget detail: period history chart, the transactions that consumed it, and a per-category
  breakdown when the scope is broader than one category.

### 4. Notifications UI

- A bell in the app header with an unread count, opening a popover grouped by day, with
  mark-as-read, mark-all-as-read, and a link through to the subject of each notification.
- Realtime subscription so a notification appears without a refresh.
- `/s/[spaceId]/settings/notifications`: the kind × channel matrix, with email and push rows
  present but disabled and labelled until Phase 10 enables them.
- In-app toast for a threshold crossed while the user is looking at the app, using the
  neutral copy from the design system.

### 5. Dashboard integration

The right rail's placeholder becomes real: budgets needing attention, sorted by severity,
each linking to its detail. The category list on the dashboard shows a mini progress bar
against the relevant budget where one exists.

## Acceptance criteria

- [ ] Every scope combination works and computes the correct spend, verified against
      hand-calculated values on the seed data.
- [ ] Adding a transaction updates the affected budget's progress immediately, without a
      page reload.
- [ ] Editing a transaction's category, amount, or date moves the spend between budgets and
      between periods correctly.
- [ ] Soft-deleting and restoring a transaction leaves `spent_minor` exactly where it started.
- [ ] Each threshold notifies exactly once per period, proven by a test that crosses 80 %,
      drops below, and crosses again.
- [ ] Rollover carries unspent budget into the next period with the right arithmetic.
- [ ] The nightly reconciliation finds zero drift after a scripted sequence of 200 random
      creates, edits, category changes, and deletes. This is the strongest test in the phase
      and it must pass.
- [ ] Weekly budgets respect the space's week start; monthly budgets respect its month start.
- [ ] `pnpm verify`, `pnpm test:db`, `pnpm test:e2e` pass.

## Out of scope

Web push and email delivery (Phase 10) — notifications are in-app only for now. AI-generated
budget advice (Phase 12).

## Verification

```bash
pnpm db:reset && pnpm verify && pnpm test:db && pnpm test:e2e
pnpm tsx scripts/budget-fuzz.ts   # the 200-operation drift test, committed with the phase
```
