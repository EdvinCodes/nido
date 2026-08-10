-- Phase 02 — free-form tags and the transaction ↔ tag junction.

create table nido.tags (
  id         uuid primary key default gen_random_uuid(),
  space_id   uuid not null references nido.spaces (id) on delete cascade,
  name       extensions.citext not null,
  color      text not null default '#8B8B8B' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  created_at timestamptz not null default now(),
  unique (space_id, name)
);

comment on table nido.tags is
  'Free-form cross-cutting labels (#holidays-2026, #reimbursable) scoped to a space.';

alter table nido.tags enable row level security;

create policy "tags_select_members"
  on nido.tags for select
  using (nido.is_member(space_id));

create policy "tags_insert_contributors"
  on nido.tags for insert
  with check (
    nido.is_member(space_id, array['owner', 'admin', 'member']::nido.member_role[])
  );

create policy "tags_update_contributors"
  on nido.tags for update
  using (
    nido.is_member(space_id, array['owner', 'admin', 'member']::nido.member_role[])
  )
  with check (
    nido.is_member(space_id, array['owner', 'admin', 'member']::nido.member_role[])
  );

create policy "tags_delete_contributors"
  on nido.tags for delete
  using (
    nido.is_member(space_id, array['owner', 'admin', 'member']::nido.member_role[])
  );

grant select, insert, update, delete on nido.tags to authenticated, service_role;
