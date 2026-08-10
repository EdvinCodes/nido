-- Phase 03 — space_summary / space_series / search_transactions.
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

select tests.create_user('dash_owner');
select tests.create_user('dash_outsider');

select tests.authenticate_as('dash_owner');
select set_config(
  'test.dash_space',
  nido.create_space(
    'Dashboard Fixture',
    'solo'::nido.space_kind,
    'EUR'::nido.currency_code,
    'Europe/Madrid',
    '[]'::jsonb,
    25::smallint,
    1::smallint,
    null::text[]
  )::text,
  true
);

select set_config(
  'test.dash_participant',
  (
    select p.id::text
    from nido.participants p
    where p.space_id = current_setting('test.dash_space')::uuid
    order by p.position
    limit 1
  ),
  true
);

select set_config(
  'test.dash_cat_income',
  (
    select c.id::text
    from nido.categories c
    where c.space_id = current_setting('test.dash_space')::uuid
      and c.kind in ('income', 'both')
    order by c.name
    limit 1
  ),
  true
);

select set_config(
  'test.dash_cat_expense',
  (
    select c.id::text
    from nido.categories c
    where c.space_id = current_setting('test.dash_space')::uuid
      and c.kind in ('expense', 'both')
    order by c.name
    limit 1
  ),
  true
);

insert into nido.accounts (id, space_id, name, kind, currency, opening_balance_minor, position)
values (
  '20000000-0000-4000-8000-0000000000a1',
  current_setting('test.dash_space')::uuid,
  'Cash',
  'cash',
  'EUR',
  0,
  0
);

select set_config('test.dash_account', '20000000-0000-4000-8000-0000000000a1', true);

-- Previous window 25 Jun–24 Jul: +50 / -20. Current 25 Jul–24 Aug: +100 / -50.
select nido.create_transaction(jsonb_build_object(
  'request_id', gen_random_uuid(),
  'space_id', current_setting('test.dash_space')::uuid,
  'kind', 'income',
  'booked_on', '2026-06-26',
  'amount_minor', 5000,
  'currency', 'EUR',
  'split_mode', 'personal',
  'description', 'Old salary',
  'merchant', 'Acme',
  'category_id', current_setting('test.dash_cat_income')::uuid,
  'account_id', current_setting('test.dash_account')::uuid,
  'payer_participant_id', current_setting('test.dash_participant')::uuid,
  'participants', jsonb_build_array(
    jsonb_build_object('participant_id', current_setting('test.dash_participant')::uuid, 'weight', 1)
  )
));

select nido.create_transaction(jsonb_build_object(
  'request_id', gen_random_uuid(),
  'space_id', current_setting('test.dash_space')::uuid,
  'kind', 'expense',
  'booked_on', '2026-07-01',
  'amount_minor', 2000,
  'currency', 'EUR',
  'split_mode', 'personal',
  'description', 'Old groceries',
  'merchant', 'Mercadona',
  'category_id', current_setting('test.dash_cat_expense')::uuid,
  'account_id', current_setting('test.dash_account')::uuid,
  'payer_participant_id', current_setting('test.dash_participant')::uuid,
  'participants', jsonb_build_array(
    jsonb_build_object('participant_id', current_setting('test.dash_participant')::uuid, 'weight', 1)
  )
));

select nido.create_transaction(jsonb_build_object(
  'request_id', gen_random_uuid(),
  'space_id', current_setting('test.dash_space')::uuid,
  'kind', 'income',
  'booked_on', '2026-07-26',
  'amount_minor', 10000,
  'currency', 'EUR',
  'split_mode', 'personal',
  'description', 'July salary',
  'merchant', 'Acme',
  'category_id', current_setting('test.dash_cat_income')::uuid,
  'account_id', current_setting('test.dash_account')::uuid,
  'payer_participant_id', current_setting('test.dash_participant')::uuid,
  'participants', jsonb_build_array(
    jsonb_build_object('participant_id', current_setting('test.dash_participant')::uuid, 'weight', 1)
  )
));

