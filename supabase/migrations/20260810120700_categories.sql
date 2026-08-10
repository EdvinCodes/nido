-- Phase 01 — categories (max depth two).

create table nido.categories (
  id          uuid primary key default gen_random_uuid(),
  space_id    uuid not null references nido.spaces (id) on delete cascade,
  parent_id   uuid references nido.categories (id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 50),
  kind        nido.category_kind not null default 'expense',
  color       text not null check (color ~ '^#[0-9A-Fa-f]{6}$'),
  icon        text not null default 'circle',
  position    smallint not null default 0,
  is_system   boolean not null default false,
  archived_at timestamptz,
  created_at  timestamptz not null default now(),
  unique (space_id, parent_id, name)
);

comment on table nido.categories is
  'Two-level expense/income classification tree per space.';
comment on column nido.categories.is_system is
  'Seeded defaults: renamable and archivable, not hard-deletable.';

create index categories_space_active_idx
  on nido.categories (space_id)
  where archived_at is null;

alter table nido.categories enable row level security;

create policy "categories_select_members"
  on nido.categories for select
  using (nido.is_member(space_id));

create policy "categories_insert_contributors"
  on nido.categories for insert
  with check (nido.is_member(space_id, array['owner', 'admin', 'member']::nido.member_role[]));

create policy "categories_update_contributors"
  on nido.categories for update
  using (nido.is_member(space_id, array['owner', 'admin', 'member']::nido.member_role[]))
  with check (nido.is_member(space_id, array['owner', 'admin', 'member']::nido.member_role[]));

create policy "categories_delete_admins"
  on nido.categories for delete
  using (
    nido.is_member(space_id, array['owner', 'admin']::nido.member_role[])
    and is_system = false
  );

create or replace function nido.tg_categories_max_depth()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_grandparent uuid;
begin
  if new.parent_id is null then
    return new;
  end if;

  select c.parent_id into v_grandparent
  from nido.categories c
  where c.id = new.parent_id;

  if not found then
    raise exception 'parent category does not exist'
      using errcode = '23503';
  end if;

  if v_grandparent is not null then
    raise exception 'categories may be at most two levels deep'
      using errcode = 'P0001';
  end if;

  if new.space_id is distinct from (
    select c.space_id from nido.categories c where c.id = new.parent_id
  ) then
    raise exception 'parent category must belong to the same space'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

comment on function nido.tg_categories_max_depth() is
  'Enforces category → subcategory only (no deeper nesting) and same-space parent.';

create trigger categories_max_depth
  before insert or update of parent_id, space_id on nido.categories
  for each row execute function nido.tg_categories_max_depth();
