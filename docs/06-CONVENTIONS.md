# 06 — Conventions

---

## 1. Naming

| Thing | Convention | Example |
| --- | --- | --- |
| Files and folders | `kebab-case` | `split-editor.tsx`, `budget-periods.ts` |
| React components | `PascalCase`, one per file, named export | `export function SplitEditor()` |
| Hooks | `useCamelCase` | `useSpaceMembers` |
| Server Actions | `verbNoun` | `createTransaction`, `confirmSettlement` |
| Zod schemas | `nounVerbSchema` | `createTransactionSchema` |
| Types | `PascalCase`, no `I` prefix | `TransactionWithSplits` |
| Constants | `SCREAMING_SNAKE_CASE` | `MAX_ATTACHMENTS_PER_TRANSACTION` |
| Database | `snake_case`, plural tables | `transaction_splits` |
| SQL functions | `nido.snake_case`, verb first | `nido.allocate`, `nido.is_member` |
| Migrations | `YYYYMMDDHHMMSS_description.sql` | `20260812093000_create_transactions.sql` |
| i18n keys | dot-namespaced by feature | `ledger.split.remainderWarning` |
| Test files | `*.test.ts` next to the source | `allocate.test.ts` |

Booleans read as assertions: `isActive`, `hasAttachment`, `canEdit`. Not `active`, not
`attachment`, not `editable`.

Money variables always carry their unit: `amountMinor`, `limitMinor`, `baseOwedMinor`.
A variable called `amount` with no suffix is a bug waiting to happen and fails review.

---

## 2. TypeScript

```jsonc
{
  "strict": true,
  "noUncheckedIndexedAccess": true,
  "noImplicitOverride": true,
  "exactOptionalPropertyTypes": true,
  "verbatimModuleSyntax": true,
  "moduleResolution": "bundler"
}
```

- No `any`. `unknown` plus narrowing, or a proper type.
- No non-null assertion (`!`) except immediately after a check the compiler cannot see, with
  a comment saying why.
- Derive types from the source of truth: database row types come from
  `database.types.ts`, form types come from `z.infer<typeof schema>`. Do not hand-write a
  type that duplicates either.
- Discriminated unions over optional-field soup. A transaction is
  `{ kind: 'transfer'; toAccountId: string } | { kind: 'expense'; payerId: string }`, not one
  interface with six optional fields.
- Errors are values at the boundary: Server Actions return
  `{ ok: true; data } | { ok: false; error: { code, message, fields? } }`. Throwing is for
  genuinely exceptional cases only.

---

## 3. React and Next.js

- Server Components by default. `"use client"` only for state, effects, or browser APIs, and
  as deep in the tree as possible. A page is almost never a client component.
- `async` Server Components fetch their own data. No prop-drilling a fetch result through
  four levels.
- `Suspense` boundaries around every independently-loading section, each with a skeleton
  that matches the real layout's dimensions so nothing shifts.
- `error.tsx` and `not-found.tsx` on every route segment. `loading.tsx` where the fetch is
  slow enough to notice.
- Mutations use `useActionState` plus `useOptimistic`. Never a manual `fetch` to a route
  handler for something a Server Action can do.
- Never a `useEffect` that fetches. Data comes from a Server Component or from TanStack Query.
- Keys are stable ids, never array indices.
- Every image goes through `next/image` with explicit dimensions.

---

## 4. SQL and migrations

- One logical change per migration, named descriptively, never edited after being committed.
- Forward-only and safe against a live database: add a column nullable, backfill in the same
  migration, then add the constraint. Never rename a column in one step — add, backfill,
  switch the code, drop in a later migration.
- Every `create table` migration also contains: indexes, `enable row level security`, all
  policies, the `updated_at` trigger, and the audit trigger. A table is never shipped
  half-configured.
- Comments on non-obvious columns via `comment on column`. They show up in generated types
  and in the Supabase dashboard.
- Functions are `stable` or `immutable` whenever true, `security definer` only when
  necessary, and always `set search_path = ''` with fully qualified identifiers.
- After every migration: `pnpm db:types`, commit the regenerated types.

---

## 5. Testing

