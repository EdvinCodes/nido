# Phase 00 — Foundations

## Goal

A running Next.js application with the full toolchain, the design system encoded as real
tokens, a local Supabase stack, and a green CI pipeline. At the end of this phase
`pnpm verify` passes, `pnpm dev` shows a styled placeholder page proving the design tokens
work, and a fresh clone can be set up by following the README.

No product features. This is the only phase allowed to produce no user-facing functionality,
and it must not take shortcuts, because every later phase inherits whatever is decided here.

## Required reading

- [`../01-ARCHITECTURE.md`](../01-ARCHITECTURE.md) — §§ 2, 3, 9, 10
- [`../03-DESIGN-SYSTEM.md`](../03-DESIGN-SYSTEM.md) — §§ 2, 3, 4
- [`../06-CONVENTIONS.md`](../06-CONVENTIONS.md) — all of it
- [`../../AGENTS.md`](../../AGENTS.md)

## Tasks

### 1. Project scaffold

1. `pnpm dlx create-next-app@latest . --ts --app --tailwind --eslint --src-dir --import-alias "@/*" --turbopack` into the existing repository (it already contains `.git`, `README.md`, `LICENSE`, `AGENTS.md`, and `docs/` — preserve all of them).
2. Set `"packageManager"` to the installed pnpm version. Add `.nvmrc` with `22`.
3. Verify the installed versions of `next`, `react`, and `tailwindcss` and record them in a
   new `docs/07-ADR.md` note only if they differ from what the architecture document expects.
4. Configure `tsconfig.json` with every compiler flag listed in
   [`../06-CONVENTIONS.md`](../06-CONVENTIONS.md) § 2.
5. Create the full folder structure from [`../01-ARCHITECTURE.md`](../01-ARCHITECTURE.md) § 3,
   with a `.gitkeep` in directories that are still empty.

### 2. Linting and formatting

1. ESLint 9 flat config extending `next/core-web-vitals`, `next/typescript`,
   `plugin:@typescript-eslint/strict-type-checked`, and `eslint-plugin-jsx-a11y`.
2. Add custom rules that enforce this project's invariants:
   - `no-restricted-syntax` banning `parseFloat` and `Number.parseFloat` outside
     `src/lib/money/**`.
   - `no-restricted-imports` banning direct imports of `recharts` outside
     `src/components/charts/**`, and of `@supabase/supabase-js` outside `src/lib/supabase/**`.
   - `no-restricted-properties` banning `toFixed` outside `src/lib/money/**`.
3. Prettier with `prettier-plugin-tailwindcss`. 100-character line width, single quotes,
   no semicolon debate — pick one and put it in the config.
4. Husky with a `pre-commit` hook running `lint-staged`, and a `pre-push` hook running
   `pnpm verify`.

### 3. Design tokens

1. Write every token from [`../03-DESIGN-SYSTEM.md`](../03-DESIGN-SYSTEM.md) §§ 2–4 into
   `src/app/globals.css` using Tailwind v4's `@theme` directive: neutrals for both themes,
   accent, semantic colours, the twelve category colours, radii, shadows, and the type scale.
2. Dark theme is the default; light theme applies under `.light`. Theme switching via
   `next-themes` with `attribute="class"` and no flash on first paint.
3. Load fonts with `next/font`: Geist Sans and Geist Mono globally, Instrument Serif scoped
   to the marketing route group only.
4. Initialize shadcn/ui (`new-york`, CSS variables, base colour neutral) and install the
   first components: `button`, `input`, `label`, `card`, `dialog`, `sheet`, `dropdown-menu`,
   `select`, `tabs`, `badge`, `skeleton`, `sonner`, `tooltip`, `separator`, `avatar`,
   `popover`, `form`, `scroll-area`.
5. Add `tw-animate-css`. Add the global `prefers-reduced-motion` override.
6. Build `/dev/tokens`, a page (excluded from production builds) rendering every colour,
   type size, radius, shadow, and installed component in both themes. This is how the
   design system gets reviewed, and it is a real deliverable.

### 4. Money and date primitives

These are needed by everything and must be correct before any feature exists.

1. `src/lib/money/`: a `Money` type (`{ minor: bigint; currency: string }`), constructors
   from a decimal string and from minor units, `add`, `subtract`, `multiply` by a rational,
   `negate`, `compare`, `isZero`, `format(locale)`, `parse(input, locale, currency)`
   handling both `,` and `.` as the decimal separator, and `allocate(total, weights)`
   implementing largest-remainder allocation.
2. `src/lib/dates/`: `periodBounds(period, referenceDate, { timezone, weekStartsOn,
monthStartsOn })` returning `{ from, to }` for day, week, month, quarter, and year,
   correct across DST boundaries and for custom month starts; `previousPeriod(bounds)`;
   `formatRelativeDate(date, locale, timezone)`.
