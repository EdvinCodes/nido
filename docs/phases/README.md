# Build plan

Thirteen phases. **Execute exactly one per session.** Find the first phase whose status is
not `Done`, read its file, do it, verify it, commit it, update the table below, and stop.

## Status

| #   | Phase                                                         | Status        | Depends on | Completed |
| --- | ------------------------------------------------------------- | ------------- | ---------- | --------- |
| 00  | [Foundations](./PHASE-00-foundations.md)                      | `In progress` | —          |           |
| 01  | [Auth & spaces](./PHASE-01-auth-spaces.md)                    | `Not started` | 00         |           |
| 02  | [Ledger core](./PHASE-02-ledger-core.md)                      | `Not started` | 01         |           |
| 03  | [Dashboard & analytics](./PHASE-03-dashboard.md)              | `Not started` | 02         |           |
| 04  | [Budgets & alerts](./PHASE-04-budgets.md)                     | `Not started` | 02, 03     |           |
| 05  | [Goals & subscriptions](./PHASE-05-goals-subscriptions.md)    | `Not started` | 02         |           |
| 06  | [Balances & settlements](./PHASE-06-balances.md)              | `Not started` | 02         |           |
| 07  | [Attachments & receipt extraction](./PHASE-07-attachments.md) | `Not started` | 02         |           |
| 08  | [Import & bank sync](./PHASE-08-import-banking.md)            | `Not started` | 02         |           |
| 09  | [Multi-currency & reports](./PHASE-09-currency-reports.md)    | `Not started` | 03         |           |
| 10  | [PWA & notifications](./PHASE-10-pwa-notifications.md)        | `Not started` | 04         |           |
| 11  | [Landing & polish](./PHASE-11-landing-polish.md)              | `Not started` | 03         |           |
| 12  | [AI assistant](./PHASE-12-ai-assistant.md)                    | `Not started` | 02–09      |           |

Statuses: `Not started` · `In progress` · `Done` · `Blocked (reason)`.

### Phase 00 progress notes

Done so far: task 1 (scaffold), task 2 (lint/format/Husky), task 3.1–3.5 (tokens, theming,
fonts, shadcn components — `/dev/tokens` page from 3.6 still missing), task 4 (money and date
primitives, with property-based tests), task 5.1 (`supabase init`, `config.toml`), task 6.7–6.8
(`.env.example`, `src/lib/env.ts` — not yet wired into any consumer), task 7 (next-intl request
config, es/en messages, `useFormatters`), and enough of task 8 to have a working root layout
(theme provider, i18n provider, toaster).

Remaining before the phase can be marked `Done`:

- Task 3.6 — `/dev/tokens` review page.
- Task 5.2–5.7 — first two migrations (schema/enums/currencies/`allocate`, then the
  `is_member`/`my_participant_id`/`has_role` helpers), the four Supabase clients,
  `src/middleware.ts`, `pnpm db:types` wiring, and a pgTAP smoke test.
- Task 6.1–6.6 — Vitest jsdom config is already in place; still need Playwright (two
  viewport projects + smoke test), `@axe-core/playwright` helper, `.github/workflows/ci.yml`,
  and `.github/workflows/keepalive.yml`.
- Task 8 — the real `(marketing)` and `(app)` route groups, sidebar/mobile tab bar static
  nav, `error.tsx`/`not-found.tsx`/`loading.tsx`, and `app/api/health/route.ts`.
- Full acceptance criteria pass, including `pnpm test:db` and `pnpm test:e2e`.

`pnpm verify` (typecheck, lint, unit tests, build) is green as of the last commit on this
phase.

## How each phase file is structured

- **Goal** — one paragraph, what the user can do afterwards that they could not before.
- **Required reading** — the only documents to load into context for this phase.
- **Tasks** — ordered and concrete. Do them in order.
- **Acceptance criteria** — objectively verifiable. If you cannot demonstrate one, the phase
  is not done.
- **Out of scope** — belongs to a later phase. Do not build it.
- **Verification** — the exact commands to run and what to check by hand.

## Starting a session

Open a fresh chat in the repository and paste this, changing nothing:

```
Read AGENTS.md and docs/phases/README.md.
Execute the first phase that is not marked Done, following its file exactly.
Do not start any other phase. When you finish, run the verification commands in
the phase file, update the status table, and commit.
```

If the phase turns out to be too large for one session, stop at a clean, verifiable point,
commit what is done, mark the phase `In progress` with a note listing the remaining tasks,
and continue in the next session. Never leave the repository in a state where
`pnpm verify` fails.

## Rules that apply to every phase

Read [`../../AGENTS.md`](../../AGENTS.md) first. In particular: one phase per session,
no scope creep, RLS on every new table with pgTAP tests for both the positive and the
negative case, migrations are forward-only and never edited after commit, `pnpm verify`
must be green before the phase is marked done, and every phase ends with
`chore(phase): complete phase N — <title>`.

Anything you defer goes in [`../BACKLOG.md`](../BACKLOG.md) with a one-line reason.
