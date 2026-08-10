# 07 — Architecture decision records

Each record states the decision, why, what was rejected, and what it costs. New decisions
made during execution are appended here in the same commit that implements them.

Status values: `Accepted` · `Superseded by ADR-NNN` · `Proposed`.

---

## ADR-001 — Next.js as the single application layer

**Status:** Accepted

React Server Components let the dashboard fetch and aggregate on the server and ship almost
no JavaScript for what is fundamentally a read-heavy analytics view. Server Actions remove
an entire API layer for mutations. One deployable, one language, one type system from the
database row to the rendered number.

**Rejected:** Nuxt (equivalent quality, but the AI SDK, shadcn/ui, and the wider component
ecosystem are React-first, and this project leans on all three). A separate NestJS or
FastAPI backend (a second service, a second deployment, a second auth integration, for a
two-person household — unjustifiable).

**Cost:** Server Actions are Next-specific; a future native mobile app would need a thin
API layer. Acceptable, and Phase 10's PWA is the mobile answer for v1.

---

## ADR-002 — Supabase, with Postgres RLS as the security boundary

**Status:** Accepted

Auth, Postgres, Storage, Realtime, Edge Functions, and cron in one free tier, all open
source and self-hostable, with no proprietary query language. Crucially, Row Level Security
moves multi-tenancy enforcement into the database, where a bug in a React component cannot
bypass it.

**Rejected:** Firebase (document model is a bad fit for the relational aggregations this
product is made of, and vendor lock-in is total). PlanetScale or Neon plus a hand-rolled
auth stack (more code, weaker isolation guarantees). Raw Postgres on a VPS (operations
burden with no upside at this scale).

**Cost:** Free-tier projects pause after seven days of inactivity, and there are no
automatic backups. Both are mitigated by scheduled GitHub Actions (see
[`01-ARCHITECTURE.md`](./01-ARCHITECTURE.md) § 10).

---

## ADR-003 — SQL migrations as the schema source of truth; no ORM

**Status:** Accepted

The schema depends on things ORMs model badly or not at all: RLS policies, `security
definer` functions, deferred constraint triggers, partial indexes, generated columns, and
enums. Hand-written SQL migrations express all of it exactly, and
`supabase gen types typescript` gives full type safety in TypeScript for free.

**Rejected:** Drizzle (good ORM, but running Drizzle migrations alongside Supabase
migrations means two systems owning one schema, which eventually corrupts one of them; and
its RLS support is still thinner than writing the policy). Prisma (historically hostile to
RLS, heavy client, another generation step).

**Cost:** More SQL to write by hand, and no compile-time checking of query strings. Mitigated
by generated row types and by pgTAP tests covering every policy and trigger.

---

## ADR-004 — Money as `bigint` minor units with an explicit currency

**Status:** Accepted

Floating point cannot represent 0.1. `numeric` avoids that but invites accidental
JavaScript coercion to `number` somewhere in the stack, which reintroduces the same bug
silently. Integer minor units plus a `Money` value object make the representation exact and
make a mistake a type error rather than a rounding error.

**Rejected:** `numeric(14,2)` (coercion risk, and still needs a currency column anyway).
Storing formatted strings (absurd, but people do it).

**Cost:** Every read and write goes through conversion helpers, and currencies with a
non-2 exponent require a lookup. Both are one-time costs paid in `src/lib/money`.

---

## ADR-005 — Largest-remainder allocation for splits, enforced by the database

**Status:** Accepted

Splitting 10,00 € three ways must produce 3,34 / 3,33 / 3,33 and never 3,33 / 3,33 / 3,33.
Largest remainder is deterministic, order-stable, and provably exact. A deferred constraint
trigger asserting `sum(splits) = amount` makes it impossible for any code path — including a
future import, a recurring rule, or a manual SQL fix — to create an unbalanced transaction.

**Rejected:** Rounding each share independently (drifts). Dumping the remainder on the payer
(systematically unfair over hundreds of transactions). Enforcing only in the application
(one forgotten code path and the ledger is silently wrong forever).

**Cost:** A deferred trigger on a hot table. Measured and negligible at household volume.

---

## ADR-006 — Participants are separate from users

**Status:** Accepted

A flatmate who never installs the app still owes rent. Modelling "a person who can be
assigned money" separately from "a person who can log in" means ghost participants work
from day one, and converting one into a real member later is just attaching a `user_id`.

**Rejected:** Requiring an account for everyone (blocks the most common flatshare reality).
Storing names as free text on splits (no aggregation, no balances, no history).

