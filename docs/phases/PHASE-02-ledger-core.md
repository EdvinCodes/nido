# Phase 02 — Ledger core

## Status note

**Done** (2026-08-10). Core ledger shipped: schema/RPCs/RLS/pgTAP, domain + actions,
composer, virtualized ledger with URL filters (incl. `hasAttachment` stub for Phase 07),
accounts settings, realtime highlight, ⌘K palette, swipe/long-press bulk delete,
Playwright coverage. Perf seed of 10k rows remains in `docs/BACKLOG.md`.

---

## Goal

The heart of the product. After this phase two people can record every expense, income, and
transfer in their household, split any way they want, with the guarantee that splits always
sum exactly to the total. This is the phase that most determines whether the app is
trustworthy, and it deserves the most care.

## Required reading

- [`../02-DATA-MODEL.md`](../02-DATA-MODEL.md) — §§ 1, 4, 5, 14, 15
- [`../04-FEATURES.md`](../04-FEATURES.md) — § 2, § 13
- [`../03-DESIGN-SYSTEM.md`](../03-DESIGN-SYSTEM.md) — § 6

## Tasks

### 1. Database

1. `nido.accounts`.
2. `nido.transactions`, with every constraint, index, and the soft-delete convention.
3. `nido.transaction_splits`.
4. `nido.tags` and `nido.transaction_tags`.
5. **The balance invariant.** A deferred constraint trigger on `transaction_splits` (and on
   `transactions.amount_minor` updates) that raises unless
   `sum(owed_minor) = transactions.amount_minor` for every affected transaction. Deferred to
   the end of the statement so a multi-row insert is legal mid-flight. Include the
   transaction id and both figures in the error message.
6. `nido.v_transactions` — the base table filtered to `deleted_at is null`, joined to
   category, account, payer, and an aggregated splits array. Application code reads this
   view, never the base table.
7. RLS on all new tables using the canonical set. `transaction_splits` carries a
   denormalized `space_id` specifically so its policies do not need a join.
8. Audit triggers on transactions and splits.
9. `nido.create_transaction(p jsonb)` — a `security definer` RPC that inserts the
   transaction and its splits atomically, computing splits server-side from the mode and
   weights using `nido.allocate`. The client sends intent, not pre-computed cents. This
   closes the door on a buggy or malicious client writing an unbalanced transaction, and it
   is the same code path recurring rules and imports will use later.
10. `nido.update_transaction(p_id uuid, p jsonb)` and `nido.delete_transaction(p_id uuid)`
    (soft) with an equivalent restore.
11. Extend `seed.sql`: four accounts and three months of realistic transactions across all
    five split modes, deterministic.

### 2. Domain logic

`src/features/transactions/lib/`, all pure, all unit-tested:

- `computeSplits(amountMinor, mode, participants)` → `{ participantId, weight, owedMinor }[]`,
  the TypeScript mirror of the server logic, used for live preview in the editor. A test
  asserts it agrees with the SQL function across a shared fixture set.
- `validateSplit(mode, inputs, amountMinor)` → a discriminated result carrying the exact
  remainder and a translatable error key.
- `weightsFromMode(mode, participants, previous)` — how weights are derived and preserved
  when the user switches modes.
- `transactionFingerprint(tx)` — the deduplication hash Phase 08 will reuse.

### 3. Server actions and queries

`src/features/transactions/`:

- `actions.ts`: `createTransaction`, `updateTransaction`, `deleteTransaction`,
  `restoreTransaction`, `duplicateTransaction`, `bulkUpdateCategory`, `bulkDelete`. Every one
  wrapped in `authedAction`, Zod-validated, idempotent via a client request id, and
  finishing with the right `revalidateTag`.
- `queries.ts`: a `listTransactions` server query taking the full filter object with cursor
  pagination, and a matching TanStack Query hook for client-side pages.
- `schemas.ts`: one `transactionSchema` shared by the form, the actions, and later the AI tools.

Accounts get their own feature folder with CRUD, archive, reorder, and a
`nido.account_balance(account_id)` function summing the opening balance with all
non-deleted transactions touching it, transfers included and signed correctly.

### 4. The transaction form

