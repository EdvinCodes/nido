-- Phase 01 — spaces.

create table nido.spaces (
  id              uuid primary key default gen_random_uuid(),
  name            text not null check (char_length(name) between 1 and 80),
  kind            nido.space_kind not null default 'solo',
  base_currency   nido.currency_code not null default 'EUR'
                    references nido.currencies (code),
  timezone        text not null default 'Europe/Madrid',
  week_starts_on  smallint not null default 1 check (week_starts_on between 0 and 6),
  month_starts_on smallint not null default 1 check (month_starts_on between 1 and 28),
  settings        jsonb not null default '{}'::jsonb,
  created_by      uuid not null references nido.profiles (id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  archived_at     timestamptz
);

comment on table nido.spaces is
  'A household / solo / flatshare tenancy. Every domain row carries space_id.';
comment on column nido.spaces.month_starts_on is
  'Day of month the accounting period starts (e.g. 25 for salary-aligned months).';

create index spaces_created_by_idx on nido.spaces (created_by);

create trigger spaces_set_updated_at
  before update on nido.spaces
  for each row execute function nido.tg_set_updated_at();

alter table nido.profiles
  add constraint profiles_last_active_space_id_fkey
  foreign key (last_active_space_id) references nido.spaces (id) on delete set null;

alter table nido.spaces enable row level security;

create policy "spaces_select_members"
  on nido.spaces for select
  using (nido.is_member(id));

create policy "spaces_insert_authenticated"
  on nido.spaces for insert
  with check (created_by = (select auth.uid()));

create policy "spaces_update_admins"
  on nido.spaces for update
  using (nido.is_member(id, array['owner', 'admin']::nido.member_role[]))
  with check (nido.is_member(id, array['owner', 'admin']::nido.member_role[]));

create policy "spaces_delete_owner"
  on nido.spaces for delete
  using (nido.is_member(id, array['owner']::nido.member_role[]));