| Layer | Tool | What belongs there |
| --- | --- | --- |
| Pure logic | Vitest | Allocation, rounding, period boundaries, debt simplification, FX conversion, CSV parsing, fingerprinting. Property-based tests with `fast-check` where an invariant exists. |
| Components | Vitest + Testing Library | Split editor behaviour, amount input parsing, form validation, empty and error states. Query by role and label, never by test id unless there is no alternative. |
| Database | pgTAP | Every RLS policy (positive and negative), every trigger invariant, every SQL function. |
| Integration | Vitest against local Supabase | Server Actions end to end with a real database and a real session. |
| End to end | Playwright | The critical journeys below, at desktop and mobile viewports. |

**Critical journeys that must always have an e2e test:** sign up → onboarding → first
transaction; add a shared expense and verify both balances; create a budget, exceed it, and
receive the alert; import a CSV with duplicates; settle up and confirm; install as a PWA and
add a transaction offline.

Rules: no test depends on the real current date — inject a clock. No test depends on another
test's state. No `waitForTimeout` in Playwright; wait for a condition. Coverage is a signal,
not a target, but pure logic in `features/*/lib/` must be at 100 % of branches, because
that is where money gets lost.

---

## 6. Git

**Branches:** `main` is always deployable. Work happens on `phase/NN-slug` for phase work,
`feat/slug`, `fix/slug`, or `chore/slug` otherwise.

**Commits:** Conventional Commits. Scope is the feature folder or area.

```
feat(budgets): add rollover support to period generation
fix(money): correct largest-remainder tie-break for equal fractions
perf(ledger): virtualize rows and drop initial JS by 40 KB
test(rls): add negative policy tests for transaction_splits
docs(phases): mark phase 3 as done
chore(deps): bump next to 16.3.2
```

Subject in the imperative, ≤ 72 characters, no trailing period. Body explains *why* when it
is not obvious. Footer references issues.

**Pull requests** (when the workflow uses them): title in the same format, a description
covering what changed and how it was verified, screenshots or a short recording for any UI
change, and the phase checklist ticked.

---

## 7. Definition of done

A task is done when all of this is true. There is no partial credit.

- [ ] Implemented as specified, no placeholders, no dead code.
- [ ] `pnpm verify` (typecheck + lint + test + build) passes.
- [ ] New logic has tests; new RLS has pgTAP tests; new flows have a Playwright test.
- [ ] Loading, empty, error, and populated states all exist and were visually checked.
- [ ] Works at 375 / 768 / 1440 px, in light and dark theme.
- [ ] Keyboard navigable, axe reports no violations on the affected route.
- [ ] All strings go through i18n, in both `es` and `en`.
- [ ] No console errors or warnings in the browser or the terminal.
- [ ] Any new environment variable is in `.env.example` and documented.
- [ ] Any architectural decision is recorded in `07-ADR.md`.

---

## 8. Scripts

`package.json` exposes exactly these, and the agent uses them rather than raw commands:

| Script | Does |
| --- | --- |
| `dev` | Next dev server with Turbopack |
| `build` / `start` | Production build and serve |
| `typecheck` | `tsc --noEmit` |
| `lint` / `lint:fix` | ESLint over the repo |
| `format` | Prettier write |
| `test` / `test:watch` | Vitest |
| `test:db` | pgTAP against local Supabase |
| `test:e2e` / `test:e2e:ui` | Playwright |
| `verify` | typecheck && lint && test && build |
| `db:start` / `db:stop` | Local Supabase stack |
| `db:reset` | Drop, migrate, seed |
| `db:migrate` | Apply pending migrations |
| `db:new <name>` | Create a timestamped migration file |
| `db:types` | Regenerate `database.types.ts` |
| `db:push` | Apply migrations to the linked remote project |
| `push:keys` | Generate VAPID keys |
| `ui:add <component>` | `shadcn add` |

---

## 9. Dependency policy

Before adding a dependency, answer three questions in the commit body: what problem it
solves, why the existing stack cannot, and what happens if it is abandoned. Prefer a
30-line utility over a package. Never add a package that duplicates a capability already in
the stack. Pin exact versions; Renovate or Dependabot proposes updates weekly and they are
reviewed, not auto-merged.

---

## 10. Documentation upkeep

Documentation that contradicts the code is worse than none. When a phase changes reality:

- Update the affected `docs/` file **in the same commit**.
- Add an ADR if the decision was architectural.
- Update `docs/phases/README.md` status.
- Append anything deferred to `docs/BACKLOG.md` with a one-line rationale.
