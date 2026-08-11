-- Phase 08 — import/banking RLS and RPCs.
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

select tests.create_user('import_alice');
select tests.create_user('import_outsider');

select tests.authenticate_as('import_alice');
select set_config(
  'test.import_space',
  nido.create_space(
    'Import Home', 'solo', 'EUR', 'Europe/Madrid', '[]'::jsonb
  )::text,
  true
);

select set_config(
  'test.alice_participant',
  (select p.id::text from nido.participants p
   where p.space_id = current_setting('test.import_space')::uuid
     and p.user_id = tests.uid('import_alice')
   limit 1),
  true
);

select set_config(
  'test.category',
  (select c.id::text from nido.categories c
   where c.space_id = current_setting('test.import_space')::uuid
     and c.parent_id is null
   order by c.position
   limit 1),
  true
);

insert into nido.accounts (id, space_id, name, kind, currency, opening_balance_minor, position)
values (
  '20000000-0000-0000-0000-0000000000a1',
  current_setting('test.import_space')::uuid,
  'Checking',
  'bank',
  'EUR',
  0,
  0
);

select plan(11);

-- Positive: member can insert import batch.
select lives_ok(
  format(
    $fmt$
      insert into nido.import_batches (id, space_id, source, file_name, created_by, status)
      values (
        '30000000-0000-0000-0000-000000000001',
        %L::uuid,
        'csv',
        'test.csv',
        tests.uid('import_alice'),
        'previewing'
      )
    $fmt$,
    current_setting('test.import_space')
  ),
  'member can create import batch'
);

insert into nido.import_rows (
  id, batch_id, space_id, raw, parsed, fingerprint, decision
) values (
  '40000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000001',
  current_setting('test.import_space')::uuid,
  '{"Concepto":"Mercadona"}'::jsonb,
  jsonb_build_object(
    'booked_on', '2026-08-01',
    'amount_minor', 1500,
    'kind', 'expense',
    'description', 'Mercadona',
    'currency', 'EUR',
    'account_id', '20000000-0000-0000-0000-0000000000a1',
    'category_id', current_setting('test.category')
  ),
  'test-fp-mercadona',
  'import'
);

-- commit_import creates transaction atomically.
select lives_ok(
  $$ select nido.commit_import('30000000-0000-0000-0000-000000000001') $$,
  'commit_import succeeds'
);

select is(
  (select count(*)::int from nido.transactions t
   where t.space_id = current_setting('test.import_space')::uuid
     and t.deleted_at is null
     and t.import_row_id = '40000000-0000-0000-0000-000000000001'::uuid),
  1,
  'commit_import created one transaction'
);

-- find_duplicate detects fingerprint match within window.
select isnt(
  nido.find_duplicate(
    current_setting('test.import_space')::uuid,
    'test-fp-mercadona',
    '2026-08-02'::date,
    1500,
    null,
    'mercadona'
  ),
  null,
  'find_duplicate returns match within 3-day window'
);

-- undo_import soft-deletes batch transactions within 24h.
select lives_ok(
  $$ select nido.undo_import('30000000-0000-0000-0000-000000000001') $$,
  'undo_import succeeds within window'
);

select is(
  (select count(*)::int from nido.transactions t
   where t.import_row_id = '40000000-0000-0000-0000-000000000001'::uuid
     and t.deleted_at is null),
  0,
  'undo_import soft-deleted imported transaction'
);

-- Atomic commit: failure leaves zero new transactions.
insert into nido.import_batches (id, space_id, source, file_name, created_by, status, account_id)
values (
  '30000000-0000-0000-0000-000000000002',
  current_setting('test.import_space')::uuid,
  'csv',
  'bad.csv',
  tests.uid('import_alice'),
  'previewing',
  '20000000-0000-0000-0000-0000000000a1'
);

insert into nido.import_rows (id, batch_id, space_id, raw, parsed, fingerprint, decision)
values
  (
    '40000000-0000-0000-0000-000000000002',
    '30000000-0000-0000-0000-000000000002',
    current_setting('test.import_space')::uuid,
    '{}'::jsonb,
    jsonb_build_object(
      'booked_on', '2026-08-05',
      'amount_minor', 500,
      'kind', 'expense',
      'description', 'Ok row',
      'currency', 'EUR'
    ),
    'fp-ok',
    'import'
  ),
  (
    '40000000-0000-0000-0000-000000000003',
    '30000000-0000-0000-0000-000000000002',
    current_setting('test.import_space')::uuid,
    '{}'::jsonb,
    jsonb_build_object(
      'booked_on', '2026-08-05',
      'amount_minor', 0,
      'kind', 'expense',
      'description', 'Bad amount',
      'currency', 'EUR'
    ),
    'fp-bad',
    'import'
  );

select throws_like(
  $$ select nido.commit_import('30000000-0000-0000-0000-000000000002') $$,
  '%invalid amount%',
  'commit_import rolls back on invalid row'
);

select is(
  (select count(*)::int from nido.transactions t
   where t.import_row_id in (
     '40000000-0000-0000-0000-000000000002'::uuid,
     '40000000-0000-0000-0000-000000000003'::uuid
   ) and t.deleted_at is null),
  0,
  'failed commit left zero transactions'
);

-- apply_categorization_rules returns category for pattern match.
insert into nido.categorization_rules (
  id, space_id, match_type, pattern, field, category_id, priority
) values (
  '50000000-0000-0000-0000-000000000001',
  current_setting('test.import_space')::uuid,
  'contains',
  'mercadona',
  'merchant',
  current_setting('test.category')::uuid,
  1
);

select is(
  (select category_id::text from nido.apply_categorization_rules(
    current_setting('test.import_space')::uuid,
    'groceries',
    'Mercadona Valencia'
  ) limit 1),
  current_setting('test.category'),
  'apply_categorization_rules returns matching category'
);

-- Negative RLS: outsider cannot read import batches.
select tests.authenticate_as('import_outsider');

select is(
  (select count(*)::int from nido.import_batches
   where space_id = current_setting('test.import_space')::uuid),
  0,
  'outsider cannot select import batches'
);

select is(
  (select count(*)::int from nido.categorization_rules
   where space_id = current_setting('test.import_space')::uuid),
  0,
  'outsider cannot select categorization rules'
);

select * from finish();
rollback;
