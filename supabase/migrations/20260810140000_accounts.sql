-- Phase 02 — accounts (optional per transaction; required for transfers and balances).

create table nido.accounts (
  id                   uuid primary key default gen_random_uuid(),
  space_id             uuid not null references nido.spaces (id) on delete cascade,
  name                 text not null check (char_length(name) between 1 and 80),
  kind                 nido.account_kind not null default 'bank',
  currency             nido.currency_code not null references nido.currencies (code),
  owner_participant_id uuid references nido.participants (id) on delete set null,
  opening_balance_minor bigint not null default 0,
  color                text not null default '#8B8B8B' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  icon                 text not null default 'wallet',
  include_in_totals    boolean not null default true,
  position             smallint not null default 0,
  archived_at          timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

comment on table nido.accounts is
  'Cash/bank/card/savings accounts within a space. owner_participant_id null = shared.';
comment on column nido.accounts.owner_participant_id is
  'Null means the account is shared by the household.';

create index accounts_space_active_idx
  on nido.accounts (space_id, position)
  where archived_at is null;

create trigger accounts_set_updated_at
  before update on nido.accounts
  for each row execute function nido.tg_set_updated_at();

alter table nido.accounts enable row level security;

create policy "accounts_select_members"
  on nido.accounts for select
  using (nido.is_member(space_id));

create policy "accounts_insert_contributors"
  on nido.accounts for insert
  with check (
    nido.is_member(space_id, array['owner', 'admin', 'member']::nido.member_role[])
  );

create policy "accounts_update_contributors"
  on nido.accounts for update
  using (
    nido.is_member(space_id, array['owner', 'admin', 'member']::nido.member_role[])
  )
  with check (
    nido.is_member(space_id, array['owner', 'admin', 'member']::nido.member_role[])
  );

create policy "accounts_delete_admins"
  on nido.accounts for delete
  using (nido.is_member(space_id, array['owner', 'admin']::nido.member_role[]));

create trigger accounts_audit
  after insert or update or delete on nido.accounts
  for each row execute function nido.tg_audit('accounts');

grant select, insert, update, delete on nido.accounts to authenticated, service_role;
