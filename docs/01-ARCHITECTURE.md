# 01 — Architecture

## 1. Shape of the system

Nido is a single Next.js application talking to a Supabase project. There is no separate
API server and no separate microservice, because there is nothing in this product that
justifies one. Scheduled work runs as Supabase Edge Functions triggered by `pg_cron`.

```
┌──────────────────────────────────────────────────────────────┐
│  Browser / installed PWA                                     │
│  React 19 · Tailwind v4 · shadcn/ui · TanStack Query · Motion │
└───────────────┬──────────────────────────────┬───────────────┘
                │ RSC payload / Server Actions │ Realtime (WS)
                ▼                              │
┌──────────────────────────────────────────────┼───────────────┐
│  Next.js 16 (Vercel or Node container)       │               │
│  ├─ app/(marketing)      public landing      │               │
│  ├─ app/(auth)           sign in / sign up   │               │
│  ├─ app/(app)            authenticated shell │               │
│  ├─ features/*/actions   Server Actions      │               │
│  ├─ api/ai/chat          streaming AI route  │               │
│  └─ api/webhooks/*       provider callbacks  │               │
└───────────────┬──────────────────────────────┼───────────────┘
                │ postgrest / supabase-js      │
                ▼                              ▼
┌──────────────────────────────────────────────────────────────┐
│  Supabase                                                    │
│  ├─ Postgres 17 + Row Level Security  ← the security boundary│
│  ├─ Auth (email+password, magic link, OAuth)                 │
│  ├─ Storage (receipts bucket, per-space paths)               │
│  ├─ Realtime (ledger changes broadcast to the space)         │
│  ├─ Edge Functions (cron jobs, OCR, bank sync, push)         │
│  └─ pg_cron + pg_net (scheduling)                            │
└───────────────┬──────────────────────────────────────────────┘
                │ outbound, only when the user enabled it
                ▼
     LLM provider · FX rates API · PSD2 provider · Web Push
```

**The security boundary is Postgres, not the application.** Every table has RLS policies.
If the application layer had a bug that leaked a query to the wrong space, the database
would still return zero rows. Application-level checks exist for good error messages, not
for security.

## 2. Stack and versions

Pin exact versions in `package.json`. These are the targets at the time of writing; the
executing agent must install `@latest` within the same major and record what it actually
installed.

| Concern         | Choice                                  | Notes                                                            |
| --------------- | --------------------------------------- | ---------------------------------------------------------------- |
| Framework       | **Next.js 16.3+**                       | App Router, RSC, Server Actions, Turbopack, `next/after`         |
| Language        | **TypeScript 5.9+**                     | `strict`, `noUncheckedIndexedAccess`, `verbatimModuleSyntax`     |
| Runtime         | **Node 22 LTS**                         | Set in `.nvmrc` and in CI                                        |
| Package manager | **pnpm 10+**                            | `packageManager` field pinned; lockfile committed                |
| UI library      | **React 19**                            | Server Components, `useActionState`, `useOptimistic`             |
| Styling         | **Tailwind CSS v4**                     | CSS-first config via `@theme` in `globals.css`, OKLCH colors     |
| Components      | **shadcn/ui** (new-york)                | Copied into `src/components/ui`, owned by us, freely edited      |
| Icons           | **lucide-react**                        | One icon set only                                                |
| Motion          | **Motion** (`motion/react`)             | Springs and layout animations; respects `prefers-reduced-motion` |
| Charts          | **Recharts** via shadcn charts          | Wrapped in our own `<Chart*>` primitives                         |
| Tables          | **TanStack Table v8**                   | Virtualized ledger with `@tanstack/react-virtual`                |
| Client cache    | **TanStack Query v5**                   | Only for client-side and realtime data; RSC handles first paint  |
| URL state       | **nuqs**                                | Filters, date ranges, and tabs live in the URL and are shareable |
| Forms           | **react-hook-form** + **Zod 4**         | One schema shared by the form and the Server Action              |
| Dates           | **date-fns v4** + `@date-fns/tz`        | Timezone-aware period math                                       |
| i18n            | **next-intl**                           | `es` and `en`, `es` default                                      |
| Toasts          | **sonner**                              | shadcn's `toast` is deprecated                                   |
| Command palette | **cmdk**                                | ⌘K for navigation and quick add                                  |
| Backend         | **Supabase**                            | Cloud free tier or self-hosted Docker                            |
| Database        | **Postgres 17**                         | Migrations in `supabase/migrations`, SQL is the source of truth  |
| Types           | `supabase gen types typescript`         | Generated, committed, never hand-edited                          |
| AI              | **AI SDK** (`ai` v7)                    | `ToolLoopAgent`, typed tools, streaming, provider-agnostic       |
| Files           | **browser-image-compression**           | Client-side receipt compression before upload                    |
| Spreadsheets    | **SheetJS (xlsx)** + **PapaParse**      | Import and export                                                |
| PDF             | **@react-pdf/renderer**                 | Server-rendered report PDFs                                      |
| Push            | **web-push** (VAPID)                    | No Firebase dependency                                           |
| Unit tests      | **Vitest** + **Testing Library**        |                                                                  |
| DB tests        | **pgTAP**                               | RLS policies, triggers, and SQL functions                        |
| E2E             | **Playwright**                          | Chromium desktop + mobile viewport projects                      |
| Lint            | **ESLint 9** flat config + **Prettier** | Plus `eslint-plugin-security` and a11y rules                     |
| Hooks           | **Husky** + **lint-staged**             | Format and lint on commit, `pnpm verify` on push                 |
| CI              | **GitHub Actions**                      | Lint, typecheck, unit, db, e2e, build                            |
| Errors          | **Sentry** (optional, off by default)   | Self-hostable; disabled unless a DSN is set                      |

