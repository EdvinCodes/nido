-- Phase 10 — push_subscriptions and quiet hours RLS.
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
    created_at, updated_at,
    confirmation_token, recovery_token, email_change,
    email_change_token_new, email_change_token_current,
    phone_change, phone_change_token
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
    now(),
    '', '', '', '', '', '', ''
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

select plan(5);
select tests.create_user('push_owner');
select tests.create_user('push_outsider');

select tests.authenticate_as('push_owner');
select set_config(
  'test.push_space',
  nido.create_space(
    'Push Test', 'couple', 'EUR', 'Europe/Madrid', '[]'::jsonb
  )::text,
  true
);

-- Positive: owner can insert own subscription
select lives_ok(
  $$
  insert into nido.push_subscriptions (user_id, endpoint, p256dh, auth)
  values (
    tests.uid('push_owner'),
    'https://push.example/sub/owner-1',
    'key',
    'auth'
  )
  $$,
  'owner inserts push subscription'
);

select tests.authenticate_as('push_outsider');

-- Negative: outsider cannot read owner subscription
select is(
  (select count(*)::int from nido.push_subscriptions where user_id = tests.uid('push_owner')),
  0,
  'outsider cannot select other user push subscriptions'
);

-- Negative: outsider cannot insert for owner
select throws_ok(
  $$
  insert into nido.push_subscriptions (user_id, endpoint, p256dh, auth)
  values (
    tests.uid('push_owner'),
    'https://push.example/sub/hijack',
    'key',
    'auth'
  )
  $$,
  'new row violates row-level security policy for table "push_subscriptions"',
  'outsider cannot insert push subscription for another user'
);

select tests.authenticate_as('push_owner');

-- Quiet hours: owner can upsert own row
select lives_ok(
  $$
  insert into nido.notification_quiet_hours (user_id, enabled, start_minute, end_minute, timezone)
  values (tests.uid('push_owner'), true, 1320, 480, 'Europe/Madrid')
  on conflict (user_id) do update set enabled = excluded.enabled
  $$,
  'owner upserts quiet hours'
);

select tests.authenticate_as('push_outsider');

select throws_ok(
  $$
  insert into nido.notification_quiet_hours (user_id, enabled)
  values (tests.uid('push_owner'), true)
  $$,
  'new row violates row-level security policy for table "notification_quiet_hours"',
  'outsider cannot set quiet hours for another user'
);

select * from finish();
rollback;
