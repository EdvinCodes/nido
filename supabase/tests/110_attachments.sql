-- Phase 07 — attachments RLS and receipts storage isolation.
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

grant execute on function tests.create_user(text, text) to authenticated, anon, service_role;
grant execute on function tests.uid(text) to authenticated, anon, service_role;
grant execute on function tests.authenticate_as(text) to authenticated, anon, service_role;

select plan(8);

select tests.create_user('att_alice');
select tests.create_user('att_outsider');

select tests.authenticate_as('att_alice');
select set_config(
  'test.att_space',
  nido.create_space(
    'Attachments Home',
    'solo'::nido.space_kind,
    'EUR'::nido.currency_code,
    'Europe/Madrid',
    '[]'::jsonb,
    1::smallint,
    1::smallint,
    null::text[]
  )::text,
  true
);

select set_config(
  'test.att_path',
  current_setting('test.att_space') || '/2026/08/' || gen_random_uuid()::text || '.webp',
  true
);

-- Member can insert attachment row.
select lives_ok(
  format(
    $fmt$
      insert into nido.attachments (
        space_id, storage_path, mime_type, size_bytes, uploaded_by
      ) values (
        %L::uuid, %L, 'image/webp', 1200, tests.uid('att_alice')
      )
    $fmt$,
    current_setting('test.att_space'),
    current_setting('test.att_path')
  ),
  'member can insert attachment metadata'
);

select is(
  (
    select count(*)::int from nido.attachments
    where space_id = current_setting('test.att_space')::uuid
  ),
  1,
  'member can select own space attachments'
);

select set_config(
  'test.att_id',
  (
    select id::text from nido.attachments
    where storage_path = current_setting('test.att_path')
    limit 1
  ),
  true
);

select ok(
  (nido.space_storage_usage(current_setting('test.att_space')::uuid) ->> 'count')::int = 1,
  'space_storage_usage reports count'
);

-- Outsider cannot see the row.
select tests.authenticate_as('att_outsider');
select is(
  (
    select count(*)::int from nido.attachments
    where space_id = current_setting('test.att_space')::uuid
  ),
  0,
  'outsider cannot select attachments'
);

select throws_ok(
  format(
    'select nido.attachment_storage_paths(%L::uuid)',
    current_setting('test.att_id')
  ),
  '42501',
  'forbidden',
  'outsider cannot resolve attachment paths'
);

-- Storage policy: outsider cannot insert into alice space path.
select throws_ok(
  format(
    $fmt$
      insert into storage.objects (bucket_id, name, owner, metadata)
      values (
        'receipts',
        %L,
        tests.uid('att_outsider'),
        '{}'::jsonb
      )
    $fmt$,
    current_setting('test.att_path')
  ),
  '42501',
  null,
  'outsider cannot insert into another space receipts path'
);

-- Alice can insert a storage object under her space path.
select tests.authenticate_as('att_alice');
select lives_ok(
  format(
    $fmt$
      insert into storage.objects (bucket_id, name, owner, metadata)
      values (
        'receipts',
        %L,
        tests.uid('att_alice'),
        '{}'::jsonb
      )
    $fmt$,
    current_setting('test.att_space') || '/2026/08/' || gen_random_uuid()::text || '.webp'
  ),
  'member can insert receipt object under space path'
);

-- Outsider cannot select storage object in alice path.
select tests.authenticate_as('att_outsider');
select is(
  (
    select count(*)::int from storage.objects
    where bucket_id = 'receipts'
      and name = current_setting('test.att_path')
  ),
  0,
  'outsider cannot select receipt object in another space path'
);

select * from finish();
rollback;
