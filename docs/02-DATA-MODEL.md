# 02 — Data model

This document is the reference implementation of the schema. The executing agent writes it
into `supabase/migrations/` in the order given, one migration per phase (not one giant
migration). The SQL here is Postgres 17 and is meant to be used almost verbatim.

Naming: `snake_case`, plural table names, singular column names, `_id` suffix for foreign
keys, `_at` suffix for timestamps, `_minor` suffix for integer money.

---

## 1. Money

**Rule: money is a `bigint` count of minor units plus an ISO-4217 code. Never `float`,
never `numeric` for storage of amounts, never a bare number without its currency.**

```sql
create domain nido.currency_code as char(3)
  check (value ~ '^[A-Z]{3}$');
```

Every monetary column comes in pairs:

- `amount_minor bigint not null` — the amount as entered, in `currency`
- `currency nido.currency_code not null`
- `base_amount_minor bigint not null` — the same value converted to the space's base
  currency using the rate on the transaction date, **frozen at write time**
- `base_rate numeric(20,10) not null default 1` — the rate that was used, kept for audit

Minor unit exponents differ by currency (JPY has 0 decimals, TND has 3). A
`nido.currencies` lookup table stores `exponent`, and all formatting goes through it. Do not
hardcode `/ 100`.

### Allocation (the splitting algorithm)

Given a total in minor units and a list of weights, produce integer shares that sum exactly
to the total:

1. Compute each participant's exact share as `total * weight / sum(weights)` in rational
   arithmetic.
2. Give each participant `floor(share)`.
3. Compute `remainder = total - sum(floors)`.
4. Sort participants by fractional part descending, then by a stable key (participant
   position in the space) ascending.
5. Give one extra minor unit to each of the first `remainder` participants.

This is **largest remainder allocation**. It is implemented once, as a pure function in
`src/features/transactions/lib/allocate.ts`, and mirrored in SQL as
`nido.allocate(total bigint, weights numeric[])` for server-side generation of recurring
transactions. Both implementations are covered by property-based tests asserting that the
sum always equals the total, including for negative totals, zero weights, and one-cent
totals split five ways.

---

## 2. Enumerations

```sql
create type nido.space_kind        as enum ('solo', 'couple', 'shared');
create type nido.member_role       as enum ('owner', 'admin', 'member', 'viewer');
create type nido.member_status     as enum ('active', 'invited', 'left', 'removed');
create type nido.account_kind      as enum ('cash', 'bank', 'card', 'savings', 'shared_pot', 'other');
create type nido.tx_kind           as enum ('expense', 'income', 'transfer');
create type nido.split_mode        as enum ('personal', 'equal', 'shares', 'percent', 'exact');
create type nido.category_kind     as enum ('expense', 'income', 'both');
create type nido.budget_period     as enum ('day', 'week', 'month', 'quarter', 'year');
create type nido.budget_scope      as enum ('space', 'participant', 'category', 'category_participant');
create type nido.recurrence_freq   as enum ('day', 'week', 'month', 'year');
create type nido.recurring_kind    as enum ('subscription', 'bill', 'income', 'transfer');
create type nido.goal_status       as enum ('active', 'reached', 'paused', 'archived');
create type nido.notification_kind as enum (
  'budget_threshold', 'budget_exceeded', 'recurring_due', 'recurring_price_change',
  'goal_reached', 'settlement_request', 'settlement_confirmed', 'member_joined',
  'import_finished', 'bank_sync_failed', 'insight'
);
create type nido.import_status     as enum ('draft', 'mapping', 'previewing', 'committed', 'failed');
```

---

## 3. Core tenancy

### `profiles`

Mirrors `auth.users` with the application-level fields. Populated by a trigger on
`auth.users` insert.

```sql
create table nido.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  display_name  text not null check (length(display_name) between 1 and 60),
  avatar_url    text,
  locale        text not null default 'es' check (locale in ('es','en')),
  timezone      text not null default 'Europe/Madrid',
  theme         text not null default 'system' check (theme in ('light','dark','system')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
```

### `spaces`

```sql
create table nido.spaces (
  id             uuid primary key default gen_random_uuid(),
  name           text not null check (length(name) between 1 and 80),
  kind           nido.space_kind not null default 'solo',
  base_currency  nido.currency_code not null default 'EUR',
  timezone       text not null default 'Europe/Madrid',
  week_starts_on smallint not null default 1 check (week_starts_on between 0 and 6),
  month_starts_on smallint not null default 1 check (month_starts_on between 1 and 28),
  settings       jsonb not null default '{}'::jsonb,
  created_by     uuid not null references nido.profiles(id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  archived_at    timestamptz
);
```