### Deliberately not used

`Drizzle` (two migration systems fighting over one database — SQL migrations plus generated
types cover it), `Prisma` (RLS-hostile), `Redux`/`Zustand` (RSC plus TanStack Query plus URL
state is enough), `Framer Motion` legacy package name, `moment`, `axios`, `Chart.js`,
LangChain (the AI SDK's tool loop is a better fit and one dependency less).

## 3. Repository layout

```
nido/
├─ .github/workflows/          ci.yml, keepalive.yml
├─ docs/                       this specification
├─ public/                     icons, manifest, og images
├─ supabase/
│  ├─ config.toml
│  ├─ migrations/              NNNNNNNNNNNNNN_description.sql  ← source of truth
│  ├─ seed.sql                 demo space with realistic data
│  ├─ tests/                   pgTAP tests, one file per table/policy group
│  └─ functions/               Edge Functions (Deno)
│     ├─ budget-alerts/
│     ├─ recurring-run/
│     ├─ fx-refresh/
│     ├─ bank-sync/
│     ├─ receipt-extract/
│     └─ _shared/
├─ e2e/                        Playwright specs and fixtures
├─ src/
│  ├─ app/
│  │  ├─ (marketing)/          landing, pricing-free, privacy, changelog
│  │  ├─ (auth)/               sign-in, sign-up, callback, reset
│  │  ├─ (app)/[space]/        dashboard, ledger, budgets, goals, balances, settings
│  │  ├─ api/
│  │  │  ├─ ai/chat/route.ts
│  │  │  └─ webhooks/
│  │  ├─ globals.css           Tailwind v4 @theme — all design tokens live here
│  │  └─ layout.tsx
│  ├─ components/
│  │  ├─ ui/                   shadcn primitives
│  │  ├─ charts/               chart wrappers with our tokens baked in
│  │  ├─ layout/               app shell, sidebar, mobile tab bar, space switcher
│  │  └─ marketing/            landing sections
│  ├─ features/                ← all domain code lives here
│  │  ├─ spaces/
│  │  ├─ transactions/
│  │  ├─ categories/
│  │  ├─ accounts/
│  │  ├─ budgets/
│  │  ├─ goals/
│  │  ├─ recurring/
│  │  ├─ balances/
│  │  ├─ attachments/
│  │  ├─ imports/
│  │  ├─ banking/
│  │  ├─ reports/
│  │  ├─ notifications/
│  │  └─ assistant/
│  ├─ lib/
│  │  ├─ supabase/             server.ts, client.ts, middleware.ts (session helper), database.types.ts
│  │  ├─ money/                Money type, formatting, allocation, FX
│  │  ├─ dates/                period boundaries in a given timezone
│  │  ├─ auth/                 authedAction wrapper, membership resolution
│  │  ├─ ai/                   provider registry, tool definitions
│  │  └─ utils/
│  ├─ i18n/                    messages/es.json, messages/en.json, routing
│  └─ proxy.ts                 session refresh + route protection (Node runtime)
├─ AGENTS.md
├─ README.md
└─ package.json
```

### Feature folder contract

Every folder under `src/features/` follows the same shape, so the agent never has to guess
where something goes:

```
features/transactions/
├─ actions.ts        "use server" — mutations, each wrapped in authedAction
├─ queries.ts        server-side data fetchers + TanStack Query hooks
├─ schemas.ts        Zod schemas shared by forms, actions, and AI tools
├─ types.ts          domain types derived from database.types.ts
├─ lib/              pure logic, unit-tested (splitting, rounding, matching…)
└─ components/       feature-specific React components
```

Rules: a feature may import from `lib/`, `components/ui/`, and its own folder. A feature
importing from another feature's internals is a smell — expose it through that feature's
`queries.ts` or `types.ts` instead.

## 4. Data flow

**Reads.** The first paint of every page comes from a React Server Component that queries
Postgres through the server-side Supabase client, using the user's JWT so RLS applies. There
is no separate "get my data" API. Heavy aggregations are Postgres functions or views, not
JavaScript loops over thousands of rows.

**Mutations.** Forms submit to Server Actions. Every action is wrapped:

```ts
export const createTransaction = authedAction
  .schema(createTransactionSchema)
  .space(({ input }) => input.spaceId) // resolves membership, throws if not a member
  .action(async ({ input, ctx }) => {
    /* ... */
  });
```

The wrapper resolves the session, loads the membership and role, validates input with Zod,
runs the mutation, and calls `revalidateTag`. Optimistic UI comes from `useOptimistic`, so
adding an expense feels instant even on a slow connection.

**Realtime.** The ledger, balances, and budget progress subscribe to Postgres changes for
their space. When one partner adds an expense, it appears on the other's screen within a
second without a refresh. Subscriptions are filtered server-side by `space_id` and are
additionally protected by RLS on the replicated rows.

**Background.** `pg_cron` schedules Edge Functions: budget threshold evaluation and push
delivery (hourly), recurring rule materialization (daily 03:00 in the space timezone), FX
rate refresh (daily), bank sync (every 6 h when enabled), and a monthly close snapshot.

## 5. Authentication and authorization

Supabase Auth with email + password, magic link, and Google OAuth. Sessions are cookie-based
and refreshed in `src/proxy.ts` on every request so Server Components always see a
valid JWT.

Roles inside a space:

| Role     | Can                                                                          |
| -------- | ---------------------------------------------------------------------------- |
| `owner`  | Everything, including deleting the space and transferring ownership          |
| `admin`  | Manage members, categories, budgets, accounts; edit any transaction          |
| `member` | Create transactions; edit and delete their own; read everything in the space |
| `viewer` | Read-only. Useful for a parent or an accountant.                             |

Role checks live in one place: SQL helper functions (`nido.has_role(space_id, roles[])`)
used by RLS policies, mirrored by a TypeScript `can()` helper used to hide UI affordances.
The TypeScript version is a convenience; the SQL version is the truth.

**Invitations** are single-use tokens with a 7-day expiry, stored hashed. Accepting an
invitation while logged out routes through sign-up and then completes automatically.

## 6. Multi-tenancy and RLS strategy

Every domain table carries a `space_id`. The canonical policy pattern is:

```sql
create policy "members read"    on <table> for select using (nido.is_member(space_id));
create policy "members write"   on <table> for insert with check (nido.is_member(space_id, array['owner','admin','member']));
create policy "authors update"  on <table> for update using (nido.can_edit_row(space_id, created_by));
```

`nido.is_member` is a `security definer`, `stable` function reading `space_members`. Making
it a function rather than an inline subquery avoids infinite RLS recursion, is index-friendly,
and keeps the policies readable. It is marked `set search_path = ''` and fully schema-
qualifies everything inside.

Storage follows the same idea: objects are keyed `receipts/{space_id}/{yyyy}/{mm}/{uuid}.webp`
and the bucket policy checks `nido.is_member((storage.foldername(name))[2]::uuid)`. Files are
served through short-lived signed URLs; the bucket is never public.

## 7. Money

Detailed rules are in [`02-DATA-MODEL.md`](./02-DATA-MODEL.md) § Money. The architectural
commitments:

- Amounts are `bigint` minor units plus a `char(3)` ISO-4217 code. No floats anywhere, not
  even in intermediate JavaScript calculations — a `Money` value object wraps a `bigint`.
- A transaction stores both its original amount and its value in the space base currency,
  converted at the transaction date and frozen. Later FX movements never retroactively
  change history.
- Splitting uses **largest remainder allocation**: distribute the floor of each share, then
  hand out the leftover cents one at a time to the largest fractional remainders, breaking
  ties by participant order. This guarantees `sum(splits) === total` for every input.

## 8. Performance budget

| Metric                            | Target               |
| --------------------------------- | -------------------- |
| LCP, landing, mobile 4G           | < 1.2 s              |
| LCP, dashboard, mobile 4G         | < 1.5 s              |
| INP                               | < 200 ms             |
| CLS                               | < 0.05               |
| Initial JS on the dashboard route | < 180 KB gzipped     |
| Ledger scroll with 10 000 rows    | 60 fps (virtualized) |

Techniques: Server Components for anything static, `next/dynamic` for charts and the
assistant panel, `next/font` with `display: swap` and subsetting, aggregation pushed into
SQL, `revalidateTag` instead of blanket revalidation, and `next/after` for logging and
analytics so they never block a response.

## 9. Environment variables

Everything documented here must exist in `.env.example` with a placeholder.

| Variable                                                                | Where           | Required    | Purpose                                                                        |
| ----------------------------------------------------------------------- | --------------- | ----------- | ------------------------------------------------------------------------------ |
| `NEXT_PUBLIC_SUPABASE_URL`                                              | client + server | yes         | Supabase project URL                                                           |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`                                         | client + server | yes         | Anon key; safe to expose, RLS protects data                                    |
| `SUPABASE_SERVICE_ROLE_KEY`                                             | server only     | yes         | Edge Functions and admin scripts. Never imported into a client bundle.         |
| `NEXT_PUBLIC_APP_URL`                                                   | client + server | yes         | Absolute URL for OAuth redirects, emails, OG tags                              |
| `AI_PROVIDER`                                                           | server          | no          | `openai` \| `anthropic` \| `google` \| `ollama`. Unset disables the assistant. |
| `AI_MODEL`                                                              | server          | no          | Model id for the chosen provider                                               |
| `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` / `GOOGLE_GENERATIVE_AI_API_KEY` | server          | no          | Whichever provider is selected                                                 |
| `OLLAMA_BASE_URL`                                                       | server          | no          | Defaults to `http://localhost:11434`                                           |
| `FX_API_URL`                                                            | server          | no          | Exchange rate source; defaults to the free Frankfurter endpoint                |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT`              | server          | no          | Web push. Generated with `pnpm push:keys`.                                     |
| `BANK_PROVIDER`                                                         | server          | no          | `enablebanking` \| `none`                                                      |
| `BANK_APP_ID` / `BANK_PRIVATE_KEY`                                      | server          | no          | PSD2 provider credentials                                                      |
| `RESEND_API_KEY`                                                        | server          | no          | Transactional email; falls back to Supabase's built-in SMTP                    |
| `SENTRY_DSN`                                                            | server          | no          | Error reporting; disabled when unset                                           |
| `CRON_SECRET`                                                           | server          | yes in prod | Shared secret asserted by every Edge Function entry point                      |

Any feature whose variables are unset must degrade gracefully: the UI hides the entry point
and the settings page explains what to configure. Nothing crashes because an optional
integration is not configured.

## 10. Deployment

**Primary: Vercel + Supabase Cloud.** Push to `main` deploys production; pull requests get
preview deployments. Both free tiers are sufficient for a household.

Two free-tier caveats to handle explicitly:

1. A free Supabase project **pauses after seven days without traffic**. Ship
   `.github/workflows/keepalive.yml`, a scheduled job that pings a trivial endpoint every
   two days.
2. Free tier has no automatic backups. Ship `.github/workflows/backup.yml`, a weekly
   `pg_dump` encrypted with `age` and uploaded as a workflow artifact, plus a documented
   `pnpm db:restore` procedure.

**Alternative: self-hosted.** A `docker-compose.yml` at the repo root brings up
self-hosted Supabase plus the Next.js app in standalone output mode. Documented in the
README so someone can run Nido on a NAS.

**Migrations** run in CI via `supabase db push` on merge to `main`, after the test suite
passes. Migrations must be forward-only and safe to apply to a live database: add columns
as nullable then backfill then constrain, never rename in a single step.

## 11. Observability

Structured JSON logs from Server Actions with a request id, the user id, the space id, and
the action name — never amounts, never merchant names, never attachment paths. A
`nido.audit_log` table records who changed which financial row and when, which doubles as
the "activity" feed in the UI. Sentry is optional and disabled by default so a fresh clone
sends nothing anywhere.

## 12. Threat model (what we actually defend against)

| Threat                                           | Mitigation                                                                                                                                                                                              |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Leaked anon key                                  | RLS. The anon key alone grants access to nothing.                                                                                                                                                       |
| Member of space A reading space B                | RLS policies plus pgTAP tests asserting the negative case.                                                                                                                                              |
| Direct object reference on an attachment         | Private bucket, path-scoped policy, signed URLs with short TTL.                                                                                                                                         |
| Malicious upload                                 | MIME sniffing plus extension allowlist plus size cap; images re-encoded to WebP server-side, stripping EXIF including GPS.                                                                              |
| Prompt injection through a merchant name or note | The assistant's tools are read-only and parameterized. The model never emits SQL. Free text from the database is delivered inside a clearly delimited data block with instructions to treat it as data. |
| Data exfiltration via the assistant              | Opt-in per space, user-supplied key, explicit consent screen listing exactly what is sent, and a local-model option that sends nothing.                                                                 |
| CSRF                                             | Server Actions' built-in origin checks plus `SameSite=Lax` cookies.                                                                                                                                     |
| Enumeration of invitation tokens                 | 256-bit tokens stored hashed, constant-time comparison, rate limited.                                                                                                                                   |
| Brute force on sign-in                           | Supabase Auth rate limits plus a per-IP limiter in middleware.                                                                                                                                          |