The single most important UI in the product. Build it as a sheet on mobile and a dialog on
desktop, reachable from the FAB, the ⌘K palette, and the ledger's add button.

Fast path: amount, category, save. Everything else defaulted and collapsed.

- `<AmountInput>` with a mobile numeric keypad, locale-aware decimal separator, inline
  arithmetic evaluated on blur (`12,50+3` → `15,50`), and a currency selector that defaults
  to the space base currency. It emits minor units, never a float.
- Category picker showing the user's six most-used categories first, then the full tree,
  with search and an inline "create category" affordance.
- Date defaults to today with quick chips for yesterday and the day before, plus a calendar.
- Kind switcher (expense / income / transfer) that reshapes the form: transfers swap the
  category and split sections for a destination account and hide the payer.
- `<SplitEditor>` implementing every rule in [`../04-FEATURES.md`](../04-FEATURES.md) § 2,
  with a live remainder indicator and a save button that is disabled with an inline
  explanation whenever the split does not balance.
- Advanced section: description, merchant, account, tags, notes.
- Optimistic insert via `useOptimistic`, so the row appears instantly and reconciles or
  rolls back with a toast on failure.

### 5. The ledger page

`/s/[spaceId]/ledger`:

- Virtualized infinite list grouped by day with per-day subtotals, 50 rows per page.
- Row layout exactly as specified in [`../04-FEATURES.md`](../04-FEATURES.md) § 2.
- Filter bar: date range, kind, categories, participants, accounts, tags, amount range,
  has-attachment, shared-only, mine-only, and full-text search — all in the URL via `nuqs`,
  all rendered as removable chips, with a "clear all" and a saved-views affordance deferred
  to the backlog.
- Detail sheet with the split breakdown, the audit trail, and the full action set.
- Mobile swipe gestures and long-press multi-select with a bulk action bar.
- Realtime subscription to the space's transactions, inserting remote changes with the
  highlight animation from the design system.
- Undo toast for 8 seconds after any delete.
- Genuine loading, empty, and error states.

### 6. Tests

- pgTAP: the balance invariant cannot be violated by any insert, update, or delete path;
  the RLS negative cases for transactions, splits, accounts, and tags; `create_transaction`
  rolls back fully on a bad split; a transfer with a category is rejected; a non-transfer
  without a payer is rejected.
- Vitest: the full split matrix — every mode against 1, 2, 3, and 5 participants, at
  amounts of 1 cent, 10,00 €, 33,33 €, and 999 999,99 €, asserting exact sums every time.
- Playwright: add an expense split three ways and verify the ledger row, the detail sheet
  figures, and the persisted database rows; edit it to a different mode; delete and undo;
  record a transfer and confirm it does not appear in any income or expense total.

## Acceptance criteria

- [x] An expense can be created in under ten seconds on a mobile viewport using only the
      fast path, and it appears in the ledger immediately.
- [x] All five split modes work, and no combination of inputs can produce splits that do
      not sum exactly to the total — attempting it via a direct RPC call is rejected by the
      database.
- [x] Transfers are excluded from income and expense figures and from all splits.
- [x] Every filter works, combines with the others, survives a page reload, and is
      shareable as a URL. (`hasAttachment` is URL-wired; real matches arrive in Phase 07.)
- [ ] Ten thousand seeded transactions scroll at 60 fps and the page still loads under 1.5 s.
      — deferred to `docs/BACKLOG.md` (demo seed ~150 rows; full 10k seed is too slow for
      every `db:reset`).
- [x] A transaction added by one member appears on the other's open ledger within a second.
- [x] Soft delete plus undo works, and a deleted transaction is excluded from every query.
- [x] `pnpm verify`, `pnpm test:db`, and `pnpm test:e2e` pass.

## Out of scope

Attachments (Phase 07), recurring rules (Phase 05), balances (Phase 06), any chart or
aggregate view (Phase 03), currency conversion — a transaction may carry a non-base
currency, but `base_amount_minor` is set with a rate of 1 until Phase 09.

## Verification

```bash
pnpm db:reset && pnpm verify && pnpm test:db && pnpm test:e2e
```

Manual: attempt `select nido.create_transaction(...)` from the SQL editor with percentages
summing to 99 and confirm it fails with a clear error.