`month_starts_on` matters: a household whose salary lands on the 25th wants their
"month" to run from the 25th, and every budget and dashboard period must respect it.

### `participants`

The people who can be assigned money in a space. Decoupled from `auth.users` so a
flatmate who never installs the app can still owe money.

```sql
create table nido.participants (
  id           uuid primary key default gen_random_uuid(),
  space_id     uuid not null references nido.spaces(id) on delete cascade,
  user_id      uuid references nido.profiles(id) on delete set null,  -- null = ghost participant
  display_name text not null,
  color        text not null default '#8B8B8B' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  avatar_url   text,
  position     smallint not null default 0,       -- stable tie-break for allocation
  default_weight numeric(10,4) not null default 1 check (default_weight >= 0),
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  unique (space_id, user_id)
);
create index on nido.participants (space_id) where is_active;
```

### `space_members`

The authorization table. A row here means a real user has access to the space.

```sql
create table nido.space_members (
  space_id       uuid not null references nido.spaces(id) on delete cascade,
  user_id        uuid not null references nido.profiles(id) on delete cascade,
  participant_id uuid not null references nido.participants(id) on delete cascade,
  role           nido.member_role not null default 'member',
  status         nido.member_status not null default 'active',
  joined_at      timestamptz not null default now(),
  primary key (space_id, user_id)
);
create index on nido.space_members (user_id) where status = 'active';
```

### `space_invitations`

```sql
create table nido.space_invitations (
  id           uuid primary key default gen_random_uuid(),
  space_id     uuid not null references nido.spaces(id) on delete cascade,
  email        citext,
  token_hash   bytea not null unique,          -- sha256 of a 32-byte random token
  role         nido.member_role not null default 'member',
  participant_id uuid references nido.participants(id) on delete set null,
  invited_by   uuid not null references nido.profiles(id),
  expires_at   timestamptz not null default now() + interval '7 days',
  accepted_at  timestamptz,
  accepted_by  uuid references nido.profiles(id),
  revoked_at   timestamptz,
  created_at   timestamptz not null default now()
);
```

The raw token is shown once, in the invite link, and never stored.

---

## 4. Classification

### `categories`

```sql
create table nido.categories (
  id          uuid primary key default gen_random_uuid(),
  space_id    uuid not null references nido.spaces(id) on delete cascade,
  parent_id   uuid references nido.categories(id) on delete cascade,
  name        text not null check (length(name) between 1 and 50),
  kind        nido.category_kind not null default 'expense',
  color       text not null check (color ~ '^#[0-9A-Fa-f]{6}$'),
  icon        text not null default 'circle',    -- lucide icon name
  position    smallint not null default 0,
  is_system   boolean not null default false,    -- seeded defaults, renamable but not deletable
  archived_at timestamptz,
  created_at  timestamptz not null default now(),
  unique (space_id, parent_id, name)
);
create index on nido.categories (space_id) where archived_at is null;
```

Maximum depth is two (category → subcategory), enforced by a check trigger. Deeper trees
make every aggregation query and every UI picker worse for no real benefit.

A default set is seeded on space creation: Housing, Groceries, Eating out, Transport,
Health, Leisure, Subscriptions, Shopping, Pets, Travel, Education, Gifts, Fees, Other for
expenses; Salary, Freelance, Refunds, Gifts, Investments, Other for income. The seed
carries sensible colors and lucide icon names.

### `tags`

Free-form cross-cutting labels (`#holidays-2026`, `#reimbursable`). Many-to-many with
transactions.

```sql
create table nido.tags (
  id       uuid primary key default gen_random_uuid(),
  space_id uuid not null references nido.spaces(id) on delete cascade,
  name     citext not null,
  color    text not null default '#8B8B8B',
  unique (space_id, name)
);

create table nido.transaction_tags (
  transaction_id uuid not null references nido.transactions(id) on delete cascade,
  tag_id         uuid not null references nido.tags(id) on delete cascade,
  primary key (transaction_id, tag_id)
);
```

### `accounts`

