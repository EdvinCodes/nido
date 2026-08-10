# 04 — Functional specification

Screen by screen, with the rules that are easy to get wrong. Read the section for the
feature you are building; you do not need the whole file.

---

## 1. Onboarding

A new user lands on `/` (landing), clicks *Start free*, and signs up with email + password,
a magic link, or Google. Email confirmation is required in production and disabled locally.

Immediately after the first sign-in, a three-step onboarding runs. It cannot be skipped,
because a user without a space has nothing to look at.

1. **Who is this for?** Solo · Couple · Flatshare. This sets `spaces.kind` and pre-fills
   defaults: solo hides the balances tab and defaults every split to `personal`; couple
   creates two participants and defaults splits to `equal`; flatshare asks how many people
   and creates that many participants.
2. **Your household.** Space name, base currency (guessed from locale), timezone (guessed
   from the browser), the day the month starts on, and the names of the other participants.
   Participants created here without an email are ghost participants; each gets an
   *Invite* button for later.
3. **What do you spend on?** The default category tree is shown pre-selected as chips; the
   user deselects what does not apply and can add their own. Choosing nothing still seeds
   the defaults, because an empty category list makes the app unusable.

On completion the space is created, categories and participants are seeded, and the user
lands on an empty dashboard with a prominent, friendly first-transaction prompt.

**Space switching.** A user can belong to several spaces (their own solo space plus the
shared flat). The switcher lives at the top of the sidebar and on mobile in the header. The
active space is a URL segment (`/s/[spaceId]/...`), so links are shareable and the browser
back button works correctly.

---

## 2. Ledger

The list of everything that happened. Default view: the current period, newest first,
grouped by day with a per-day subtotal header.

Each row shows: category icon in the category colour, description or merchant, payer
avatar, split indicator (an avatar stack when shared), a receipt paperclip when there is an
attachment, and the amount right-aligned, coloured by direction, tabular.

**Filters** — all in the URL, all combinable, all shown as removable chips above the list:
date range, kind, categories (multi), participants (payer and/or involved), accounts, tags,
amount range, "has attachment", "shared only", "mine only", and full-text search.

**Interactions.** Tap a row to open the detail sheet. Swipe left on mobile for
duplicate/delete, swipe right to edit. Long press for multi-select, which enables bulk
recategorize, bulk tag, bulk delete, and bulk export. Infinite scroll, virtualized, 50 rows
per page.

**Detail sheet** shows everything, plus the split breakdown per participant, the attachment
gallery, the audit trail ("Edvin changed the category 3 days ago"), and actions: edit,
duplicate, split into two transactions, convert to a recurring rule, delete.

### Creating a transaction

The fast path has exactly three required inputs: **amount, category, and — if shared —
who**. Everything else is defaulted and collapsed behind *More details*.

Defaults: today's date, the space base currency, the current user as payer, the space's
default split mode, and the most recently used account. The category picker shows the six
most-used categories for this user first.

The full form: kind (expense / income / transfer), amount and currency, date, description,
merchant, category, account, payer, split editor, tags, notes, attachments, and
"make this recurring".

**Split editor rules**, in the order the user experiences them:

- Mode defaults from the space kind and the last used mode for that category.
- Participants default to everyone active; deselecting someone redistributes immediately.
- `equal` shows each person's exact share, already cent-corrected.
- `shares` uses a stepper per person; the resulting amounts update live.
- `percent` validates that the total is exactly 100 and shows the running remainder.
- `exact` shows an unallocated remainder that must reach zero before saving, with a
  one-tap "give the rest to X" button.
- The save button is disabled with an inline explanation whenever the split does not balance.
- Switching modes preserves the participant selection and recomputes weights sensibly.

**Transfers** move money between two accounts of the same space, have no category, no
payer, and no splits, and are excluded from every income/expense analytic. They exist so
account balances are correct and so moving money to a savings account is not miscounted as
spending — a mistake almost every competing app makes.

