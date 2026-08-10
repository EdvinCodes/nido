-- Tenancy RLS + RPC coverage for Phase 01.
begin;

create schema if not exists tests;
grant usage on schema tests to authenticated, anon, service_role;

create or replace function tests.create_user(identifier text, email text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := gen_random_uuid();
  v_email text := coalesce(email, identifier || '@test.nido.local');
begin
  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at
  ) values (
    v_id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    v_email,
    extensions.crypt('password123', extensions.gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('display_name', identifier),
    now(),
    now()
  );
  return v_id;
end;
$$;

create or replace function tests.uid(identifier text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from auth.users
  where raw_user_meta_data ->> 'display_name' = identifier
  order by created_at desc
  limit 1;
$$;

-- Must NOT be security definer: SET ROLE is forbidden inside those.
create or replace function tests.authenticate_as(identifier text)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_id uuid := tests.uid(identifier);
begin
  if v_id is null then
    raise exception 'test user % not found', identifier;
  end if;
  perform set_config('request.jwt.claim.sub', v_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config(
    'request.jwt.claims',
    json_build_object(
      'sub', v_id::text,
      'role', 'authenticated',
      'email', identifier || '@test.nido.local'
    )::text,
    true
  );
  execute 'set local role authenticated';
end;
$$;

grant execute on function tests.create_user(text, text) to authenticated, anon, service_role;
grant execute on function tests.uid(text) to authenticated, anon, service_role;
grant execute on function tests.authenticate_as(text) to authenticated, anon, service_role;

select plan(19);

select tests.create_user('alice');
select tests.create_user('bob');
select tests.create_user('cara');
select tests.create_user('viewer1');
select tests.create_user('invitee', 'newuser@test.nido.local');

select tests.authenticate_as('alice');
select set_config(
  'test.alice_space',
  nido.create_space(
    'Alice Home', 'couple', 'EUR', 'Europe/Madrid',
    '[{"display_name":"Ghost Ana"}]'::jsonb
  )::text,
  true
);

reset role;
select tests.authenticate_as('bob');
select set_config(
  'test.bob_space',
  nido.create_space('Bob Home', 'solo', 'EUR', 'Europe/Madrid', '[]'::jsonb)::text,
  true
);

-- Cross-space isolation
reset role;
select tests.authenticate_as('alice');

select is(
  (select count(*)::int from nido.spaces where id = current_setting('test.bob_space')::uuid),
  0,
  'alice cannot select bob space'
);
select is(
  (select count(*)::int from nido.participants where space_id = current_setting('test.bob_space')::uuid),
  0,
  'alice cannot select bob participants'
);
select is(
  (select count(*)::int from nido.space_members where space_id = current_setting('test.bob_space')::uuid),
  0,
  'alice cannot select bob members'
);
select is(
  (select count(*)::int from nido.categories where space_id = current_setting('test.bob_space')::uuid),
  0,
  'alice cannot select bob categories'
);
select is(
  (select count(*)::int from nido.audit_log where space_id = current_setting('test.bob_space')::uuid),
  0,
  'alice cannot select bob audit_log'
);
select ok(
  (select count(*)::int from nido.spaces where id = current_setting('test.alice_space')::uuid) = 1,
  'alice can select own space'
);

reset role;
select tests.authenticate_as('bob');
select is(
  (select count(*)::int from nido.spaces where id = current_setting('test.alice_space')::uuid),
  0,
  'bob cannot select alice space'
);

-- Seed viewer + member as postgres
reset role;
select set_config(
  'test.ghost_id',
  (
    select p.id::text from nido.participants p
    where p.space_id = current_setting('test.alice_space')::uuid and p.user_id is null
    limit 1
  ),
  true
);
select set_config(
  'test.cat_name',
  (
    select c.name from nido.categories c
    where c.space_id = current_setting('test.alice_space')::uuid and c.parent_id is null
    order by c.position
    limit 1
  ),
  true
);

insert into nido.participants (space_id, user_id, display_name, position)
values (current_setting('test.alice_space')::uuid, tests.uid('viewer1'), 'Viewer', 90);

insert into nido.space_members (space_id, user_id, participant_id, role, status)
select current_setting('test.alice_space')::uuid, tests.uid('viewer1'), p.id, 'viewer', 'active'
from nido.participants p
where p.space_id = current_setting('test.alice_space')::uuid and p.user_id = tests.uid('viewer1');

insert into nido.participants (space_id, user_id, display_name, position)
values (current_setting('test.alice_space')::uuid, tests.uid('cara'), 'Cara', 91);

insert into nido.space_members (space_id, user_id, participant_id, role, status)
select current_setting('test.alice_space')::uuid, tests.uid('cara'), p.id, 'member', 'active'
from nido.participants p
where p.space_id = current_setting('test.alice_space')::uuid and p.user_id = tests.uid('cara');

select tests.authenticate_as('viewer1');

select throws_ok(
  format(
    $sql$insert into nido.categories (space_id, name, kind, color, icon, position)
         values (%L::uuid, 'Nope', 'expense', '#123456', 'circle', 99)$sql$,
    current_setting('test.alice_space')
  ),
  '42501',
  null,
  'viewer cannot insert category'
);

update nido.categories
set name = 'Hacked'
where space_id = current_setting('test.alice_space')::uuid
  and name = current_setting('test.cat_name');

select is(
  (
    select c.name from nido.categories c
    where c.space_id = current_setting('test.alice_space')::uuid
      and c.name in (current_setting('test.cat_name'), 'Hacked')
    order by case when c.name = 'Hacked' then 0 else 1 end
    limit 1
  ),
  current_setting('test.cat_name'),
  'viewer cannot update category'
);

reset role;
select tests.authenticate_as('cara');
update nido.space_members
set role = 'admin'
where space_id = current_setting('test.alice_space')::uuid
  and user_id = tests.uid('viewer1');

select is(
  (
    select m.role::text from nido.space_members m
    where m.space_id = current_setting('test.alice_space')::uuid
      and m.user_id = tests.uid('viewer1')
  ),
  'viewer',
  'member cannot change roles'
);

reset role;
select tests.authenticate_as('alice');
select throws_ok(
  format(
    $sql$delete from nido.space_members where space_id = %L::uuid and user_id = %L::uuid$sql$,
    current_setting('test.alice_space'),
    tests.uid('alice')
  ),
  'P0001',
  'cannot remove the last owner of a space',
  'last owner cannot be removed'
);

-- Expired invitation
reset role;
select set_config('test.token', encode(extensions.gen_random_bytes(32), 'hex'), true);

insert into nido.space_invitations (
  space_id, email, token_hash, role, invited_by, expires_at, participant_id
) values (
  current_setting('test.alice_space')::uuid,
  'newuser@test.nido.local',
  nido.hash_invite_token(current_setting('test.token')),
  'member',
  tests.uid('alice'),
  now() - interval '1 day',
  current_setting('test.ghost_id')::uuid
);

select set_config(
  'test.invite_id',
  (
    select i.id::text from nido.space_invitations i
    where i.space_id = current_setting('test.alice_space')::uuid
    order by i.created_at desc
    limit 1
  ),
  true
);

select tests.authenticate_as('invitee');
select throws_ok(
  format($sql$select nido.accept_invitation(%L)$sql$, current_setting('test.token')),
  'P0001',
  'invitation is invalid or expired',
  'expired invitation cannot be accepted'
);

reset role;
update nido.space_invitations
set expires_at = now() + interval '7 days',
    accepted_at = null,
    revoked_at = null
where id = current_setting('test.invite_id')::uuid;

select tests.authenticate_as('invitee');
select lives_ok(
  format($sql$select nido.accept_invitation(%L)$sql$, current_setting('test.token')),
  'valid invitation can be accepted'
);

select throws_ok(
  format($sql$select nido.accept_invitation(%L)$sql$, current_setting('test.token')),
  'P0001',
  'invitation is invalid or expired',
  'invitation cannot be accepted twice'
);

reset role;
select tests.authenticate_as('alice');
select throws_ok(
  $$select nido.create_space('', 'solo', 'EUR', 'Europe/Madrid', '[]'::jsonb)$$,
  '22023',
  'invalid space name',
  'create_space rejects empty name'
);

select throws_ok(
  $$select nido.create_space('X', 'solo', 'EUR', 'Europe/Madrid', '[]'::jsonb, 99::smallint)$$,
  '22023',
  'invalid month_starts_on',
  'create_space rejects bad month_starts_on'
);

select is(
  (select count(*)::int from nido.spaces where name = 'X'),
  0,
  'failed create_space left no orphan space'
);

select ok(
  (select count(*)::int from nido.categories where space_id = current_setting('test.alice_space')::uuid) >= 2,
  'create_space seeded categories'
);

select ok(
  exists (
    select 1 from nido.space_members
    where space_id = current_setting('test.alice_space')::uuid
      and user_id = tests.uid('invitee')
      and status = 'active'
  ),
  'accepted invite linked invitee as active member'
);

select * from finish();
rollback;
