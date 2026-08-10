-- Phase 01 — participants (money-assignment identities; may be ghosts).

create table nido.participants (
  id             uuid primary key default gen_random_uuid(),
  space_id       uuid not null references nido.spaces (id) on delete cascade,
  user_id        uuid references nido.profiles (id) on delete set null,
  display_name   text not null check (char_length(display_name) between 1 and 60),
  color          text not null default '#8B8B8B' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  avatar_url     text,
  position       smallint not null default 0,
  default_weight numeric(10, 4) not null default 1 check (default_weight >= 0),
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  unique (space_id, user_id)
);

comment on table nido.participants is
  'People who can be assigned money in a space. user_id null = ghost participant.';
comment on column nido.participants.position is
  'Stable tie-break for largest-remainder allocation.';

create index participants_space_active_idx
  on nido.participants (space_id)
  where is_active;

alter table nido.participants enable row level security;

create policy "participants_select_members"
  on nido.participants for select
  using (nido.is_member(space_id));

create policy "participants_insert_admins"
  on nido.participants for insert
  with check (nido.is_member(space_id, array['owner', 'admin']::nido.member_role[]));

create policy "participants_update_admins"
  on nido.participants for update
  using (nido.is_member(space_id, array['owner', 'admin']::nido.member_role[]))
  with check (nido.is_member(space_id, array['owner', 'admin']::nido.member_role[]));

create policy "participants_delete_admins"
  on nido.participants for delete
  using (nido.is_member(space_id, array['owner', 'admin']::nido.member_role[]));