**Refunds** are entered as an income linked to the original transaction (`refund_of` in the
transaction's `payload`), which nets them against the original in category analytics rather
than inflating income.

---

## 3. Dashboard

The answer to "how are we doing?" in one screen, for the selected period.

**Row 1 — the numbers.** Four cards: total income, total expenses, net (income − expenses,
coloured), and current balance across accounts. Each carries a `<TrendDelta>` versus the
equivalent previous period and a sparkline.

**Row 2 — evolution.** An area chart of cumulative net over the period, with the previous
period ghosted behind for comparison. Toggle to daily bars.

**Row 3 — where it goes.** A category donut with the total in the centre; clicking a
segment navigates to the ledger with that category filter applied. Next to it, a ranked
list of the top eight categories with amount, share of total, change versus last period,
and a mini progress bar against that category's budget if one exists.

**Row 4 — who and what.** Spend by participant (stacked bars over time, hidden in solo
spaces) and top merchants.

**Right rail / bottom section.** Budget alerts needing attention, upcoming subscription
charges in the next 14 days, goal progress, unsettled balances, and AI insights once
Phase 12 exists.

Everything on this screen respects the global period picker and the space's
`month_starts_on`. A "month" for a household whose salary lands on the 25th runs from the
25th to the 24th, and the copy says so.

---

## 4. Budgets

A budget is a limit for a scope over a repeating period. Scopes: the whole space, one
category (optionally including its subcategories), one participant, or one participant
within one category.

**List view.** Cards sorted by urgency: over limit first, then approaching, then healthy.
Each card shows a progress ring, spent versus limit, the amount remaining, the days left in
the period, and the implied daily allowance for the rest of the period ("you can spend
14 €/day for the remaining 9 days"). That last number is what actually changes behaviour.

**Rollover.** When enabled, unspent budget carries into the next period and the next
period's `limit_minor` reflects it. Overspend also carries, as a negative, if the user opts
in — off by default because it is demoralising.

**Alerts.** Configurable thresholds, defaulting to 50 / 80 / 100 %. Each threshold fires at
most once per period per budget; `budget_periods.notified` records which have fired.
Evaluation happens in two places: synchronously in the Server Action right after a
transaction is written (so the alert is instant), and hourly in an Edge Function as a
safety net for transactions created by imports, recurring rules, or bank sync.

Who gets notified: for space and category budgets, everyone with the relevant preference
enabled; for participant budgets, that participant plus the space owners. The copy is
neutral and includes the number and the period, never a judgement.

**Suggestions.** After three months of data, Nido offers to create budgets from the median
of the last three months per category, rounded to a friendly number. One tap to accept all.

---

## 5. Goals

Savings pots. Name, target amount, optional target date, colour, icon, and an optional
linked account.

The card shows a progress bar, the amount saved and remaining, and — when there is a target
date — the monthly amount required to arrive on time, recomputed after every contribution
and shown against what the household has actually been saving lately ("you need 220 €/month;
you have averaged 180 €/month"). A projected completion date is shown when there is no
deadline.

Contributions can be manual, linked to a real transfer transaction, or automatic (a
recurring rule of kind `transfer` pointing at the goal's account). Withdrawals are negative
contributions and require a reason, which is stored and shown in the history.

Reaching the target fires a celebration once (a restrained one — a confetti burst that
respects `prefers-reduced-motion`) and a notification to every member.

---

## 6. Subscriptions and recurring entries

One module, two faces: `subscriptions` is the friendly view of `recurring_rules`.

**List.** Grouped by billing cycle, each row showing the merchant logo (from a small
bundled set, falling back to an initial), the amount, the cycle, the next charge date, the
split, and the total paid to date. A header shows monthly and annualised totals — seeing
"1.847 € per year" is often the moment someone cancels something.

**Calendar.** A month grid of upcoming charges with the daily total, so the user can see
that the 1st of the month is brutal and the 20th is quiet.

**Creation.** From scratch, from an existing transaction ("this happens every month"), or
suggested automatically: when three transactions with a similar merchant, a similar amount
(±5 %), and a regular interval are detected, Nido proposes creating a rule. The proposal is
a dismissible card, never an automatic creation.

**Price changes.** When a generated or imported transaction's amount differs from the
rule's amount by more than 1 %, the difference is recorded in `recurring_price_changes`, the
rule's amount is updated, and a `recurring_price_change` notification fires. The
subscription detail shows a price history chart.

**Cancelling.** Marking a rule cancelled stops generation, keeps history, and stores an
optional cancellation URL. The list shows cancelled rules in a separate collapsed section
with the annual amount saved — a small, satisfying number.

**Ghost detection.** Heuristics from [`02-DATA-MODEL.md`](./02-DATA-MODEL.md) § 8. Presented
as a question: "You have paid X for Y over Z months. Still using it?" with three answers:
yes (snooze 6 months), no (open the cancel URL and mark cancelled), and not sure (snooze 1
month).

---

## 7. Balances and settlements

Hidden entirely in solo spaces.

**Summary.** One line per participant: what they paid, what they owed, and their net
position, colour-coded. A prominent sentence at the top states the simplest truth: "Ana owes
Edvin 127,40 €."

**Settle up.** Runs the minimum-transfer algorithm and presents the resulting list of
transfers. Each can be marked as paid, which creates a `settlement` in the `proposed` state.
The counterparty gets a notification and confirms or disputes. Only a confirmed settlement
moves balances. Settlements involving a ghost participant auto-confirm.

**History.** All settlements with date, direction, amount, method, and who confirmed. It
must be possible to reverse a settlement, which creates a compensating record rather than
deleting history.

**Drill-down.** Tapping a balance shows exactly which transactions produced it, so the
number is never a mystery. This is the feature that prevents arguments, and it is worth
more than any chart in the app.

---

## 8. Attachments and receipt extraction

Up to five attachments per transaction, 10 MB each, JPEG / PNG / WebP / HEIC / PDF.

On mobile, the flow is camera-first: tap the paperclip, the camera opens, the photo is
compressed client-side to ≤ 1600 px on the long edge and converted to WebP before upload,
and a blurhash placeholder is generated. Uploads are resumable and continue in the
background; the transaction saves immediately and the attachment attaches when it lands.

Server-side the image is re-encoded, EXIF is stripped (GPS coordinates on a receipt photo
are a genuine privacy leak), and a thumbnail is generated. Files live in a private bucket at
`receipts/{space_id}/{yyyy}/{mm}/{uuid}.webp` and are served through 60-second signed URLs.

**Extraction** (Phase 7, only when an AI provider is configured). The image is sent to a
vision model with a strict schema and returns total, currency, date, merchant, tax, and
suggested category with a confidence score per field. Results never save automatically: the
extracted values appear as pre-filled, visually marked suggestions the user confirms or
edits. Below 0.7 confidence a field is left empty rather than guessed. The raw result is
kept in `attachments.ocr_result` for debugging.

An "add from receipt" entry point inverts the flow: photograph first, and the transaction
form opens already filled.

---

## 9. Import

**CSV / XLSX.** Drag a file in. Nido detects the delimiter, encoding, and header row, then
shows a mapping screen with source columns on the left and Nido fields on the right,
pre-guessed by header name and content sniffing. Mappings are saved per bank so the second
import is one click. Handles the real-world mess: dates in `DD/MM/YYYY`, comma decimal
separators, thousands separators, single-amount columns with signs, and separate
debit/credit columns.

**Preview.** Every row shown with its parsed values, its auto-assigned category from the
rules engine, and a duplicate flag. Duplicates are detected by exact `external_id` when
available, otherwise by a fingerprint of date + amount + normalized description + account,
with a ±3 day window. Duplicates default to skipped but can be forced. The user can edit any
cell in the preview before committing.

**Commit** is a single transaction: all rows import or none do. A summary reports how many
were imported, skipped, and failed, and the batch can be undone in its entirety for 24 hours.

**Rules engine.** `categorization_rules` are applied in priority order during preview.
When a user changes a category on an imported row, a toast offers "always categorize
'MERCADONA' as Groceries", which creates an auto-learned rule.

**Bank sync** is the same pipeline with a different source. The provider interface is:

```ts
interface BankProvider {
  listInstitutions(country: string): Promise<Institution[]>;
  createSession(institutionId: string, redirectUrl: string): Promise<{ url: string; ref: string }>;
  completeSession(ref: string): Promise<BankAccountInfo[]>;
  fetchTransactions(ref: string, accountId: string, since: Date): Promise<RawBankTransaction[]>;
  revoke(ref: string): Promise<void>;
}
```

Implementations: `enablebanking` and `none`. Sync every six hours via cron plus a manual
refresh button. Fetched transactions land in `import_rows` and go through exactly the same
dedupe, rules, and preview machinery — with an "auto-commit high-confidence rows" setting
for people who trust it. Consent expiry (90 days under PSD2) is surfaced as a banner ten
days before it happens, because a silently broken sync is worse than no sync.

---

## 10. Multi-currency

The space has a base currency. A transaction can be in any currency; it stores the original
amount and the value converted at `booked_on`, frozen. All analytics use the base value, so
history never shifts when rates move.

Converted amounts render with a `≈` marker and a tooltip showing the original amount and the
rate used. Users can override the rate on a specific transaction — useful when a card
issuer's actual rate differed from the ECB reference, which it always does.

Accounts have their own currency, and account balances are shown in it, with a base-currency
equivalent underneath.

---

## 11. Reports

**Monthly close.** On the first day of each period, Nido generates a snapshot: totals,
category breakdown, per-participant breakdown, budget performance, savings rate, and the
three largest changes versus the previous month. Delivered as an in-app card and, if
enabled, an email.

**Exports.** PDF (a designed report, not a screenshot dump: cover page with the period and
household, summary, charts, and a full transaction appendix) and XLSX (multiple sheets:
transactions, splits, categories pivot, budgets, settlements) and CSV. Exports respect the
current filters, so "export what I am looking at" works.

**Comparison.** Any two periods side by side, per category, with absolute and percentage
deltas and a clear indication of which categories drove the difference.

**Savings rate** — `(income − expenses) / income` for the period — is tracked over time as a
headline metric, because it is the single number that best describes whether a household is
getting healthier.

---

## 12. Settings

**Profile.** Name, avatar, locale, timezone, theme, colourblind-safe palette.

**Space.** Name, kind, base currency, timezone, week start, month start, archive, delete
(with a typed confirmation and a full export offered first).

**Members.** List with roles, invite by email or link, change role, remove, transfer
ownership. Ghost participants can be converted to real members by sending an invitation.

**Categories.** Tree editor with drag to reorder and to re-parent, colour and icon pickers,
merge two categories (moving all transactions), archive.

**Accounts.** CRUD, archive, reorder, set the default.

**Notifications.** A matrix of notification kind against channel (in-app, push, email) with
per-space overrides, plus quiet hours.

**Integrations.** AI provider and key, bank connections, FX source.

**Data.** Export everything as JSON, import a Nido export, and delete the account — which
really deletes, with a 30-day grace period and a clear explanation of what happens to
shared spaces.

---

## 13. Cross-cutting rules

- **Offline.** The PWA caches the app shell and the current period's data. Transactions
  created offline queue in IndexedDB and sync on reconnect, with conflict resolution by
  last-write-wins on a per-field basis and a visible "pending sync" indicator.
- **Realtime.** Changes made by one member appear for others within a second, with a
  subtle highlight. No full-page reloads.
- **Undo.** Every destructive action shows a toast with an undo for 8 seconds. Deletion is
  soft for 30 days.
- **Idempotency.** Every mutating Server Action accepts a client-generated request id and
  ignores duplicates, so a double tap on a slow connection never creates two expenses.
- **Rate limiting.** Per-user limits on writes, uploads, imports, and AI calls, enforced in
  middleware and backed by a Postgres counter.
