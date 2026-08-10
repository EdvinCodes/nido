-- Phase 01 — profiles. See docs/02-DATA-MODEL.md §3 and docs/phases/PHASE-01-auth-spaces.md.

create extension if not exists citext with schema extensions;
create extension if not exists pgcrypto with schema extensions;

create table nido.profiles (
  id               uuid primary key references auth.users (id) on delete cascade,
  display_name     text not null check (char_length(display_name) between 1 and 60),
  avatar_url       text,
  locale           text not null default 'es' check (locale in ('es', 'en')),
  timezone         text not null default 'Europe/Madrid',
  theme            text not null default 'system' check (theme in ('light', 'dark', 'system')),
  colourblind_safe boolean not null default false,
  -- FK to spaces added in the spaces migration (circular dependency).
  last_active_space_id uuid,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

comment on table nido.profiles is
  'Application profile mirroring auth.users. Created by trigger on signup.';
comment on column nido.profiles.colourblind_safe is
  'When true, UI uses the teal/violet alternate palette instead of the default direction colours.';
comment on column nido.profiles.last_active_space_id is
  'Last space the user worked in; used to redirect authenticated visits to /.';

create trigger profiles_set_updated_at
  before update on nido.profiles
  for each row execute function nido.tg_set_updated_at();

alter table nido.profiles enable row level security;

-- Own profile: full read/write. Co-member read policy is added after space_members exists.
create policy "profiles_select_own"
  on nido.profiles for select
  using (id = (select auth.uid()));

create policy "profiles_update_own"
  on nido.profiles for update
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- No direct inserts from clients — the auth.users trigger creates the row.
-- Service role bypasses RLS for admin tooling.

create or replace function nido.tg_create_profile_for_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
begin
  v_name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    'User'
  );

  if char_length(v_name) > 60 then
    v_name := left(v_name, 60);
  end if;

  insert into nido.profiles (id, display_name)
  values (new.id, v_name);

  return new;
end;
$$;

comment on function nido.tg_create_profile_for_user() is
  'AFTER INSERT on auth.users: creates the matching nido.profiles row.';

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function nido.tg_create_profile_for_user();
