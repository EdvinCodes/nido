# Backlog

Anything discovered during a phase that does not belong to it. One line per item: what,
why it was deferred, and where it should land. Do not build from this file directly —
promote an item into a phase file first.

## Format

```
- [ ] <what> — deferred from Phase NN because <reason>. Target: Phase MM / post-v1.
```

## Open

- [ ] Perf seed of 10k transactions for ledger virtualization FPS checks — deferred from Phase 02 because seeding 10k via `create_transaction` on every `db:reset` is too slow; demo seed keeps ~150 realistic rows. Target: tooling / Phase 02 follow-up.
- [ ] Wire `hasAttachment` ledger filter to real attachment rows — deferred from Phase 02 because attachments land in Phase 07; URL param `attached=1` already yields an empty set. Target: Phase 07.
- [ ] Re-run Lighthouse (perf ≥ 95, a11y 100) on a production `pnpm start` build of the seeded dashboard — deferred from Phase 03 because local `pnpm dev` is not a valid perf baseline; axe e2e already covers a11y. Target: Phase 03 follow-up / CI.

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
