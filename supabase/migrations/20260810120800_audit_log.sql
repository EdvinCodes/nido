-- Phase 01 — audit_log + generic trigger attached to spaces, members, participants.

create table nido.audit_log (
  id         bigint generated always as identity primary key,
  space_id   uuid not null references nido.spaces (id) on delete cascade,
  actor_id   uuid references nido.profiles (id) on delete set null,
  entity     text not null,
  entity_id  uuid not null,
  action     text not null check (action in ('insert', 'update', 'delete', 'restore')),
  diff       jsonb,
  created_at timestamptz not null default now()
);

comment on table nido.audit_log is
  'Append-only change log. Inserts only via triggers; members may select.';

create index audit_log_space_created_idx
  on nido.audit_log (space_id, created_at desc);

alter table nido.audit_log enable row level security;

create policy "audit_log_select_members"
  on nido.audit_log for select
  using (nido.is_member(space_id));

create or replace function nido.tg_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row jsonb;
  v_old jsonb;
  v_space_id uuid;
  v_entity_id uuid;
  v_action text;
  v_diff jsonb;
  v_entity text := tg_argv[0];
begin
  if tg_op = 'DELETE' then
    v_row := to_jsonb(old);
    v_action := 'delete';
  else
    v_row := to_jsonb(new);
    v_action := lower(tg_op);
  end if;

  if v_entity = 'spaces' then
    v_space_id := (v_row ->> 'id')::uuid;
    v_entity_id := v_space_id;
  elsif v_entity = 'space_members' then
    v_space_id := (v_row ->> 'space_id')::uuid;
    v_entity_id := (v_row ->> 'participant_id')::uuid;
  else
    v_space_id := (v_row ->> 'space_id')::uuid;
    v_entity_id := (v_row ->> 'id')::uuid;
  end if;

  if tg_op = 'UPDATE' then
    v_old := to_jsonb(old);
    v_diff := jsonb_strip_nulls(
      (
        select jsonb_object_agg(n.key, n.value)
        from jsonb_each(v_row) as n(key, value)
        where v_old -> n.key is distinct from n.value
      )
    );
  else
    v_diff := v_row;
  end if;

  insert into nido.audit_log (space_id, actor_id, entity, entity_id, action, diff)
  values (v_space_id, (select auth.uid()), v_entity, v_entity_id, v_action, v_diff);

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

comment on function nido.tg_audit() is
  'Generic AFTER trigger writing changed columns to nido.audit_log. Arg 0 = entity name.';

create trigger spaces_audit
  after insert or update or delete on nido.spaces
  for each row execute function nido.tg_audit('spaces');

create trigger space_members_audit
  after insert or update or delete on nido.space_members
  for each row execute function nido.tg_audit('space_members');

create trigger participants_audit
  after insert or update or delete on nido.participants
  for each row execute function nido.tg_audit('participants');