```sql
create table nido.accounts (
  id                uuid primary key default gen_random_uuid(),
  space_id          uuid not null references nido.spaces(id) on delete cascade,
  name              text not null,
  kind              nido.account_kind not null default 'bank',
  currency          nido.currency_code not null,
  owner_participant_id uuid references nido.participants(id) on delete set null, -- null = shared
  opening_balance_minor bigint not null default 0,
  color             text not null default '#8B8B8B',
  icon              text not null default 'wallet',
  include_in_totals boolean not null default true,
  archived_at       timestamptz,
  created_at        timestamptz not null default now()
);
```

Accounts are optional for the user (a transaction can have a null `account_id`) but the
model needs them for bank sync, for real balances, and for transfers.

---

## 5. The ledger

### `transactions`

```sql
create table nido.transactions (
  id                uuid primary key default gen_random_uuid(),
  space_id          uuid not null references nido.spaces(id) on delete cascade,
  kind              nido.tx_kind not null,
  booked_on         date not null,                       -- the accounting day
  occurred_at       timestamptz,                          -- optional precise moment
  amount_minor      bigint not null check (amount_minor > 0),
  currency          nido.currency_code not null,
  base_amount_minor bigint not null,
  base_rate         numeric(20,10) not null default 1,
  description       text not null default '' check (length(description) <= 200),
  merchant          text check (length(merchant) <= 120),
  notes             text check (length(notes) <= 2000),
  category_id       uuid references nido.categories(id) on delete set null,
  account_id        uuid references nido.accounts(id) on delete set null,
  to_account_id     uuid references nido.accounts(id) on delete set null,  -- transfers only
  payer_participant_id uuid references nido.participants(id) on delete set null,
  split_mode        nido.split_mode not null default 'personal',
  recurring_rule_id uuid references nido.recurring_rules(id) on delete set null,
  goal_id           uuid references nido.goals(id) on delete set null,
  import_row_id     uuid references nido.import_rows(id) on delete set null,
  external_id       text,                                 -- bank transaction id, for dedupe
  is_pending        boolean not null default false,
  created_by        uuid not null references nido.profiles(id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz,

  constraint transfer_shape check (
    (kind = 'transfer' and to_account_id is not null and account_id is not null
       and to_account_id <> account_id and category_id is null)
    or (kind <> 'transfer' and to_account_id is null)
  ),
  constraint payer_required check (kind = 'transfer' or payer_participant_id is not null)
);

create index on nido.transactions (space_id, booked_on desc) where deleted_at is null;
create index on nido.transactions (space_id, category_id, booked_on) where deleted_at is null;
create index on nido.transactions (space_id, payer_participant_id, booked_on) where deleted_at is null;
create unique index on nido.transactions (space_id, external_id) where external_id is not null and deleted_at is null;
create index on nido.transactions using gin (to_tsvector('simple', coalesce(description,'') || ' ' || coalesce(merchant,'') || ' ' || coalesce(notes,'')));
```

`amount_minor` is always positive; direction comes from `kind`. Mixing sign conventions
with a kind column is the classic source of double-negative bugs.

Deletion is soft (`deleted_at`) so an accidental delete on a phone is recoverable and so
the audit log stays coherent. Every query filters `deleted_at is null` — enforced by using
the `nido.v_transactions` view rather than the base table in application code.

### `transaction_splits`

```sql
create table nido.transaction_splits (
  id                uuid primary key default gen_random_uuid(),
  transaction_id    uuid not null references nido.transactions(id) on delete cascade,
  space_id          uuid not null references nido.spaces(id) on delete cascade,  -- denormalized for RLS
  participant_id    uuid not null references nido.participants(id) on delete cascade,
  weight            numeric(12,4) not null default 1 check (weight >= 0),
  owed_minor        bigint not null,
  base_owed_minor   bigint not null,
  unique (transaction_id, participant_id)
);
create index on nido.transaction_splits (space_id, participant_id);
```

A deferred constraint trigger asserts, after every statement, that for each affected
transaction `sum(owed_minor) = amount_minor`. This is the single most important invariant
in the database and it is enforced by the database, not by hope.

Split modes and how they produce weights:

| Mode | Meaning | Weights |
| --- | --- | --- |
| `personal` | One participant owes it all | single split, weight 1 |
| `equal` | Split evenly between the selected participants | all weights 1 |
| `shares` | "He counts double, she counts once" | user-supplied integers |
| `percent` | 70 / 30 | percentages as weights, must total 100 |
| `exact` | Explicit cent amounts | weights ignored, `owed_minor` given directly, must total the amount |

