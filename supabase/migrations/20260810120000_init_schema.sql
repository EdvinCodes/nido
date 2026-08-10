-- Phase 00 — schema, enums, currency lookups, and the shared primitives every later
-- migration builds on. See docs/02-DATA-MODEL.md §§ 1, 2, 10 and docs/06-CONVENTIONS.md §4.
--
-- Deliberately NOT created here: any domain table (profiles, spaces, transactions, ...).
-- Phase 00 is foundations only; those arrive with the feature that owns them.

create schema if not exists nido;

comment on schema nido is
  'Application schema. Never write application tables into the public schema.';

-- ---------------------------------------------------------------------------------------
-- Money: bigint minor units plus an ISO-4217 code. Never float, never numeric for storage.
-- ---------------------------------------------------------------------------------------

create domain nido.currency_code as char(3)
  check (value ~ '^[A-Z]{3}$');

comment on domain nido.currency_code is 'ISO-4217 currency code, always three uppercase letters.';

-- ---------------------------------------------------------------------------------------
-- Enumerations. See docs/02-DATA-MODEL.md §2.
-- ---------------------------------------------------------------------------------------

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

-- ---------------------------------------------------------------------------------------
-- Shared trigger: keeps `updated_at` honest on every table that has one. Every future
-- `create table` migration that has an `updated_at` column attaches this trigger to it.
-- ---------------------------------------------------------------------------------------

create or replace function nido.tg_set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

comment on function nido.tg_set_updated_at() is
  'BEFORE UPDATE trigger: stamps updated_at with the current time on every row change.';

-- ---------------------------------------------------------------------------------------
-- nido.currencies — lookup table. Exponent differs by currency (JPY 0, TND 3); every
-- formatting path reads it here instead of hardcoding `/ 100`. See docs/02-DATA-MODEL.md §10.
-- ---------------------------------------------------------------------------------------

create table nido.currencies (
  code     nido.currency_code primary key,
  name     text not null,
  symbol   text not null,
  exponent smallint not null default 2 check (exponent between 0 and 4)
);

comment on table nido.currencies is
  'Static currency metadata mirrored from src/lib/money/currencies.ts. Keep both in sync.';

insert into nido.currencies (code, name, symbol, exponent) values
  ('EUR', 'Euro',                    '€',    2),
  ('USD', 'US Dollar',               '$',    2),
  ('GBP', 'British Pound',           '£',    2),
  ('CHF', 'Swiss Franc',             'CHF',  2),
  ('SEK', 'Swedish Krona',           'kr',   2),
  ('NOK', 'Norwegian Krone',         'kr',   2),
  ('DKK', 'Danish Krone',            'kr',   2),
  ('PLN', 'Polish Zloty',            'zł',   2),
  ('CZK', 'Czech Koruna',            'Kč',   2),
  ('HUF', 'Hungarian Forint',        'Ft',   2),
  ('RON', 'Romanian Leu',            'lei',  2),
  ('BGN', 'Bulgarian Lev',           'лв',   2),
  ('CAD', 'Canadian Dollar',         '$',    2),
  ('AUD', 'Australian Dollar',       '$',    2),
  ('NZD', 'New Zealand Dollar',      '$',    2),
  ('MXN', 'Mexican Peso',            '$',    2),
  ('BRL', 'Brazilian Real',          'R$',   2),
  ('ARS', 'Argentine Peso',          '$',    2),
  ('CLP', 'Chilean Peso',            '$',    0),
  ('COP', 'Colombian Peso',          '$',    2),
  ('MAD', 'Moroccan Dirham',         'DH',   2),
  ('TRY', 'Turkish Lira',            '₺',    2),
  ('JPY', 'Japanese Yen',            '¥',    0),
  ('KRW', 'South Korean Won',        '₩',    0),
  ('CNY', 'Chinese Yuan',            '¥',    2),
  ('INR', 'Indian Rupee',            '₹',    2),
  ('ZAR', 'South African Rand',      'R',    2),
  ('ISK', 'Icelandic Krona',         'kr',   0),
  ('TND', 'Tunisian Dinar',          'DT',   3);

alter table nido.currencies enable row level security;

create policy "currencies readable by anyone" on nido.currencies
  for select using (true);

-- No insert/update/delete policy: the table is maintained only through migrations, run as
-- the migration role, which bypasses RLS. Application roles get read-only access.

-- The `nido` schema is not exposed to PostgREST roles by default; grant USAGE plus the
-- narrowest table privilege each role needs. RLS still governs individual rows.
grant usage on schema nido to anon, authenticated, service_role;
grant select on nido.currencies to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------------------
-- nido.allocate — largest remainder allocation, mirroring src/lib/money/allocate.ts exactly
-- so recurring-rule materialization in SQL produces the same cent-perfect split as the
-- client. See docs/02-DATA-MODEL.md §1 and docs/07-ADR.md ADR-005.
-- ---------------------------------------------------------------------------------------

create or replace function nido.allocate(p_total bigint, p_weights numeric[])
returns bigint[]
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_count       int := coalesce(array_length(p_weights, 1), 0);
  v_total_weight numeric := 0;
  v_negative    boolean := p_total < 0;
  v_magnitude   bigint := abs(p_total);
  v_shares      bigint[] := array_fill(0::bigint, array[v_count]);
  v_remainders  numeric[] := array_fill(0::numeric, array[v_count]);
  v_distributed bigint := 0;
  v_leftover    bigint;
  v_order       int[];
  v_weight      numeric;
  v_numerator   numeric;
  v_share       bigint;
  i             int;
begin
  if v_count = 0 then
    raise exception 'Cannot allocate across zero participants';
  end if;

  for i in 1..v_count loop
    v_weight := p_weights[i];
    if v_weight is null or v_weight < 0 then
      raise exception 'Weights must not be negative';
    end if;
    v_total_weight := v_total_weight + v_weight;
  end loop;

  if v_total_weight = 0 then
    raise exception 'Total weight must be greater than zero';
  end if;

  for i in 1..v_count loop
    v_weight := p_weights[i];
    v_numerator := v_magnitude * v_weight;
    v_share := floor(v_numerator / v_total_weight)::bigint;
    v_shares[i] := v_share;
    v_remainders[i] := v_numerator - (v_share::numeric * v_total_weight);
    v_distributed := v_distributed + v_share;
  end loop;

  v_leftover := v_magnitude - v_distributed;

  if v_leftover > 0 then
    select array_agg(idx order by v_remainders[idx] desc, idx asc)
      into v_order
      from generate_series(1, v_count) as idx;

    i := 1;
    while v_leftover > 0 and i <= v_count loop
      v_shares[v_order[i]] := v_shares[v_order[i]] + 1;
      v_leftover := v_leftover - 1;
      i := i + 1;
    end loop;
  end if;

  if v_negative then
    for i in 1..v_count loop
      v_shares[i] := -v_shares[i];
    end loop;
  end if;

  return v_shares;
end;
$$;

comment on function nido.allocate(bigint, numeric[]) is
  'Largest-remainder allocation. Mirrors src/lib/money/allocate.ts::allocate exactly — '
  'sum(allocate(total, weights)) always equals total. Used by SQL-side recurring-rule '
  'materialization; the TypeScript version is the one forms and Server Actions call.';
