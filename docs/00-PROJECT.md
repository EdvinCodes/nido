# 00 — Project

## 1. Vision

Nido is an open-source, self-hostable web application for running the finances of a home.
It scales from one person tracking their own money, to a couple sharing most expenses, to a
flatshare of five people who each owe each other something at the end of the month.

The end state is an application where the household's financial reality is captured
accurately enough that a conversational assistant can be pointed at it and give genuinely
useful answers: *where is the money going, what is unnecessary, and where can we cut*.

Everything before the assistant exists to make the data trustworthy. An AI on top of sloppy
data is a liar with a nice interface.

## 2. Product principles

1. **Honest data beats pretty charts.** If a number on the dashboard cannot be traced to
   the transactions that produced it, the feature is wrong.
2. **Adding a transaction must take under ten seconds on a phone.** Every extra required
   field is a reason to stop using the app. Smart defaults everywhere; detail is optional.
3. **The household is the unit, not the user.** Multi-member is not an add-on mode, it is
   the data model. Solo mode is just a space with one member.
4. **Cents are sacred.** Splits always sum exactly to the total. No rounding drift, ever.
5. **Privacy by construction.** Row Level Security in the database, not just checks in the
   application. The AI is opt-in and can run fully local.
6. **Premium feel is a feature.** This is an app two people will open every day. It should
   feel calm, fast, and expensive — not like an internal admin panel.
7. **Boring, current technology.** Latest stable versions of well-known tools, no exotic
   dependencies that will be unmaintained in a year.

## 3. Scope

### In scope (v1.0)

Authentication and spaces · transaction ledger with flexible splitting · categories ·
accounts · budgets and alerts · savings goals · subscriptions and recurring entries ·
balances and settlements · receipt attachments with AI extraction · CSV import ·
optional bank sync · multi-currency · reports and exports · installable PWA with push
notifications · marketing landing page · AI assistant.

### Explicitly out of scope

- Investment portfolio tracking, net worth over time, asset valuation.
- Tax filing, invoicing, or anything business-accounting related.
- Initiating real payments. Nido records that a settlement happened; it does not move money.
- Double-entry bookkeeping with a full chart of accounts. Nido uses a simplified
  transaction + splits model that is strictly enough for household use.
- Native App Store / Play Store applications in v1. The PWA is installable and is the
  mobile answer.
- Multi-tenant SaaS billing. Anyone who wants Nido self-hosts it or uses the free tiers.

## 4. Users

**Edvin** — primary owner. Wants to see, at a glance, the month's burn rate versus last
month, catch subscriptions that crept up, and know precisely what each of them owes the
other. Uses desktop for analysis and mobile for capture.

**Partner** — co-owner of the space. Wants the fastest possible "add expense" flow and a
clear, non-judgemental view of shared spending. Should never need to understand the
splitting model to use the app correctly.

**Flatshare member** (later) — added to an existing space with limited privileges. Cares
almost exclusively about the balances tab and their own contributions.

**Self-hoster** — someone who finds the repo, wants to run it for their own home in under
thirty minutes, and wants to be sure their data never leaves their machine.

## 5. Glossary

The application code uses these exact terms. Do not invent synonyms.

| Term | Meaning |
| --- | --- |
| **Space** | A household. The tenancy boundary. Every financial row belongs to exactly one space. |
| **Member** | A user's membership in a space, with a role. A user can belong to several spaces. |
| **Participant** | A person in a space who can be assigned a share of a transaction. Every member is a participant; a space can also have "ghost" participants who have no account (e.g. a roommate who does not use the app). |
| **Account** | A place money sits: a bank account, cash, a shared kitty, a credit card. |
| **Transaction** | A single financial event: an expense, an income, or a transfer between accounts. |
| **Split** | One participant's share of a transaction. A transaction has one or more splits summing exactly to its amount. |
| **Payer** | The participant whose money actually left. Distinct from who owes it. |
| **Category** | A user-defined classification with a color and an icon; may have subcategories. |
| **Budget** | A spending limit for a scope over a repeating period. |
| **Goal** | A savings target with an amount, an optional deadline, and contributions. |
| **Recurring rule** | A template that generates transactions on a schedule; subscriptions are recurring rules of kind `subscription`. |
| **Balance** | The net position of a participant within a space: what they paid minus what they owe. |
| **Settlement** | A recorded transfer between two participants that reduces balances to zero. |
| **Base currency** | The space's reporting currency. All analytics are expressed in it. |
| **Minor units** | The smallest unit of a currency (cents for EUR). All amounts are stored as integers in minor units. |

## 6. Roadmap

Thirteen phases, each independently shippable and verifiable. Each phase leaves the app in
a working, demonstrable state — there is no phase whose only output is scaffolding for a
later one.

| # | Phase | Outcome |
| --- | --- | --- |
| 0 | Foundations | Repo, toolchain, design tokens, local Supabase, CI, `pnpm verify` green |
| 1 | Auth & spaces | Sign up, log in, create a space, invite a member, switch spaces |
| 2 | Ledger core | Accounts, categories, transactions with all five split modes |
| 3 | Dashboard & analytics | Summary, charts, filters, period comparison |
| 4 | Budgets & alerts | Limits, progress, threshold notifications |
| 5 | Goals & subscriptions | Savings pots, recurring rules, forecast calendar |
| 6 | Balances & settlements | Who owes whom, minimum-transfer settlement, history |
| 7 | Attachments & OCR | Receipt upload, compression, AI field extraction |
| 8 | Import & bank sync | CSV/XLSX import, dedupe, rules engine, PSD2 provider interface |
| 9 | Multi-currency & reports | FX rates, conversion, monthly close, PDF/Excel export |
| 10 | PWA & notifications | Installable app, offline capture queue, web push |
| 11 | Landing & polish | Marketing site, performance, accessibility, motion pass |
| 12 | AI assistant | Tool-calling agent, insights, provider switching |

Detailed task lists and acceptance criteria: [`phases/`](./phases/README.md).

## 7. Success criteria for v1.0

- Two people use it daily for a full month without opening a spreadsheet.
- Adding a typical expense on mobile takes under ten seconds from app open to saved.
- The balances tab always agrees, to the cent, with a manual recalculation from the ledger.
- Lighthouse: performance ≥ 95, accessibility 100 on both the landing page and the dashboard.
- Cold start of the dashboard under 1.5 s on a mid-range phone over 4G.
- A stranger can clone the repo and have it running locally in under thirty minutes.
- The assistant answers "where can we cut 200 € a month?" with specific, correct,
  transaction-backed suggestions.