For `income`, splits mean "who this income belongs to" — the same machinery, different
sign at read time.

### `attachments`

```sql
create table nido.attachments (
  id             uuid primary key default gen_random_uuid(),
  space_id       uuid not null references nido.spaces(id) on delete cascade,
  transaction_id uuid references nido.transactions(id) on delete cascade,
  storage_path   text not null unique,
  mime_type      text not null,
  size_bytes     integer not null check (size_bytes > 0 and size_bytes <= 10485760),
  width          integer,
  height         integer,
  blurhash       text,
  ocr_status     text not null default 'none' check (ocr_status in ('none','queued','done','failed')),
  ocr_result     jsonb,
  uploaded_by    uuid not null references nido.profiles(id),
  created_at     timestamptz not null default now()
);
```

---

## 6. Budgets

```sql
create table nido.budgets (
  id             uuid primary key default gen_random_uuid(),
  space_id       uuid not null references nido.spaces(id) on delete cascade,
  name           text not null,
  scope          nido.budget_scope not null,
  category_id    uuid references nido.categories(id) on delete cascade,
  participant_id uuid references nido.participants(id) on delete cascade,
  period         nido.budget_period not null default 'month',
  limit_minor    bigint not null check (limit_minor > 0),
  currency       nido.currency_code not null,
  include_subcategories boolean not null default true,
  rollover       boolean not null default false,   -- unspent carries into the next period
  starts_on      date not null default current_date,
  ends_on        date,
  alert_thresholds smallint[] not null default '{50,80,100}',
  is_active      boolean not null default true,
  created_by     uuid not null references nido.profiles(id),
  created_at     timestamptz not null default now(),

  constraint scope_shape check (
    (scope = 'space'                and category_id is null     and participant_id is null) or
    (scope = 'category'             and category_id is not null and participant_id is null) or
    (scope = 'participant'          and category_id is null     and participant_id is not null) or
    (scope = 'category_participant' and category_id is not null and participant_id is not null)
  )
);
```

```sql
-- One row per budget per period, so we can alert exactly once per threshold.
create table nido.budget_periods (
  id            uuid primary key default gen_random_uuid(),
  budget_id     uuid not null references nido.budgets(id) on delete cascade,
  space_id      uuid not null references nido.spaces(id) on delete cascade,
  starts_on     date not null,
  ends_on       date not null,
  limit_minor   bigint not null,                 -- includes rollover from the previous period
  spent_minor   bigint not null default 0,       -- maintained by trigger on splits
  notified      smallint[] not null default '{}',
  unique (budget_id, starts_on)
);
```

`spent_minor` is maintained incrementally by a trigger on `transaction_splits` rather than
recomputed on read. A nightly Edge Function recomputes it from scratch and logs a warning
if it ever drifts, which is how you find out about a bug in the trigger before the user does.

Budget consumption counts a split's `base_owed_minor` when the budget is participant-scoped,
and the transaction's `base_amount_minor` when it is space-scoped. Transfers never count.

---

## 7. Goals

```sql
create table nido.goals (
  id             uuid primary key default gen_random_uuid(),
  space_id       uuid not null references nido.spaces(id) on delete cascade,
  name           text not null,
  description    text,
  target_minor   bigint not null check (target_minor > 0),
  currency       nido.currency_code not null,
  saved_minor    bigint not null default 0,
  target_date    date,
  account_id     uuid references nido.accounts(id) on delete set null,
  color          text not null default '#8B8B8B',
  icon           text not null default 'piggy-bank',
  status         nido.goal_status not null default 'active',
  auto_contribute_minor bigint,                  -- suggested monthly amount
  created_by     uuid not null references nido.profiles(id),
  created_at     timestamptz not null default now()
);

create table nido.goal_contributions (
  id             uuid primary key default gen_random_uuid(),
  goal_id        uuid not null references nido.goals(id) on delete cascade,
  space_id       uuid not null references nido.spaces(id) on delete cascade,
  participant_id uuid not null references nido.participants(id),
  amount_minor   bigint not null,                -- negative = withdrawal
  transaction_id uuid references nido.transactions(id) on delete set null,
  note           text,
  contributed_on date not null default current_date,
  created_at     timestamptz not null default now()
);
```

