# Phase 09 — Multi-currency and reports

## Goal

A trip abroad no longer breaks the analytics, and the household gets a real monthly close
they can read, export, and keep.

## Required reading

- [`../02-DATA-MODEL.md`](../02-DATA-MODEL.md) — §§ 1, 10
- [`../04-FEATURES.md`](../04-FEATURES.md) — §§ 10, 11

## Tasks

### 1. Currency

1. `nido.exchange_rates` and the full `nido.currencies` seed with correct exponents.
2. `nido.convert(p_amount bigint, p_from, p_to, p_on date)` using the most recent rate at or
   before the date, falling back to the oldest known rate and flagging that it did so.
   Identity conversion returns the input untouched — never round-trip a same-currency amount
   through a rate.
3. A trigger on `transactions` computing `base_amount_minor` and `base_rate` at insert and
   whenever amount, currency, or date changes, unless the user supplied a manual rate.
4. `nido.backfill_base_amounts(p_space_id uuid)` to fix historical rows written before this
   phase, when `base_rate` was 1. Run it in the migration for every existing space.
5. Edge Function `fx-refresh`, daily: pull ECB rates from Frankfurter for every currency in
   use across all spaces and upsert them. No API key required. Failure is logged and
   non-fatal — the last known rate keeps working.
6. pgTAP covering conversion, the fallback path, and the backfill.

### 2. Currency UI

- The amount input's currency selector lists the space base currency and recently used
  currencies first, then all.
- Converted amounts render with a `≈` marker; the tooltip shows the original amount, the
  rate, and the rate date.
- A per-transaction manual rate override, because card issuers never use the ECB reference
  rate. Overridden transactions are marked so it is clear the figure is not derived.
- Account balances display in the account's own currency with the base equivalent beneath.
- Space settings can change the base currency, which triggers a full backfill behind a
  confirmation explaining that every historical figure will be recomputed.

### 3. Monthly close

1. `nido.period_snapshot(p_space_id uuid, p_from date, p_to date)` returning the complete
   close document: totals, savings rate, category and participant breakdowns, budget
   performance, goal progress, subscription cost, settlement activity, and the three largest
   changes versus the previous period with their drivers.
2. Edge Function `period-close`, running on the first day of each space's period: generate
   the snapshot, store it, and create a notification.
3. `/s/[spaceId]/reports`: a list of closed periods and a detail view rendering the snapshot
   as a designed report, not a wall of tables.

### 4. Comparison

`/s/[spaceId]/reports/compare`: pick any two periods and see them side by side — totals with
deltas, per-category comparison sorted by absolute impact, a diverging bar chart, and a plain
sentence naming what actually drove the difference ("Groceries up 87 €, Eating out down 42 €").

### 5. Savings rate

`(income − expenses) / income` per period, tracked as a line chart over time on the reports
page and as a headline figure on the monthly close. Handle the awkward cases: zero income
(show `—`, not infinity) and negative net (show the negative rate, labelled).

### 6. Exports

- **PDF** with `@react-pdf/renderer`, generated server-side: a cover page with the household
  name, period, and base currency; a summary page; category and participant breakdowns with
  charts rendered as images; budget performance; and a full transaction appendix. Typography
  matching the design system. It should look like something you would send to an accountant.
- **XLSX** with SheetJS: sheets for transactions, splits, a categories pivot, budgets,
  subscriptions, and settlements, with real Excel formatting — frozen headers, currency
  number formats, and column widths.
- **CSV** of the current ledger view.
- Every export respects the active filters, so "export what I am looking at" is true.
- Generation happens in a Server Action with a progress state; large exports stream rather
  than buffering the whole document in memory.

### 7. Email delivery (optional)

If `RESEND_API_KEY` is set, the monthly close can be emailed as an HTML summary with the PDF
attached, per user preference. Without the key, the feature is hidden.

## Acceptance criteria

- [ ] A transaction in GBP inside a EUR space shows the original amount, converts correctly
      at the rate for its date, and contributes the converted value to every analytic.
- [ ] Changing today's exchange rate does not alter any historical figure.
- [ ] Changing the space base currency recomputes every historical row correctly and the
      dashboard totals change accordingly.
- [ ] A currency with a non-2 exponent (JPY) formats and computes correctly end to end.
- [ ] `fx-refresh` populates rates and the app keeps working with the network disconnected.
- [ ] The monthly close figures match the dashboard for the same period, to the cent.
- [ ] The PDF renders correctly with 500 transactions and does not exceed 5 MB.
- [ ] The XLSX opens in Excel and LibreOffice with formatting intact and no repair prompt.
- [ ] Comparison deltas are arithmetically correct, including for categories present in only
      one of the two periods.
- [ ] `pnpm verify`, `pnpm test:db`, `pnpm test:e2e` pass.

## Out of scope

Crypto assets, investment valuation, and per-currency budgets — budgets stay in the space
base currency.

## Verification

```bash
pnpm db:reset && pnpm verify && pnpm test:db && pnpm test:e2e
```

Manual: create transactions in EUR, GBP, USD, and JPY on different dates, then verify each
converted figure against the ECB rate for that date.
