-- Phase 01 — space_members (authorization).

create table nido.space_members (
  space_id       uuid not null references nido.spaces (id) on delete cascade,
  user_id        uuid not null references nido.profiles (id) on delete cascade,
  participant_id uuid not null references nido.participants (id) on delete cascade,
  role           nido.member_role not null default 'member',
  status         nido.member_status not null default 'active',
  joined_at      timestamptz not null default now(),
  primary key (space_id, user_id)
);

comment on table nido.space_members is
  'Authorization: a row means a real user has access to the space.';

create index space_members_user_active_idx
  on nido.space_members (user_id)
  where status = 'active';

alter table nido.space_members enable row level security;

create policy "space_members_select_members"
  on nido.space_members for select
  using (nido.is_member(space_id));

create policy "space_members_insert_admins"
  on nido.space_members for insert
  with check (nido.is_member(space_id, array['owner', 'admin']::nido.member_role[]));

create policy "space_members_update_admins"
  on nido.space_members for update
  using (nido.is_member(space_id, array['owner', 'admin']::nido.member_role[]))
  with check (nido.is_member(space_id, array['owner', 'admin']::nido.member_role[]));

create policy "space_members_delete_admins"
  on nido.space_members for delete
  using (nido.is_member(space_id, array['owner', 'admin']::nido.member_role[]));

-- Prevent removing or demoting the last active owner.
create or replace function nido.tg_protect_last_owner()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_space_id uuid;
  v_owner_count integer;
begin
  v_space_id := coalesce(old.space_id, new.space_id);

  if tg_op = 'DELETE' then
    if old.role = 'owner' and old.status = 'active' then
      select count(*)::integer into v_owner_count
      from nido.space_members m
      where m.space_id = v_space_id
        and m.role = 'owner'
        and m.status = 'active'
        and m.user_id <> old.user_id;

      if v_owner_count = 0 then
        raise exception 'cannot remove the last owner of a space'
          using errcode = 'P0001';
      end if;
    end if;
    return old;
  end if;

  -- UPDATE: demotion or status leaving active while being an owner.
  if old.role = 'owner' and old.status = 'active'
     and (new.role is distinct from 'owner' or new.status is distinct from 'active') then
    select count(*)::integer into v_owner_count
    from nido.space_members m
    where m.space_id = v_space_id
      and m.role = 'owner'
      and m.status = 'active'
      and m.user_id <> old.user_id;

    if v_owner_count = 0 then
      raise exception 'cannot remove the last owner of a space'
        using errcode = 'P0001';
    end if;
  end if;

  -- Only an owner may promote another member to owner.
  if new.role = 'owner' and old.role is distinct from 'owner' then
    if not nido.is_member(v_space_id, array['owner']::nido.member_role[]) then
      raise exception 'only an owner may transfer ownership'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

comment on function nido.tg_protect_last_owner() is
  'Blocks removing or demoting the sole active owner; restricts owner promotion to owners.';

create trigger space_members_protect_last_owner
  before update or delete on nido.space_members
  for each row execute function nido.tg_protect_last_owner();

-- Now that space_members exists, allow reading profiles of people who share a space.
create policy "profiles_select_comembers"
  on nido.profiles for select
  using (
    exists (
      select 1
      from nido.space_members mine
      join nido.space_members theirs
        on theirs.space_id = mine.space_id
       and theirs.status = 'active'
      where mine.user_id = (select auth.uid())
        and mine.status = 'active'
        and theirs.user_id = profiles.id
    )
  );
