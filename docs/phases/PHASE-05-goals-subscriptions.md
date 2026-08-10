# Phase 05 — Goals and subscriptions

## Goal

Two features that share one engine. Savings goals give the household something to aim at;
recurring rules stop money leaking out unnoticed. Both are built on the same scheduling and
materialization machinery.

## Required reading

- [`../02-DATA-MODEL.md`](../02-DATA-MODEL.md) — §§ 7, 8
- [`../04-FEATURES.md`](../04-FEATURES.md) — §§ 5, 6

## Tasks

### 1. Database — goals

1. `nido.goals` and `nido.goal_contributions`.
2. A trigger maintaining `goals.saved_minor` from contributions, and flipping `status` to
   `reached` with a notification for every active member when the target is met.
3. `nido.goal_projection(p_goal_id uuid)` returning required monthly amount, current
   average monthly contribution over the last three months, projected completion date, and
   whether the goal is on pace.
4. RLS and pgTAP.

### 2. Database — recurring rules

1. `nido.recurring_rules` and `nido.recurring_price_changes`.
2. `nido.next_occurrence(p_rule nido.recurring_rules, p_after date)` — the scheduling
   function. Handle every awkward case explicitly and test each one: the 31st in February
   (clamp to the last day), `by_month_day = -1` (last day of month), intervals greater than
   one, weekly rules honouring the space's week start, and end dates.
3. `nido.materialize_recurring(p_rule_id uuid, p_through date)` — generates the missing
   transactions by calling the same `nido.create_transaction` used by the UI, applying the
   rule's `split_config`, advancing `next_run_on`, and detecting price changes. Idempotent
   via a unique index on `(recurring_rule_id, booked_on)`.
4. `nido.detect_recurring_candidates(p_space_id uuid)` — finds groups of three or more
   transactions with a similar normalized merchant, an amount within ±5 %, and a consistent
   interval within ±3 days, excluding any already linked to a rule.
5. `nido.detect_ghost_subscriptions(p_space_id uuid)` implementing the heuristic from
   [`../02-DATA-MODEL.md`](../02-DATA-MODEL.md) § 8, with snooze state stored on the rule.
6. RLS and pgTAP.

### 3. Background job

Edge Function `recurring-run`, scheduled daily at 03:00 in each space's timezone:

- Materialize every active rule with `auto_create = true` and `next_run_on <= today`.
- For rules with `auto_create = false`, create only a `recurring_due` notification.
- Emit `recurring_due` reminders for anything falling within `reminder_days_before`.
- Emit `recurring_price_change` notifications where a change was detected.
- Fully idempotent: running it three times in a row must produce exactly the same database
  state as running it once. Assert this in a test.

### 4. Goals UI

`/s/[spaceId]/goals`:

- Cards with progress bar, saved and remaining, target date, and the pace sentence from
  `goal_projection` ("You need 220 €/month; you have averaged 180 €/month"). Colour the pace
  sentence, never the whole card, so the screen stays calm.
- Create and edit sheet with name, target, currency, date, colour, icon, and optional linked
  account.
- Contribution flow: amount, participant, date, optional note, and an option to record it as
  a real transfer transaction rather than a bare contribution.
- Withdrawals as negative contributions, requiring a reason.
- Detail view: contribution history by participant, a cumulative progress chart, and the
  projection.
- Reaching a goal fires a single restrained celebration that respects
  `prefers-reduced-motion`.

### 5. Subscriptions UI

`/s/[spaceId]/subscriptions`:

- Header with monthly total, annualised total, and the count of active rules. The annualised
  number is the emotionally important one — make it prominent.
- Grouped by cycle, each row showing merchant, amount, cycle, next charge, split, total paid
  to date, and a price-trend sparkline where history exists.
- A month calendar of upcoming charges with per-day totals.
- Create from scratch, from an existing transaction, or by accepting a detected candidate.
  Detected candidates appear as dismissible cards, never as automatic creations.
- Detail view: full charge history, price change timeline, split configuration, and the
  cancellation flow with an optional URL.
- Cancelled rules in a collapsed section showing the annual amount saved.
- Ghost subscription cards phrased as the three-option question from
  [`../04-FEATURES.md`](../04-FEATURES.md) § 6. Never accusatory.

### 6. Dashboard integration

Upcoming charges in the next fourteen days and active goal progress join the right rail.

## Acceptance criteria

- [ ] `next_occurrence` is correct for every case listed, with a test per case, including a
      monthly rule on the 31st running through a leap February.
- [ ] Running `recurring-run` three times produces one transaction per due occurrence, not three.
- [ ] Generated transactions carry correct splits, matching what the same configuration
      would produce through the UI.
- [ ] A generated transaction whose amount differs by more than 1 % records a price change,
      updates the rule, and notifies.
- [ ] Candidate detection finds the deliberately planted repeating series in the seed data
      and produces no false positives on the rest of it.
- [ ] Goal projection maths is correct, including when the target date has already passed.
- [ ] A goal reaching its target notifies every active member exactly once.
- [ ] The annualised subscription total matches a manual calculation across mixed cycles.
- [ ] `pnpm verify`, `pnpm test:db`, `pnpm test:e2e` pass.

## Out of scope

Push and email delivery (Phase 10). AI-driven ghost detection refinement (Phase 12) — the
deterministic heuristic is enough here.

## Verification

```bash
pnpm db:reset && pnpm verify && pnpm test:db && pnpm test:e2e
pnpm supabase functions serve recurring-run   # invoke three times, diff the database
```