`goals.saved_minor` is a trigger-maintained sum of contributions. When a goal reaches its
target, a trigger inserts a `goal_reached` notification for every active member.

---

## 8. Recurring rules and subscriptions

```sql
create table nido.recurring_rules (
  id                uuid primary key default gen_random_uuid(),
  space_id          uuid not null references nido.spaces(id) on delete cascade,
  kind              nido.recurring_kind not null default 'subscription',
  name              text not null,
  merchant          text,
  amount_minor      bigint not null check (amount_minor > 0),
  currency          nido.currency_code not null,
  category_id       uuid references nido.categories(id) on delete set null,
  account_id        uuid references nido.accounts(id) on delete set null,
  payer_participant_id uuid references nido.participants(id) on delete set null,
  split_mode        nido.split_mode not null default 'equal',
  split_config      jsonb not null default '[]'::jsonb,   -- [{participant_id, weight}]
  freq              nido.recurrence_freq not null default 'month',
  interval_count    smallint not null default 1 check (interval_count > 0),
  by_month_day      smallint check (by_month_day between -1 and 31),  -- -1 = last day
  by_weekday        smallint check (by_weekday between 0 and 6),
  starts_on         date not null,
  ends_on           date,
  next_run_on       date not null,
  last_run_on       date,
  auto_create       boolean not null default true,   -- false = only remind, do not post
  reminder_days_before smallint not null default 2,
  is_active         boolean not null default true,
  cancelled_at      timestamptz,
  cancel_url        text,
  notes             text,
  created_by        uuid not null references nido.profiles(id),
  created_at        timestamptz not null default now()
);
create index on nido.recurring_rules (next_run_on) where is_active;

-- Price history, so "Netflix went up again" is a fact, not a feeling.
create table nido.recurring_price_changes (
  id           uuid primary key default gen_random_uuid(),
  rule_id      uuid not null references nido.recurring_rules(id) on delete cascade,
  space_id     uuid not null references nido.spaces(id) on delete cascade,
  old_amount_minor bigint not null,
  new_amount_minor bigint not null,
  detected_on  date not null default current_date,
  source       text not null default 'manual' check (source in ('manual','import','bank'))
);
```

A daily Edge Function materializes every rule whose `next_run_on <= today` into a real
transaction with its splits, advances `next_run_on`, and emits reminders for rules coming
due within `reminder_days_before`. Materialization is idempotent: a unique index on
`(recurring_rule_id, booked_on)` means running it twice creates nothing twice.

**Ghost subscription detection** (Phase 5, refined by the assistant in Phase 12): a rule is
flagged when it is active, has been charged at least three times, and no transaction in a
correlated category has occurred, or the user has not opened anything related — in practice
the heuristic is "active subscription, charged ≥ 3 times, never marked as used, and the
user has not interacted with the merchant in 90 days". The UI presents it as a question,
never as an accusation.

---

## 9. Balances and settlements

Balances are **derived, never stored**. A view computes, per participant:
`paid` (sum of transactions where they are the payer) minus `owed` (sum of their splits),
plus settlements received minus settlements sent.

```sql
create view nido.v_participant_balances as
with paid as (
  select t.space_id, t.payer_participant_id as participant_id,
         sum(case when t.kind = 'expense' then t.base_amount_minor
                  when t.kind = 'income'  then -t.base_amount_minor else 0 end) as paid_minor
  from nido.transactions t
  where t.deleted_at is null and t.kind <> 'transfer'
  group by 1, 2
),
owed as (
  select s.space_id, s.participant_id,
         sum(case when t.kind = 'expense' then s.base_owed_minor
                  when t.kind = 'income'  then -s.base_owed_minor else 0 end) as owed_minor
  from nido.transaction_splits s
  join nido.transactions t on t.id = s.transaction_id
  where t.deleted_at is null and t.kind <> 'transfer'
  group by 1, 2
),
settled as (
  select space_id, from_participant_id as participant_id, sum(base_amount_minor) as delta
  from nido.settlements where confirmed_at is not null group by 1, 2
  union all
  select space_id, to_participant_id, -sum(base_amount_minor)
  from nido.settlements where confirmed_at is not null group by 1, 2
)
select p.space_id, p.id as participant_id,
       coalesce(pd.paid_minor,0) - coalesce(ow.owed_minor,0) + coalesce(sum(st.delta),0) as net_minor
from nido.participants p
left join paid     pd on pd.space_id = p.space_id and pd.participant_id = p.id
left join owed     ow on ow.space_id = p.space_id and ow.participant_id = p.id
left join settled  st on st.space_id = p.space_id and st.participant_id = p.id
group by p.space_id, p.id, pd.paid_minor, ow.owed_minor;
```

