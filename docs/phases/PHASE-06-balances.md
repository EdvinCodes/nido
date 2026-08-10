# Phase 06 — Balances and settlements

## Goal

The feature that prevents arguments. At any moment the app can state, in one sentence, who
owes whom and how much, prove it transaction by transaction, and propose the smallest set of
transfers that clears everything.

Hidden entirely in solo spaces.

## Required reading

- [`../02-DATA-MODEL.md`](../02-DATA-MODEL.md) — § 9
- [`../04-FEATURES.md`](../04-FEATURES.md) — § 7

## Tasks

### 1. Database

1. `nido.settlements` with RLS: a member may propose a settlement involving themselves;
   only the counterparty (or an admin, or anyone when the counterparty is a ghost) may
   confirm; nobody may edit a confirmed settlement.
2. `nido.v_participant_balances` exactly as specified.
3. `nido.balance_breakdown(p_space_id uuid, p_participant_id uuid)` returning the
   transactions that contributed to that participant's position, each with the amount paid
   and the amount owed, so every number can be drilled into.
4. `nido.pairwise_balances(p_space_id uuid)` returning the raw who-owes-whom matrix before
   simplification, for users who prefer to settle bilaterally.
5. `nido.reverse_settlement(p_id uuid)` creating a compensating record rather than deleting
   history.
6. Audit triggers and pgTAP, including the invariant that net positions across a space
   always sum to exactly zero.

### 2. Simplification algorithm

`src/features/balances/lib/simplify.ts`, pure and heavily tested:

```ts
simplifySettlements(balances: { participantId: string; netMinor: bigint }[]):
  { fromId: string; toId: string; amountMinor: bigint }[]
```

Greedy maximum matching: repeatedly pair the largest debtor with the largest creditor and
emit a transfer for the smaller absolute amount. Deterministic tie-breaking by participant
position so the output is stable across runs.

Tests: 2, 3, 5, and 8 participants; an all-zero vector returns nothing; the result always
produces at most *n − 1* transfers; applying the result to the balance vector always yields
all zeros; the sum of transfers out equals the sum of transfers in; property-based over
random balance vectors that sum to zero.

### 3. Balances UI

`/s/[spaceId]/balances`:

- A headline sentence in the display serif stating the simplest truth ("Ana owes Edvin
  127,40 €"), or a satisfying "You are all square" when everything nets to zero.
- One card per participant: paid, owed, and net, with the net coloured and signed.
- A toggle between the simplified plan and the raw pairwise matrix, with a short explanation
  of what simplification does — people distrust a number they do not understand.
- Tapping any balance opens the breakdown: the contributing transactions, each showing what
  that participant paid and what they owed, filterable by period.
- A period filter, defaulting to all time, because balances are cumulative by nature.

### 4. Settle up flow

- "Settle up" presents the simplified transfers, each with the two avatars, the amount, and
  a "mark as paid" action.
- Marking as paid opens a sheet for date, method (cash, transfer, Bizum, other), and an
  optional note, then creates a settlement in the proposed state.
- The counterparty receives a `settlement_request` notification and sees a confirm-or-dispute
  banner. Confirming records `confirmed_at`; disputing opens a note field and notifies back.
- Settlements involving a ghost participant auto-confirm, since there is nobody to ask.
- Partial settlements are allowed: a user may edit the amount before confirming, and the
  remainder stays outstanding.

### 5. History

A settlement history list with date, direction, amount, method, who proposed, who confirmed,
and a reverse action. Reversal creates a compensating record and notifies both sides.

### 6. Integration

- The dashboard right rail shows outstanding balances with a link to settle up.
- The ledger's transaction detail shows how that transaction affected each participant's
  position.
- Solo spaces hide the balances navigation item, the dashboard card, and the settle-up
  entry points entirely — not disabled, absent.

## Acceptance criteria

- [ ] Net positions across a space always sum to zero, asserted by a pgTAP test over the
      seed data and by a property test over randomly generated ledgers.
- [ ] The simplified plan always clears every balance to zero and never uses more than
      *n − 1* transfers.
- [ ] Every balance can be drilled into and the listed transactions reconstruct exactly the
      displayed figure.
- [ ] A proposed settlement does not affect balances until it is confirmed.
- [ ] Confirming a settlement updates both participants' positions correctly and in realtime.
- [ ] Reversing a settlement restores the previous positions and leaves both records visible.
- [ ] A solo space shows no trace of the balances feature anywhere.
- [ ] `pnpm verify`, `pnpm test:db`, `pnpm test:e2e` pass.

## Out of scope

Initiating real payments or integrating with Bizum, PayPal, or any bank transfer API. Nido
records that a settlement happened; it never moves money. Reminder nudges for unsettled
balances belong to Phase 10.

## Verification

```bash
pnpm db:reset && pnpm verify && pnpm test:db && pnpm test:e2e
```

Playwright: two browser contexts, one proposes a settlement and the other confirms it; both
see the updated balance without a manual refresh.
