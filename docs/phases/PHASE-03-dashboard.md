# Phase 03 — Dashboard and analytics

## Goal

The screen that answers "how are we doing?" in three seconds. Everything on it is computed
in Postgres in a single round trip, respects the space's custom month start, and can be
clicked through to the transactions behind it.

## Required reading

- [`../02-DATA-MODEL.md`](../02-DATA-MODEL.md) — § 15
- [`../04-FEATURES.md`](../04-FEATURES.md) — § 3
- [`../03-DESIGN-SYSTEM.md`](../03-DESIGN-SYSTEM.md) — §§ 6, 7, 8

## Tasks

### 1. Aggregation in SQL

`nido.space_summary(p_space_id uuid, p_from date, p_to date, p_participant_id uuid default null)`
returns one JSON document containing:

- Totals: income, expenses, net, transaction count, savings rate.
- The same totals for the immediately preceding equivalent period, for deltas.
- A daily series of income, expenses, and cumulative net across the range.
- Per-category breakdown: id, name, colour, icon, total, share, count, and the change
  versus the previous period, for expenses and income separately.
- Per-participant breakdown: paid and owed per participant.
- Top merchants with total and count.
- Account balances.

Written as one function with CTEs, not several round trips. Transfers are excluded
everywhere. Amounts use `base_amount_minor`.

`nido.space_series(p_space_id, p_from, p_to, p_granularity)` returns a time series bucketed
by day, week, or month for the evolution chart, generating empty buckets so the chart has no
gaps.

Both functions are `stable`, respect RLS through the calling user's context, and are covered
by pgTAP tests against the deterministic seed with hand-computed expected values.

### 2. Period handling

- A global `<PeriodPicker>` in the app header whose state lives in the URL and persists to
  the profile as the user's default.
- Presets: this month, last month, last three months, this year, last year, custom range.
- "Month" honours `spaces.month_starts_on`. When it is not 1, the picker labels the period
  with its real boundaries ("25 Jul – 24 Aug") and a tooltip explains the household's month
  setting.
- All period maths uses `src/lib/dates` in the space's timezone. A pgTAP test and a Vitest
  test both cover a space with `month_starts_on = 25` across a DST change.

### 3. Chart primitives

`src/components/charts/`, wrapping Recharts so no feature imports it directly. Each accepts
data already in the right shape, applies the design tokens, and ships with a skeleton, an
empty state, and a visually hidden data table for accessibility plus a toggle to show it.

`<AreaTrend>`, `<GroupedBars>`, `<CategoryDonut>`, `<HorizontalBars>`, `<StackedBars>`,
`<Sparkline>`, `<CalendarHeatmap>`. All are dynamically imported so Recharts stays out of
the initial bundle.

### 4. The dashboard

`/s/[spaceId]` built exactly as [`../04-FEATURES.md`](../04-FEATURES.md) § 3 describes: the
four summary cards with deltas and sparklines, the evolution chart with the previous period
ghosted, the category donut with a ranked list beside it, the participant and merchant
section, and a right rail that currently holds only the account balances and a placeholder
for the alerts arriving in Phase 04.

Interaction rules that matter:

- Every number and every chart segment is a link into the ledger with the equivalent
  filters already applied. This is the feature that makes the dashboard useful rather than
  decorative, and it must work everywhere without exception.
- Each section is its own `Suspense` boundary with a skeleton matching its final dimensions,
  so the page never shifts as data arrives.
- A brand-new space shows a designed empty state with a single call to action, not four
  cards full of zeros.
- Solo spaces hide the participant breakdown entirely.

### 5. Search and command palette

`⌘K` / `Ctrl+K` opens `cmdk` with: navigation to every route, full-text transaction search
returning results with amount and date, "add expense", "add income", and space switching.
Search hits the GIN index through a `nido.search_transactions(p_space_id, p_query, p_limit)`
function, debounced at 200 ms.

### 6. Performance

- Measure the dashboard route's initial JavaScript and record it in the phase notes. Budget:
  under 180 KB gzipped.
- Cache the summary with `unstable_cache` keyed by space, period, and participant, tagged so
  writing a transaction invalidates exactly the affected periods and nothing else.
- Lighthouse on the dashboard with the seeded data: performance ≥ 95, accessibility 100.

## Acceptance criteria

- [ ] The full dashboard renders from a single call to `nido.space_summary` plus one series
      call. Verify by counting queries in the Supabase logs.
- [ ] Every figure matches a manual calculation over the seed data, to the cent.
- [ ] Deltas versus the previous period are correct, including for a partial current month.
- [ ] A space with `month_starts_on = 25` produces correct boundaries and labels.
- [ ] Clicking any chart segment or any category row lands on the ledger with the right
      filters applied and the right rows shown.
- [ ] Every chart has a keyboard-accessible data table alternative and no axe violations.
- [ ] Charts do not appear in the initial JavaScript bundle.
- [ ] Lighthouse targets met on mobile emulation with the seeded space.
- [ ] `pnpm verify`, `pnpm test:db`, `pnpm test:e2e` pass.

## Out of scope

Budget cards and alerts (Phase 04), goal progress (Phase 05), unsettled balances (Phase 06),
AI insights (Phase 12), and PDF or Excel export (Phase 09). The right rail leaves labelled
space for them.

## Verification

```bash
pnpm db:reset && pnpm verify && pnpm test:db && pnpm test:e2e
pnpm dlx lighthouse http://localhost:3000/s/<seeded-space-id> --preset=desktop
```
