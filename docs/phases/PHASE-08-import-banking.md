# Phase 08 — Import and bank sync

## Goal

Get history in without typing it. A bank statement CSV becomes correctly categorized
transactions in three clicks, duplicates are caught, and the categorization rules learn from
corrections. Automatic bank sync is the same pipeline with a different source, and it is
strictly optional.

## Required reading

- [`../02-DATA-MODEL.md`](../02-DATA-MODEL.md) — § 11
- [`../04-FEATURES.md`](../04-FEATURES.md) — § 9
- [`../07-ADR.md`](../07-ADR.md) — ADR-009

## Tasks

### 1. Database

1. `nido.import_batches` and `nido.import_rows`.
2. `nido.categorization_rules`.
3. `nido.bank_connections` and `nido.bank_accounts`.
4. `nido.apply_categorization_rules(p_space_id uuid, p_text text, p_merchant text)` returning
   the winning category and merchant override by priority.
5. `nido.find_duplicate(p_space_id uuid, p_fingerprint text, p_booked_on date, p_amount bigint)`
   implementing exact `external_id` matching first, then fingerprint matching within a ±3 day
   window.
6. `nido.commit_import(p_batch_id uuid)` — a single transactional commit of every row marked
   `import`, calling `nido.create_transaction` for each so splits and invariants are
   identical to manual entry. All or nothing.
7. `nido.undo_import(p_batch_id uuid)` — soft-deletes everything the batch created, allowed
   within 24 hours.
8. RLS and pgTAP throughout.

### 2. Parsing

`src/features/imports/lib/`, pure and unit-tested against committed fixtures from real
Spanish banks (BBVA, Santander, CaixaBank, ING, Revolut, N26) with the account numbers
redacted:

- Encoding detection (UTF-8, Latin-1, UTF-16) and BOM handling.
- Delimiter sniffing for comma, semicolon, and tab.
- Header row detection, including files with several junk rows above the header.
- Date parsing for `DD/MM/YYYY`, `YYYY-MM-DD`, `DD-MM-YY`, and `DD.MM.YYYY`, resolved
  against the file as a whole rather than row by row, so `03/04` is not ambiguous.
- Amount parsing for comma decimals, dot thousands separators, trailing minus signs,
  parenthesised negatives, and separate debit and credit columns.
- Merchant normalization: strip card terminal noise, reference numbers, dates embedded in
  the description, and repeated whitespace, then title-case. This is what makes rule
  matching and duplicate detection actually work.
- XLSX via SheetJS, using the first sheet by default with a sheet picker.

### 3. Import flow

`/s/[spaceId]/import`, a four-step wizard:

1. **Upload.** Drag and drop or pick. Show the detected encoding, delimiter, and row count.
2. **Map.** Source columns on the left, Nido fields on the right, pre-guessed from header
   names and content sniffing. Live preview of the first five parsed rows updating as the
   mapping changes. Save the mapping under a name so the next statement from the same bank
   is one click. Choose the target account here.
3. **Preview.** Every row with its parsed values, its rule-assigned category, and a
   duplicate badge where relevant. Inline editing of any cell. Bulk actions: set the category
   for all selected, skip all duplicates, skip all below an amount. Counters at the top for
   to-import, to-skip, and duplicate.
4. **Commit.** A summary, then the single transactional commit, then a result screen with
   the numbers and an undo button that remains available for 24 hours.

### 4. Rules engine

- Rules are applied during preview, in priority order, first match wins.
- When a user changes a category on a previewed or imported row, a toast offers "always
  categorize MERCADONA as Groceries", creating an auto-learned rule with a `contains` match
  on the normalized merchant.
- `/s/[spaceId]/settings/rules`: list with hit counts, reorder by priority, edit, test a
  rule against the existing ledger to see what it would have matched, and bulk-apply a rule
  retroactively to uncategorized transactions.

### 5. Bank sync (optional)

- The provider interface from [`../04-FEATURES.md`](../04-FEATURES.md) § 9, in
  `src/features/banking/lib/provider.ts`, with `enablebanking` and `none` implementations
  selected by `BANK_PROVIDER`. Every call site depends on the interface, never on the
  implementation.
- Connection flow: pick a country, search institutions, redirect to the bank's consent page,
  return through `/api/webhooks/bank/callback`, list the discovered accounts, and map each to
  a Nido account (or create one).
- Edge Function `bank-sync`, every six hours plus a manual refresh: fetch transactions since
  the last sync, write them into `import_rows` with `source = 'bank:<provider>'`, run dedupe
  and rules, and either present them for review or auto-commit when the space has enabled
  that and confidence is high.
- Consent expiry: PSD2 consents last 90 days. Show a banner ten days before expiry with a
  one-click renewal, and mark the connection `expired` when it lapses.
- Error handling: a failed sync sets `last_error`, notifies once, and does not retry in a
  loop. Never store bank credentials — only the provider's session reference.
- With `BANK_PROVIDER=none`, every entry point is hidden and the settings page explains what
  it would do and how to enable it.

### 6. Export

The counterpart, so nobody feels trapped: export the current ledger view to CSV and XLSX
respecting the active filters, and export the entire space to JSON in a documented shape
that `nido.import` can read back. This is a hard requirement for an open-source project.

## Acceptance criteria

- [ ] Every committed bank fixture parses correctly: right dates, right signs, right amounts,
      right descriptions. One test per fixture with expected values checked in.
- [ ] Ambiguous dates resolve correctly using file-wide inference; a file that is genuinely
      ambiguous asks the user rather than guessing.
- [ ] Importing the same file twice imports zero rows the second time.
- [ ] A near-duplicate two days apart with the same amount and merchant is flagged but can
      be forced through.
- [ ] Commit is atomic: an induced failure on row 400 of 500 leaves zero transactions created.
- [ ] Undo within 24 hours removes exactly the batch's transactions and nothing else.
- [ ] Creating a rule from a correction causes the next import to categorize that merchant
      automatically.
- [ ] A 5 000-row file imports in under thirty seconds without freezing the browser.
- [ ] With `BANK_PROVIDER=none` the app has no broken links and the settings page explains
      the feature clearly.
- [ ] Round trip: export a space to JSON, import it into a fresh space, and the two are
      identical apart from ids.
- [ ] `pnpm verify`, `pnpm test:db`, `pnpm test:e2e` pass.

## Out of scope

Payment initiation, credit-card statement reconciliation against individual card
transactions, and receipt-to-bank-line matching. Backlog them.

## Verification

```bash
pnpm db:reset && pnpm verify && pnpm test:db && pnpm test:e2e
```

Manual: import each fixture in `e2e/fixtures/statements/` through the real UI and compare
against the expected output committed beside it.