Positive `net_minor` means the space owes this participant; negative means they owe the space.
The sum across all participants in a space is always zero — asserted by a pgTAP test.

```sql
create table nido.settlements (
  id                  uuid primary key default gen_random_uuid(),
  space_id            uuid not null references nido.spaces(id) on delete cascade,
  from_participant_id uuid not null references nido.participants(id),
  to_participant_id   uuid not null references nido.participants(id),
  amount_minor        bigint not null check (amount_minor > 0),
  currency            nido.currency_code not null,
  base_amount_minor   bigint not null,
  method              text check (method in ('cash','transfer','bizum','other')),
  note                text,
  settled_on          date not null default current_date,
  confirmed_at        timestamptz,
  confirmed_by        uuid references nido.profiles(id),
  created_by          uuid not null references nido.profiles(id),
  created_at          timestamptz not null default now(),
  check (from_participant_id <> to_participant_id)
);
```

A settlement is proposed by one side and confirmed by the other (or auto-confirmed if the
recipient is a ghost participant). Only confirmed settlements affect balances.

**Minimum-transfer simplification** is a pure TypeScript function: take the net balance
vector, repeatedly match the largest debtor with the largest creditor, emit a transfer for
the smaller absolute amount, and continue. For *n* participants this yields at most *n − 1*
transfers, which is optimal for the greedy formulation and is what every user actually
wants. Unit tests cover 2, 3, 5, and 8 participants plus the all-zero case.

---

## 10. FX

```sql
create table nido.currencies (
  code     nido.currency_code primary key,
  name     text not null,
  symbol   text not null,
  exponent smallint not null default 2
);

create table nido.exchange_rates (
  base    nido.currency_code not null,
  quote   nido.currency_code not null,
  rate    numeric(20,10) not null check (rate > 0),
  as_of   date not null,
  source  text not null default 'frankfurter',
  primary key (base, quote, as_of)
);
create index on nido.exchange_rates (base, quote, as_of desc);
```

`nido.convert(amount bigint, from_code, to_code, on_date date)` returns the converted
minor-unit amount using the most recent rate at or before `on_date`, falling back to the
oldest known rate with a warning flag. Rates refresh daily from Frankfurter (ECB data, no
key required). If the network is unavailable, the last known rate is used — conversion never
blocks writing a transaction.

---

## 11. Import and banking

```sql
create table nido.import_batches (
  id           uuid primary key default gen_random_uuid(),
  space_id     uuid not null references nido.spaces(id) on delete cascade,
  source       text not null,                 -- 'csv' | 'xlsx' | 'bank:<provider>'
  file_name    text,
  account_id   uuid references nido.accounts(id) on delete set null,
  mapping      jsonb not null default '{}'::jsonb,
  status       nido.import_status not null default 'draft',
  row_count    integer not null default 0,
  imported_count integer not null default 0,
  skipped_count  integer not null default 0,
  created_by   uuid not null references nido.profiles(id),
  created_at   timestamptz not null default now()
);

create table nido.import_rows (
  id            uuid primary key default gen_random_uuid(),
  batch_id      uuid not null references nido.import_batches(id) on delete cascade,
  space_id      uuid not null references nido.spaces(id) on delete cascade,
  raw           jsonb not null,
  parsed        jsonb,
  fingerprint   text not null,               -- sha256(date|amount|normalized description|account)
  duplicate_of  uuid references nido.transactions(id) on delete set null,
  decision      text not null default 'pending' check (decision in ('pending','import','skip','duplicate')),
  error         text
);
create index on nido.import_rows (space_id, fingerprint);
```

```sql
-- Auto-categorization rules, learned or hand-written.
create table nido.categorization_rules (
  id           uuid primary key default gen_random_uuid(),
  space_id     uuid not null references nido.spaces(id) on delete cascade,
  match_type   text not null check (match_type in ('contains','starts_with','regex','exact')),
  pattern      text not null,
  field        text not null default 'description' check (field in ('description','merchant','notes')),
  category_id  uuid not null references nido.categories(id) on delete cascade,
  set_merchant text,
  priority     smallint not null default 100,
  auto_learned boolean not null default false,
  hit_count    integer not null default 0,
  created_at   timestamptz not null default now()
);
```

