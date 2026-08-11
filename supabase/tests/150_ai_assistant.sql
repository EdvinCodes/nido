-- Phase 12 — AI assistant RLS (pgTAP).
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

select plan(8);

select tests.create_user('ai_owner');
select tests.create_user('ai_member');
select tests.create_user('ai_outsider');

select tests.authenticate_as('ai_owner');
select set_config(
  'test.ai_space',
  nido.create_space(
    'AI Fixture',
    'couple'::nido.space_kind,
    'EUR'::nido.currency_code,
    'Europe/Madrid',
    '[]'::jsonb,
    25::smallint,
    1::smallint,
    null::text[]
  )::text,
  true
);

insert into nido.participants (space_id, user_id, display_name, color, position)
values (
  current_setting('test.ai_space')::uuid,
  tests.uid('ai_member'),
  'Member',
  '#6B8EAD',
  1
);

select set_config(
  'test.ai_member_participant',
  (
    select p.id::text
    from nido.participants p
    where p.space_id = current_setting('test.ai_space')::uuid
      and p.user_id = tests.uid('ai_member')
    limit 1
  ),
  true
);

insert into nido.space_members (space_id, user_id, participant_id, role, status)
values (
  current_setting('test.ai_space')::uuid,
  tests.uid('ai_member'),
  current_setting('test.ai_member_participant')::uuid,
  'member',
  'active'
);

select tests.authenticate_as('ai_owner');

insert into nido.ai_conversations (space_id, user_id, title)
values (
  current_setting('test.ai_space')::uuid,
  tests.uid('ai_owner'),
  'Private question'
);

select ok(
  (
    select count(*)::integer
    from nido.ai_conversations
    where user_id = tests.uid('ai_owner')
  ) = 1,
  'owner can insert own conversation'
);

select tests.authenticate_as('ai_member');

select ok(
  (
    select count(*)::integer
    from nido.ai_conversations
    where title = 'Private question'
  ) = 0,
  'other member cannot read owner conversation'
);

select tests.authenticate_as('ai_outsider');

select ok(
  (
    select count(*)::integer
    from nido.ai_conversations
  ) = 0,
  'outsider cannot read conversations'
);

select tests.authenticate_as('ai_owner');

insert into nido.ai_messages (conversation_id, space_id, role, content)
select id, space_id, 'user', '"hello"'::jsonb
from nido.ai_conversations
where title = 'Private question'
limit 1;

select tests.authenticate_as('ai_member');

select ok(
  (
    select count(*)::integer
    from nido.ai_messages m
    join nido.ai_conversations c on c.id = m.conversation_id
    where c.title = 'Private question'
  ) = 0,
  'other member cannot read owner messages'
);

select tests.authenticate_as('ai_owner');

select ok(
  (
    select count(*)::integer
    from nido.ai_messages m
    join nido.ai_conversations c on c.id = m.conversation_id
    where c.title = 'Private question'
  ) = 1,
  'owner can read own messages'
);

insert into nido.ai_consent (
  space_id,
  consented_by,
  provider,
  consent_text
) values (
  current_setting('test.ai_space')::uuid,
  tests.uid('ai_owner'),
  'ollama',
  'Test consent'
);

select ok(
  exists (
    select 1
    from nido.ai_consent
    where space_id = current_setting('test.ai_space')::uuid
      and revoked_at is null
  ),
  'owner can record consent'
);

select tests.authenticate_as('ai_member');

select ok(
  exists (
    select 1
    from nido.ai_consent
    where space_id = current_setting('test.ai_space')::uuid
  ),
  'member can read consent status'
);

select tests.authenticate_as('ai_member');

select throws_ok(
  format(
    $$ insert into nido.ai_consent (space_id, consented_by, provider, consent_text)
       values (%L, %L, 'ollama', 'Member attempt') $$,
    current_setting('test.ai_space')::uuid,
    tests.uid('ai_member')::text
  ),
  '42501',
  null,
  'non-admin cannot insert consent'
);

select * from finish();
rollback;
