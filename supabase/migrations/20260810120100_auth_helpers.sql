-- Phase 00 — RLS helper functions. See docs/02-DATA-MODEL.md §14 and docs/01-ARCHITECTURE.md §§5–6.
--
-- These reference `nido.space_members` and `nido.participants`, which do not exist until
-- Phase 01 creates them. That is safe for `plpgsql`: the function body is stored as opaque
-- text and only parsed against the catalog the first time it is *called*, not when it is
-- created — unlike `language sql`, whose body Postgres parses and plans immediately at
-- `create function` time, which would fail here with "relation does not exist". So the
-- contract can be shipped now and every later RLS policy can depend on it immediately,
-- while Phase 01's migration is what actually makes these functions callable.
--
-- Wrapping `auth.uid()` in a scalar subquery lets Postgres evaluate it once per query
-- instead of once per row, which matters once the ledger has thousands of rows.

create or replace function nido.is_member(p_space_id uuid, p_roles nido.member_role[] default null)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  return exists (
    select 1 from nido.space_members m
    where m.space_id = p_space_id
      and m.user_id  = (select auth.uid())
      and m.status   = 'active'
      and (p_roles is null or m.role = any(p_roles))
  );
end;
$$;

comment on function nido.is_member(uuid, nido.member_role[]) is
  'True when the current user is an active member of the space, optionally restricted to '
  'one of the given roles. The canonical building block for every RLS policy on a '
  'space-scoped table. security definer + search_path = '''' so it reads space_members '
  'regardless of the caller''s own row-level access.';

create or replace function nido.my_participant_id(p_space_id uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  return (
    select m.participant_id from nido.space_members m
    where m.space_id = p_space_id and m.user_id = (select auth.uid()) and m.status = 'active'
  );
end;
$$;

comment on function nido.my_participant_id(uuid) is
  'The participant row that represents the current user inside a space, or null if they '
  'are not an active member. Used to default payer/split rows to "me".';

create or replace function nido.has_role(p_space_id uuid, p_roles nido.member_role[])
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  return nido.is_member(p_space_id, p_roles);
end;
$$;

comment on function nido.has_role(uuid, nido.member_role[]) is
  'Explicit role check for policies that always require a role (as opposed to is_member''s '
  'optional filter). Same semantics as is_member with roles supplied; kept as a distinct, '
  'clearly-named entry point because "insert for contributors" reads better than repeating '
  'is_member everywhere. Mirrored by the TypeScript can() helper for hiding UI affordances '
  '— the SQL version here remains the source of truth.';