When a user recategorizes an imported transaction, Nido offers to create a rule. Accepted
rules apply to future imports. This is the difference between an import feature people use
twice and one they use every month.

```sql
create table nido.bank_connections (
  id             uuid primary key default gen_random_uuid(),
  space_id       uuid not null references nido.spaces(id) on delete cascade,
  provider       text not null,
  institution_id text not null,
  institution_name text not null,
  logo_url       text,
  session_ref    text not null,             -- provider session/requisition id, NOT credentials
  status         text not null default 'active' check (status in ('active','expired','error','revoked')),
  consent_expires_at timestamptz,
  last_synced_at timestamptz,
  last_error     text,
  created_by     uuid not null references nido.profiles(id),
  created_at     timestamptz not null default now()
);

create table nido.bank_accounts (
  id             uuid primary key default gen_random_uuid(),
  connection_id  uuid not null references nido.bank_connections(id) on delete cascade,
  space_id       uuid not null references nido.spaces(id) on delete cascade,
  account_id     uuid references nido.accounts(id) on delete set null,  -- link to a Nido account
  external_id    text not null,
  iban_last4     text,
  name           text,
  currency       nido.currency_code not null,
  balance_minor  bigint,
  balance_as_of  timestamptz,
  unique (connection_id, external_id)
);
```

**No bank credentials are ever stored.** The provider holds the consent; Nido stores only a
session reference. The provider itself is behind an interface
(`src/features/banking/lib/provider.ts`) with a single implementation for Enable Banking
and a `none` implementation, so the feature can be swapped when the regulatory landscape
changes — which it does, often. See [`07-ADR.md`](./07-ADR.md) ADR-009.

---

## 12. Notifications and audit

```sql
create table nido.notifications (
  id          uuid primary key default gen_random_uuid(),
  space_id    uuid not null references nido.spaces(id) on delete cascade,
  user_id     uuid not null references nido.profiles(id) on delete cascade,
  kind        nido.notification_kind not null,
  title       text not null,
  body        text,
  payload     jsonb not null default '{}'::jsonb,
  link        text,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index on nido.notifications (user_id, created_at desc) where read_at is null;

create table nido.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references nido.profiles(id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  user_agent text,
  created_at timestamptz not null default now()
);

create table nido.notification_preferences (
  user_id  uuid not null references nido.profiles(id) on delete cascade,
  space_id uuid not null references nido.spaces(id) on delete cascade,
  kind     nido.notification_kind not null,
  in_app   boolean not null default true,
  push     boolean not null default true,
  email    boolean not null default false,
  primary key (user_id, space_id, kind)
);

create table nido.audit_log (
  id         bigint generated always as identity primary key,
  space_id   uuid not null references nido.spaces(id) on delete cascade,
  actor_id   uuid references nido.profiles(id) on delete set null,
  entity     text not null,
  entity_id  uuid not null,
  action     text not null check (action in ('insert','update','delete','restore')),
  diff       jsonb,
  created_at timestamptz not null default now()
);
create index on nido.audit_log (space_id, created_at desc);
```

A generic `nido.tg_audit()` trigger writes to `audit_log` for transactions, splits, budgets,
goals, settlements, and members. The diff stores changed columns only, and monetary values
are included because the log is only readable by space members.

---

## 13. AI

```sql
create table nido.ai_conversations (
  id         uuid primary key default gen_random_uuid(),
  space_id   uuid not null references nido.spaces(id) on delete cascade,
  user_id    uuid not null references nido.profiles(id) on delete cascade,
  title      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table nido.ai_messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references nido.ai_conversations(id) on delete cascade,
  space_id        uuid not null references nido.spaces(id) on delete cascade,
  role            text not null check (role in ('user','assistant','tool','system')),
  content         jsonb not null,          -- AI SDK message parts
  tool_calls      jsonb,
  token_usage     jsonb,
  created_at      timestamptz not null default now()
);

create table nido.ai_insights (
  id          uuid primary key default gen_random_uuid(),
  space_id    uuid not null references nido.spaces(id) on delete cascade,
  kind        text not null,               -- 'saving_opportunity' | 'anomaly' | 'trend' | 'ghost_subscription'
  title       text not null,
  body        text not null,
  severity    text not null default 'info' check (severity in ('info','warning','critical')),
  evidence    jsonb not null default '{}'::jsonb,   -- transaction ids backing the claim
  potential_saving_minor bigint,
  dismissed_at timestamptz,
  created_at  timestamptz not null default now()
);
```