select nido.create_transaction(jsonb_build_object(
  'request_id', gen_random_uuid(),
  'space_id', current_setting('test.dash_space')::uuid,
  'kind', 'expense',
  'booked_on', '2026-08-01',
  'amount_minor', 4000,
  'currency', 'EUR',
  'split_mode', 'personal',
  'description', 'Groceries',
  'merchant', 'Mercadona',
  'category_id', current_setting('test.dash_cat_expense')::uuid,
  'account_id', current_setting('test.dash_account')::uuid,
  'payer_participant_id', current_setting('test.dash_participant')::uuid,
  'participants', jsonb_build_array(
    jsonb_build_object('participant_id', current_setting('test.dash_participant')::uuid, 'weight', 1)
  )
));

select nido.create_transaction(jsonb_build_object(
  'request_id', gen_random_uuid(),
  'space_id', current_setting('test.dash_space')::uuid,
  'kind', 'expense',
  'booked_on', '2026-08-10',
  'amount_minor', 1000,
  'currency', 'EUR',
  'split_mode', 'personal',
  'description', 'Metro',
  'merchant', 'Metro Madrid',
  'category_id', current_setting('test.dash_cat_expense')::uuid,
  'account_id', current_setting('test.dash_account')::uuid,
  'payer_participant_id', current_setting('test.dash_participant')::uuid,
  'participants', jsonb_build_array(
    jsonb_build_object('participant_id', current_setting('test.dash_participant')::uuid, 'weight', 1)
  )
));

select plan(11);

select is(
  (nido.space_summary(current_setting('test.dash_space')::uuid, '2026-07-25', '2026-08-24')
    -> 'totals' ->> 'income_minor')::bigint,
  10000::bigint,
  'current income sums base_amount_minor excluding transfers'
);

select is(
  (nido.space_summary(current_setting('test.dash_space')::uuid, '2026-07-25', '2026-08-24')
    -> 'totals' ->> 'expense_minor')::bigint,
  5000::bigint,
  'current expenses = 40 + 10'
);

select is(
  (nido.space_summary(current_setting('test.dash_space')::uuid, '2026-07-25', '2026-08-24')
    -> 'totals' ->> 'net_minor')::bigint,
  5000::bigint,
  'net = income - expense'
);

select is(
  (nido.space_summary(current_setting('test.dash_space')::uuid, '2026-07-25', '2026-08-24')
    -> 'previous_totals' ->> 'income_minor')::bigint,
  5000::bigint,
  'previous equivalent window income'
);

select is(
  (nido.space_summary(current_setting('test.dash_space')::uuid, '2026-07-25', '2026-08-24')
    -> 'previous_totals' ->> 'expense_minor')::bigint,
  2000::bigint,
  'previous equivalent window expense'
);

select is(
  (nido.space_summary(current_setting('test.dash_space')::uuid, '2026-07-25', '2026-08-24')
    ->> 'previous_from'),
  '2026-06-24',
  'previous_from is same-length window immediately before (31 days → Jun 24–Jul 24)'
);

select is(
  jsonb_array_length(
    nido.space_summary(current_setting('test.dash_space')::uuid, '2026-07-25', '2026-08-24') -> 'daily'
  ),
  31,
  'daily series includes every day in the range (31 days)'
);

select is(
  (
    select (elem ->> 'cumulative_net_minor')::bigint
    from jsonb_array_elements(
      nido.space_summary(current_setting('test.dash_space')::uuid, '2026-07-25', '2026-08-24') -> 'daily'
    ) elem
    where elem ->> 'date' = '2026-08-10'
  ),
  5000::bigint,
  'cumulative net reaches +50 by 10 Aug'
);

select is(
  jsonb_array_length(
    nido.space_series(current_setting('test.dash_space')::uuid, '2026-08-01', '2026-08-03', 'day')
  ),
  3,
  'space_series fills empty day buckets'
);

select ok(
  jsonb_array_length(
    nido.search_transactions(current_setting('test.dash_space')::uuid, 'Mercadona', 10)
  ) >= 1,
  'search_transactions finds merchant via FTS'
);

select tests.authenticate_as('dash_outsider');

select throws_ok(
  format(
    $$select nido.space_summary(%L::uuid, '2026-07-25', '2026-08-24')$$,
    current_setting('test.dash_space')
  ),
  '42501',
  'forbidden',
  'outsider cannot call space_summary on another space'
);

select * from finish();
rollback;
