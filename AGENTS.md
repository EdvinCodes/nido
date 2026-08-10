# AGENTS.md — Operating manual for the executing agent

This repository is built **phase by phase by an AI agent**. This file is the contract.
Read it fully before touching anything. If a rule here conflicts with your defaults,
this file wins.

---

## 1. How to start any session

1. Read `docs/phases/README.md` and find the **first phase that is not `Done`**. That is
   your phase. Never skip ahead, never merge two phases into one session.
2. Read the phase file end to end.
3. Read the "Required reading" list at the top of that phase file. Read only those
   documents — do not load the entire `docs/` folder into context every time.
4. Announce which phase you are executing and its scope, then start.

## 2. Non-negotiable rules

- **One phase per session.** Finish it, verify it, commit it, update the phase index. Stop.
- **No scope creep.** If you spot something worth doing that belongs to a later phase, add
  it to `docs/BACKLOG.md` instead of building it.
- **No placeholders in shipped code.** No `TODO: implement`, no fake data returned from a
  function that claims to be real, no commented-out alternatives. If you cannot finish a
  task, say so explicitly in your final message and leave the file untouched.
- **The database is the source of truth.** Every schema change is a new timestamped SQL
  migration in `supabase/migrations/`. Never edit an existing migration that has already
  been committed. Never change the schema through the Supabase dashboard.
- **RLS is mandatory.** Every new table gets `ENABLE ROW LEVEL SECURITY` plus explicit
  policies in the same migration that creates it. A table without policies is a bug.
- **Money is never a float.** Always `bigint` minor units plus an ISO-4217 currency code.
  See `docs/02-DATA-MODEL.md` § Money.
- **Types are generated, not hand-written.** After any migration run
  `pnpm db:types` and commit the regenerated `src/lib/supabase/database.types.ts`.
- **Validate at the boundary.** Every Server Action and route handler parses its input
  with a Zod schema before doing anything else.
- **No secrets in the repo.** New environment variables go in `.env.example` with a
  placeholder value and a one-line comment, and get documented in `docs/01-ARCHITECTURE.md`.

## 3. Definition of done for a phase

A phase is only `Done` when **all** of these are true:

- [ ] Every task in the phase file is implemented.
- [ ] Every acceptance criterion in the phase file is verifiably met.
- [ ] `pnpm typecheck` passes with zero errors.
- [ ] `pnpm lint` passes with zero errors and zero warnings.
- [ ] `pnpm test` passes.
- [ ] `pnpm build` succeeds.
- [ ] New behaviour has tests: unit tests for pure logic, a pgTAP test for any new RLS
      policy, and a Playwright test for any new user-facing flow.
- [ ] The UI works at 375 px, 768 px, and 1440 px, in light and dark theme.
- [ ] No new `any`, no new `@ts-expect-error`, no new eslint-disable without a comment
      explaining why.
- [ ] `docs/phases/README.md` status updated, and any doc invalidated by reality updated too.

Run the whole gate with `pnpm verify` (typecheck + lint + test + build).

## 4. Commits

Conventional Commits, imperative mood, English, scoped by area:

```
feat(ledger): add split editor with exact-amount mode
fix(budgets): correct week boundary for Monday-start locales
chore(db): add migration for recurring_rules table
```

Commit in logical chunks as you go, not one giant commit at the end. The final commit of a
phase must be `chore(phase): complete phase N — <title>`.

Author identity is already configured locally (`EdvinCodes` / `EdvinTrabajo@gmail.com`).
Do not change git config. Do not push unless explicitly asked.

## 5. Code standards

- TypeScript `strict: true`. No `any`. Prefer `unknown` plus a narrowing guard.
- Server Components by default. Add `"use client"` only when you need state, effects,
  or browser APIs, and push it as far down the tree as possible.
- Data mutations go through Server Actions in `src/features/<feature>/actions.ts`, wrapped
  in the shared `authedAction` helper that resolves the user, checks space membership,
  and validates input.
- Reads that the dashboard depends on happen in Server Components. Client-side reads that
  need caching or realtime use TanStack Query hooks in `src/features/<feature>/queries.ts`.
- Business logic that can be pure must be pure and live in `src/features/<feature>/lib/`
  with unit tests next to it. Splitting, rounding, budget periods, debt simplification,
  and currency conversion are all pure functions — test them hard, including edge cases.
- Never call `supabase.from(...)` directly inside a React component. Go through the
  feature's query or action layer.
- Use the design tokens. No raw hex colors, no arbitrary `text-[13px]`, no magic spacing.
  If a token is missing, add it to the theme in `src/app/globals.css` and document it.
- All user-visible strings go through `next-intl`. No hardcoded copy in components.
- Dates: store `timestamptz` for events and `date` for accounting days. Do all period math
  in the space's configured timezone, never in the server's local time.

## 6. Testing standards

- `pnpm test` — Vitest, unit and integration, jsdom for components.
- `pnpm test:db` — pgTAP against the local Supabase instance. Every RLS policy needs a
  positive test (the owner can) and a negative test (an outsider cannot).
- `pnpm test:e2e` — Playwright against a seeded local stack.
- Tests must not depend on the current date. Inject a clock.
- Never weaken a test to make it pass. If a test is wrong, explain why before changing it.

## 7. When you get stuck

Do not guess and do not silently invent an API. In order:

1. Re-read the relevant doc in `docs/`.
2. Check the actual library version in `package.json` and read its real API surface.
3. If the specification is genuinely ambiguous or contradicts reality, stop, write the
   question in your final message, and leave a note in `docs/BACKLOG.md`. Do not
   improvise architectural decisions that later phases depend on.

If you make a decision that changes the architecture, record it as a new entry in
`docs/07-ADR.md` in the same commit.

## 8. Things that are explicitly out of bounds

- Adding a dependency that duplicates something already in the stack.
- Introducing a second state manager, a second ORM, or a second styling system.
- Storing plaintext bank credentials, card numbers, or third-party API keys in the database.
- Sending user financial data to any third party other than the model provider the user
  explicitly configured.
- Rewriting a previous phase's work because you would have done it differently.