Every insight must carry `evidence` referencing real transaction ids. An insight the user
cannot click through to verify does not get shown.

---

## 14. RLS

Enabled on **every** table in the `nido` schema. Helper functions first:

```sql
create schema if not exists nido;

create or replace function nido.is_member(p_space_id uuid, p_roles nido.member_role[] default null)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from nido.space_members m
    where m.space_id = p_space_id
      and m.user_id  = (select auth.uid())
      and m.status   = 'active'
      and (p_roles is null or m.role = any(p_roles))
  );
$$;

create or replace function nido.my_participant_id(p_space_id uuid)
returns uuid
language sql stable security definer set search_path = ''
as $$
  select m.participant_id from nido.space_members m
  where m.space_id = p_space_id and m.user_id = (select auth.uid()) and m.status = 'active';
$$;
```

Wrapping `auth.uid()` in a scalar subquery lets Postgres evaluate it once per query
instead of once per row — a large difference on the ledger.

Canonical policy set, applied to every space-scoped table:

```sql
alter table nido.transactions enable row level security;

create policy "read for members" on nido.transactions
  for select using (nido.is_member(space_id));

create policy "insert for contributors" on nido.transactions
  for insert with check (
    nido.is_member(space_id, array['owner','admin','member']::nido.member_role[])
    and created_by = (select auth.uid())
  );

create policy "update own or admin" on nido.transactions
  for update using (
    nido.is_member(space_id, array['owner','admin']::nido.member_role[])
    or (nido.is_member(space_id, array['member']::nido.member_role[]) and created_by = (select auth.uid()))
  );

create policy "delete own or admin" on nido.transactions
  for delete using (
    nido.is_member(space_id, array['owner','admin']::nido.member_role[])
    or (nido.is_member(space_id, array['member']::nido.member_role[]) and created_by = (select auth.uid()))
  );
```

Deviations from the canonical set:

- `profiles`: a user reads and writes their own row, and can read the profiles of people
  who share a space with them.
- `notifications` and `push_subscriptions`: scoped to `user_id`, not to the space.
- `space_invitations`: readable by admins of the space; acceptance goes through a
  `security definer` RPC that takes the raw token, so an invitee who is not yet a member
  can complete the flow without any table being publicly readable.
- `audit_log`: insert only through triggers, select for members, no update or delete for anyone.
- `ai_messages`: readable only by the user who owns the conversation.

Every policy gets pgTAP coverage with both a positive and a negative case. A table shipped
without those two tests fails review.

---

## 15. Indexes and query shapes

The queries that must be fast, and what makes them fast:

| Query | Index |
| --- | --- |
| Ledger page, newest first, filtered by date range | `(space_id, booked_on desc) where deleted_at is null` |
| Spend by category for a period | `(space_id, category_id, booked_on)` + partial aggregate in SQL |
| Spend by participant for a period | `transaction_splits (space_id, participant_id)` joined on the date-filtered transaction set |
| Full-text search of the ledger | GIN on the concatenated tsvector |
| Budget progress | `budget_periods (budget_id, starts_on)`, `spent_minor` maintained by trigger |
| Balances | the view above; add a materialized variant only if it measurably matters |
| Duplicate detection on import | `import_rows (space_id, fingerprint)` and `transactions (space_id, external_id)` |

Monthly aggregates for the dashboard come from a Postgres function
`nido.space_summary(p_space_id uuid, p_from date, p_to date)` returning a single JSON
document with totals, per-category breakdown, per-participant breakdown, and a daily
series. One round trip, one query plan, no N+1.

---

## 16. Seed data

`supabase/seed.sql` creates a reproducible demo: one space of kind `couple` with two
members, the default category tree, four accounts, three months of transactions with
realistic Spanish merchants and a believable weekly rhythm, two budgets (one comfortably
under, one deliberately over so the alert UI has something to show), two goals, four
subscriptions including one that had a price increase, and one unsettled balance. Seeding
is deterministic — a fixed random seed — so screenshots and e2e tests are stable.