3. Unit tests for both, including property-based tests with `fast-check` asserting that
   `sum(allocate(total, weights)) === total` for arbitrary totals from −10⁹ to 10⁹ and
   arbitrary weight vectors of length 1–10, and that period bounds never overlap or leave gaps.

### 5. Supabase

1. `pnpm dlx supabase init`. Configure `supabase/config.toml`: local ports, `Europe/Madrid`,
   auth with email confirmation disabled locally, and a `receipts` storage bucket that is
   not public.
2. First migration `..._init_schema.sql`: create the `nido` schema, the `currency_code`
   domain, every enum from [`../02-DATA-MODEL.md`](../02-DATA-MODEL.md) § 2, the
   `nido.currencies` table seeded with the ~20 currencies that matter plus their exponents,
   the shared `nido.tg_set_updated_at()` trigger function, and the `nido.allocate()` SQL
   function mirroring the TypeScript implementation.
3. Second migration: `nido.is_member`, `nido.my_participant_id`, and `nido.has_role` helper
   functions exactly as specified, `security definer` with `set search_path = ''`.
4. Supabase clients in `src/lib/supabase/`: `server.ts` (cookie-based, for RSC and Server
   Actions), `client.ts` (browser), `middleware.ts` (session helper used by proxy), and `admin.ts`
   (service role, with a runtime guard that throws if it is ever imported into a client bundle).
5. `src/proxy.ts` refreshing the session on every matched request.
6. `pnpm db:types` wired up and the generated file committed.
7. pgTAP installed in the local stack, with one smoke test proving the harness works.

### 6. Tooling and CI

1. Vitest with a `jsdom` environment, Testing Library, and path aliases matching `tsconfig`.
2. Playwright with two projects: `chromium-desktop` at 1440×900 and `chromium-mobile` at
   the Pixel 7 viewport. One smoke test loading `/` and asserting the page renders.
3. `@axe-core/playwright` wired into a reusable `expectNoA11yViolations(page)` helper.
4. All the scripts from [`../06-CONVENTIONS.md`](../06-CONVENTIONS.md) § 8 in `package.json`.
5. `.github/workflows/ci.yml`: on push and pull request, run install (cached), typecheck,
   lint, unit tests, start Supabase, run pgTAP, run Playwright, and build. Cache
   `.next/cache` between runs.
6. `.github/workflows/keepalive.yml`: every two days, hit a `/api/health` endpoint that
   performs a trivial database read, so the free-tier project never pauses.
7. `.env.example` containing every variable from
   [`../01-ARCHITECTURE.md`](../01-ARCHITECTURE.md) § 9 with placeholders and one-line comments.
8. `src/lib/env.ts` validating environment variables with Zod at startup, separating server
   and client variables, and failing loudly with a readable message listing what is missing.

### 7. Internationalization

1. `next-intl` with `es` as the default locale and `en` as the second, locale detection from
   the `Accept-Language` header, and the locale persisted on the profile once profiles exist.
2. `src/i18n/messages/es.json` and `en.json` with the keys used so far.
3. A `useFormatters()` hook exposing locale-aware currency, number, date, and relative-time
   formatters built on `Intl`, so no component instantiates one itself.

### 8. Application shell

A non-functional but real shell, so Phase 01 has somewhere to put things: root layout with
fonts, theme provider, `Toaster`, and metadata; a `(marketing)` group with a placeholder
landing page; an `(app)` group with the sidebar and mobile tab bar rendering static
navigation; `error.tsx`, `not-found.tsx`, and `loading.tsx` at the root; and
`app/api/health/route.ts`.

## Acceptance criteria

- [ ] `pnpm verify` passes with zero errors and zero warnings.
- [ ] `pnpm dev` serves a styled page; `pnpm db:start` brings Supabase up; `pnpm db:reset`
      applies migrations without error.
- [ ] `/dev/tokens` renders every token and every installed component correctly in both
      themes, and is absent from a production build.
- [ ] Theme toggling works with no flash of the wrong theme on reload.
- [ ] `allocate` and `periodBounds` have property-based tests that pass, and the SQL
      `nido.allocate` returns identical results to the TypeScript version for a shared
      fixture set of at least twenty cases.
- [ ] `pnpm test:db` runs pgTAP successfully.
- [ ] `pnpm test:e2e` passes the smoke test on both viewport projects.
- [ ] CI is green on a pushed branch.
- [ ] `src/lib/env.ts` fails with a readable message when a required variable is missing.
- [ ] The README quickstart works verbatim on a clean clone.

## Out of scope

Authentication, any database table beyond the enums and lookups listed, any real page, any
Server Action, and the real landing page (Phase 11).

## Verification

```bash
pnpm install
pnpm db:start && pnpm db:reset
pnpm verify
pnpm test:db
pnpm test:e2e
pnpm dev   # then check /dev/tokens in both themes at 375px and 1440px
```

Manual check: unset `NEXT_PUBLIC_SUPABASE_URL` and confirm the app refuses to start with a
clear message naming the missing variable.
