-- Phase 08 — import batches/rows, categorization rules, bank connections, RPCs.

-- Link committed transactions back to their import row.
alter table nido.transactions
  add column if not exists import_row_id uuid,
  add column if not exists fingerprint text;

create index if not exists transactions_space_fingerprint_idx
  on nido.transactions (space_id, fingerprint)
  where deleted_at is null and fingerprint is not null;

-- ---------------------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------------------

create table nido.import_batches (
  id             uuid primary key default gen_random_uuid(),
  space_id       uuid not null references nido.spaces (id) on delete cascade,
  source         text not null,
  file_name      text,
  account_id     uuid references nido.accounts (id) on delete set null,
  mapping        jsonb not null default '{}'::jsonb,
  status         nido.import_status not null default 'draft',
  row_count      integer not null default 0,
  imported_count integer not null default 0,
  skipped_count  integer not null default 0,
  created_by     uuid not null references nido.profiles (id),
  created_at     timestamptz not null default now(),
  committed_at   timestamptz
);

create index import_batches_space_created_idx
  on nido.import_batches (space_id, created_at desc);

alter table nido.import_batches enable row level security;

create table nido.import_rows (
  id             uuid primary key default gen_random_uuid(),
  batch_id       uuid not null references nido.import_batches (id) on delete cascade,
  space_id       uuid not null references nido.spaces (id) on delete cascade,
  raw            jsonb not null,
  parsed         jsonb,
  fingerprint    text not null,
  duplicate_of   uuid references nido.transactions (id) on delete set null,
  decision       text not null default 'pending'
    check (decision in ('pending', 'import', 'skip', 'duplicate')),
  transaction_id uuid references nido.transactions (id) on delete set null,
  error          text,
  created_at     timestamptz not null default now()
);

create index import_rows_space_fingerprint_idx
  on nido.import_rows (space_id, fingerprint);

create index import_rows_batch_idx
  on nido.import_rows (batch_id);

alter table nido.import_rows enable row level security;

alter table nido.transactions
  add constraint transactions_import_row_fkey
  foreign key (import_row_id) references nido.import_rows (id) on delete set null;

create table nido.categorization_rules (
  id           uuid primary key default gen_random_uuid(),
  space_id     uuid not null references nido.spaces (id) on delete cascade,
  match_type   text not null check (match_type in ('contains', 'starts_with', 'regex', 'exact')),
  pattern      text not null,
  field        text not null default 'description'
    check (field in ('description', 'merchant', 'notes')),
  category_id  uuid not null references nido.categories (id) on delete cascade,
  set_merchant text,
  priority     smallint not null default 100,
  auto_learned boolean not null default false,
  hit_count    integer not null default 0,
  created_at   timestamptz not null default now()
);

create index categorization_rules_space_priority_idx
  on nido.categorization_rules (space_id, priority, created_at);

alter table nido.categorization_rules enable row level security;

create table nido.import_mapping_templates (
  id         uuid primary key default gen_random_uuid(),
  space_id   uuid not null references nido.spaces (id) on delete cascade,
  name       text not null,
  mapping    jsonb not null default '{}'::jsonb,
  created_by uuid not null references nido.profiles (id),
  created_at timestamptz not null default now(),
  unique (space_id, name)
);

alter table nido.import_mapping_templates enable row level security;

create table nido.bank_connections (
  id                 uuid primary key default gen_random_uuid(),
  space_id           uuid not null references nido.spaces (id) on delete cascade,
  provider           text not null,
  institution_id     text not null,
  institution_name   text not null,
  logo_url           text,
  session_ref        text not null,
  status             text not null default 'active'
    check (status in ('active', 'expired', 'error', 'revoked')),
  consent_expires_at timestamptz,
  last_synced_at     timestamptz,
  last_error         text,
  created_by         uuid not null references nido.profiles (id),
  created_at         timestamptz not null default now()
);

alter table nido.bank_connections enable row level security;

create table nido.bank_accounts (
  id            uuid primary key default gen_random_uuid(),
  connection_id uuid not null references nido.bank_connections (id) on delete cascade,
  space_id      uuid not null references nido.spaces (id) on delete cascade,
  account_id    uuid references nido.accounts (id) on delete set null,
  external_id   text not null,
  iban_last4    text,
  name          text,
  currency      nido.currency_code not null,
  balance_minor bigint,
  balance_as_of timestamptz,
  unique (connection_id, external_id)
);

alter table nido.bank_accounts enable row level security;

-- ---------------------------------------------------------------------------------------
-- Fingerprint helper (matches src/features/transactions/lib/transaction-fingerprint.ts)
-- ---------------------------------------------------------------------------------------

create or replace function nido._normalize_fingerprint_text(p_text text)
returns text
language sql
immutable
as $$
  select lower(trim(regexp_replace(coalesce(p_text, ''), '\s+', ' ', 'g')));
$$;

create or replace function nido._fnv1a64(p_input text)
returns text
language plpgsql
immutable
strict
as $$
declare
  v_hash bigint := -3750763034362895377;
  v_prime bigint := 1099511628211;
  i int;
  v_char int;