**Cost:** One more join in most queries, and two concepts the UI must not confuse. Mitigated
by never showing the word "participant" to the user — they see names.

---

## ADR-007 — Derive balances, do not store them

**Status:** Accepted

A stored balance is a cache, and a cache that disagrees with the ledger destroys trust in
the whole product. The view is fast at household scale, always correct, and always explainable
down to the individual transaction.

**Rejected:** A running balance column maintained by triggers (fast, but any bug or any
manual data fix silently corrupts it, and reconciliation becomes a support problem).

**Cost:** Aggregation on read. If it ever becomes slow, the fix is a materialized view
refreshed on write — a change contained to one file. `budget_periods.spent_minor` is the
one deliberate exception, because alerting needs a value that can be compared against a
threshold at write time, and it is reconciled nightly against the ledger.

---

## ADR-008 — Progressive Web App instead of native, for v1

**Status:** Accepted

One codebase, instant updates, no app store review, installable on both platforms, with
camera access, offline support, and — since iOS 16.4 — web push. The mobile experience here
is capture and glance, not anything requiring native APIs.

**Rejected:** React Native or Expo in a monorepo (roughly doubles the surface area, adds a
build and release pipeline, for a two-user product). Capacitor wrapper (all of the PWA's
limits plus a store submission).

**Cost:** No widgets, no Siri shortcuts, and iOS web push requires the user to install to
the home screen first. Documented in the app's notification settings. Revisit after v1.

---

## ADR-009 — Bank sync behind a provider interface, with import as the guaranteed path

**Status:** Accepted

The free PSD2 landscape is unstable: Nordigen's free tier, later GoCardless Bank Account
Data, closed to new signups and is being wound down. Enable Banking currently offers
"Restricted Production" access — real production data, limited to accounts you link
yourself — which is exactly this project's use case and is free. That could change too.

Therefore: automatic bank sync is an **optional plugin** behind a five-method interface,
with `enablebanking` and `none` implementations. CSV/XLSX import is the guaranteed,
dependency-free path and every bank sync result flows through the identical dedupe,
categorization, and preview pipeline. If a provider dies, one file is replaced and nothing
else in the application notices.

**Rejected:** Making bank sync a core dependency (a third party would be able to break the
product). Plaid or Tink (eIDAS certificate or enterprise contract required — not viable).
Screen scraping (fragile, and a terms-of-service violation).

**Cost:** An abstraction layer over a single implementation, which is usually a smell.
Justified here by a documented history of providers disappearing.

---

## ADR-010 — The AI assistant uses tools, not a data dump

**Status:** Accepted

Full reasoning in [`05-AI-ASSISTANT.md`](./05-AI-ASSISTANT.md) § 2. Summary: models cannot
reliably sum hundreds of numbers, context windows and costs do not scale with a growing
ledger, dumping everything leaks data irrelevant to the question, and a tool result gives
every figure a citation the user can click through to verify.

**Rejected:** RAG over transaction embeddings (semantic similarity is the wrong retrieval
mechanism for "sum everything in category X between two dates" — that is a SQL query, not a
nearest-neighbour search). Fine-tuning (absurd for per-household data). Text-to-SQL with
model-generated queries (injection surface, and no guarantee the query is correct or bounded).

**Cost:** Twelve tools to write and maintain, and a model that occasionally picks the wrong
one. Mitigated by a thirty-question evaluation set with known-correct answers.

---

## ADR-011 — Provider-agnostic AI with a local option

**Status:** Accepted

The AI SDK's uniform interface means `AI_PROVIDER=ollama` is a one-variable change to a
configuration that sends no financial data anywhere. For an open-source household finance
app, that option is not a nice-to-have; it is the difference between people trusting the
project and not.

**Rejected:** Hardcoding one vendor. Shipping a hosted key (cost, abuse, and a privacy
promise the project cannot keep).

**Cost:** Cannot depend on any single provider's exclusive features. Acceptable — nothing in
the assistant's design needs them.

---

## ADR-012 — Warm, dark-first palette; income and expense are not green and red

**Status:** Accepted

Sage and coral at matched lightness are distinguishable under the common forms of
colour-vision deficiency, whereas pure green and red are not. Direction is additionally
encoded by a sign glyph, so colour is never the only signal. The warm neutral base is a
deliberate departure from the cold blue-grey that every finance product uses, and it costs
nothing.

**Rejected:** Conventional green/red (accessibility failure, and visually identical to every
competitor). A light-first design (this app is opened at night, on a phone, in bed).

**Cost:** A short period of unfamiliarity. Resolved by the sign glyph and consistent usage.