begin
  for i in 1..length(p_input) loop
    v_char := ascii(substr(p_input, i, 1));
    v_hash := (v_hash # v_char) * v_prime;
  end loop;
  return lpad(to_hex(v_hash), 16, '0');
end;
$$;

create or replace function nido.transaction_fingerprint(
  p_space_id uuid,
  p_booked_on date,
  p_amount_minor bigint,
  p_currency nido.currency_code,
  p_account_id uuid,
  p_merchant text,
  p_description text
)
returns text
language sql
immutable
as $$
  select nido._fnv1a64(
    p_space_id::text || chr(31)
    || p_booked_on::text || chr(31)
    || p_amount_minor::text || chr(31)
    || p_currency::text || chr(31)
    || coalesce(p_account_id::text, '') || chr(31)
    || coalesce(
      nullif(nido._normalize_fingerprint_text(p_merchant), ''),
      nido._normalize_fingerprint_text(p_description)
    )
  );
$$;

create or replace function nido.tg_transactions_fingerprint()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.fingerprint := nido.transaction_fingerprint(
    new.space_id,
    new.booked_on,
    new.amount_minor,
    new.currency,
    new.account_id,
    new.merchant,
    new.description
  );
  return new;
end;
$$;

create trigger transactions_fingerprint
  before insert or update of booked_on, amount_minor, currency, account_id, merchant, description
  on nido.transactions
  for each row execute function nido.tg_transactions_fingerprint();

-- Backfill fingerprints for existing rows.
update nido.transactions t
set fingerprint = nido.transaction_fingerprint(
  t.space_id, t.booked_on, t.amount_minor, t.currency, t.account_id, t.merchant, t.description
)
where t.fingerprint is null;

-- ---------------------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------------------

create policy "import_batches_select_members"
  on nido.import_batches for select
  using (nido.is_member(space_id));

create policy "import_batches_insert_editors"
  on nido.import_batches for insert
  with check (
    nido.is_member(space_id, array['owner', 'admin', 'member']::nido.member_role[])
    and created_by = (select auth.uid())
  );

create policy "import_batches_update_editors"
  on nido.import_batches for update
  using (nido.is_member(space_id, array['owner', 'admin', 'member']::nido.member_role[]))
  with check (nido.is_member(space_id, array['owner', 'admin', 'member']::nido.member_role[]));

create policy "import_batches_delete_editors"
  on nido.import_batches for delete
  using (nido.is_member(space_id, array['owner', 'admin', 'member']::nido.member_role[]));

create policy "import_rows_select_members"
  on nido.import_rows for select
  using (nido.is_member(space_id));

create policy "import_rows_insert_editors"
  on nido.import_rows for insert
  with check (nido.is_member(space_id, array['owner', 'admin', 'member']::nido.member_role[]));

create policy "import_rows_update_editors"
  on nido.import_rows for update
  using (nido.is_member(space_id, array['owner', 'admin', 'member']::nido.member_role[]))
  with check (nido.is_member(space_id, array['owner', 'admin', 'member']::nido.member_role[]));

create policy "import_rows_delete_editors"
  on nido.import_rows for delete
  using (nido.is_member(space_id, array['owner', 'admin', 'member']::nido.member_role[]));

create policy "categorization_rules_select_members"
  on nido.categorization_rules for select
  using (nido.is_member(space_id));

create policy "categorization_rules_insert_editors"
  on nido.categorization_rules for insert
  with check (nido.is_member(space_id, array['owner', 'admin', 'member']::nido.member_role[]));

create policy "categorization_rules_update_editors"
  on nido.categorization_rules for update
  using (nido.is_member(space_id, array['owner', 'admin', 'member']::nido.member_role[]))
  with check (nido.is_member(space_id, array['owner', 'admin', 'member']::nido.member_role[]));

create policy "categorization_rules_delete_editors"
  on nido.categorization_rules for delete
  using (nido.is_member(space_id, array['owner', 'admin', 'member']::nido.member_role[]));

create policy "import_mapping_templates_select_members"
  on nido.import_mapping_templates for select
  using (nido.is_member(space_id));

create policy "import_mapping_templates_insert_editors"
  on nido.import_mapping_templates for insert
  with check (
    nido.is_member(space_id, array['owner', 'admin', 'member']::nido.member_role[])
    and created_by = (select auth.uid())
  );

create policy "import_mapping_templates_update_editors"
  on nido.import_mapping_templates for update
  using (nido.is_member(space_id, array['owner', 'admin', 'member']::nido.member_role[]))
  with check (nido.is_member(space_id, array['owner', 'admin', 'member']::nido.member_role[]));

create policy "import_mapping_templates_delete_editors"
  on nido.import_mapping_templates for delete
  using (nido.is_member(space_id, array['owner', 'admin', 'member']::nido.member_role[]));

create policy "bank_connections_select_members"
  on nido.bank_connections for select
  using (nido.is_member(space_id));

create policy "bank_connections_insert_admins"
  on nido.bank_connections for insert
  with check (
    nido.is_member(space_id, array['owner', 'admin']::nido.member_role[])
    and created_by = (select auth.uid())
  );

create policy "bank_connections_update_admins"
  on nido.bank_connections for update
  using (nido.is_member(space_id, array['owner', 'admin']::nido.member_role[]))
  with check (nido.is_member(space_id, array['owner', 'admin']::nido.member_role[]));

create policy "bank_connections_delete_admins"
  on nido.bank_connections for delete
  using (nido.is_member(space_id, array['owner', 'admin']::nido.member_role[]));

create policy "bank_accounts_select_members"
  on nido.bank_accounts for select
  using (nido.is_member(space_id));

create policy "bank_accounts_mutate_admins"
  on nido.bank_accounts for all
  using (nido.is_member(space_id, array['owner', 'admin']::nido.member_role[]))
  with check (nido.is_member(space_id, array['owner', 'admin']::nido.member_role[]));

grant select, insert, update, delete on nido.import_batches to authenticated, service_role;
grant select, insert, update, delete on nido.import_rows to authenticated, service_role;
grant select, insert, update, delete on nido.categorization_rules to authenticated, service_role;
grant select, insert, update, delete on nido.import_mapping_templates to authenticated, service_role;
grant select, insert, update, delete on nido.bank_connections to authenticated, service_role;
grant select, insert, update, delete on nido.bank_accounts to authenticated, service_role;
