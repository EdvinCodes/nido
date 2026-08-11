-- Phase 09 — FX convert, fallback, backfill, period snapshots RLS.
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

select tests.create_user('fx_owner');
select tests.create_user('fx_outsider');

select tests.authenticate_as('fx_owner');
select set_config(
  'test.fx_space',
  nido.create_space('FX Home', 'solo', 'EUR', 'Europe/Madrid', '[]'::jsonb)::text,
  true
);

select set_config(
  'test.fx_participant',
  (select p.id::text from nido.participants p
   where p.space_id = current_setting('test.fx_space')::uuid
     and p.user_id = tests.uid('fx_owner')
   limit 1),
  true
);

select set_config(
  'test.fx_category',
  (select c.id::text from nido.categories c
   where c.space_id = current_setting('test.fx_space')::uuid
   order by c.position
   limit 1),
  true
);

insert into nido.accounts (id, space_id, name, kind, currency, opening_balance_minor, position)
values (
  '50000000-0000-0000-0000-000000000001',
  current_setting('test.fx_space')::uuid,
  'Wallet',
  'cash',
  'EUR',
  0,
  0
) on conflict do nothing;

select plan(10);

select is(
  (nido.convert(12345, 'EUR', 'EUR', '2026-08-01') ->> 'amount_minor')::bigint,
  12345::bigint,
  'identity conversion returns input amount'
);

select is(
  (nido.convert(12345, 'EUR', 'EUR', '2026-08-01') ->> 'rate')::numeric,
  1::numeric,
  'identity conversion rate is 1'
);

select ok(
  (nido.convert(1000, 'JPY', 'EUR', '2026-08-01') ->> 'amount_minor')::bigint > 0,
  'JPY converts to positive EUR minor units'
);

set local role service_role;
insert into nido.exchange_rates (base, quote, rate, as_of, source)
values ('EUR', 'USD', 1.2000000000, '2026-09-01', 'test')
on conflict do nothing;
select tests.authenticate_as('fx_owner');

select is(
  (nido.convert(10000, 'USD', 'EUR', '2026-01-01') ->> 'fallback')::boolean,
  true,
  'convert falls back to oldest rate before on_date'
);

set local role service_role;
insert into nido.exchange_rates (base, quote, rate, as_of, source)
values ('EUR', 'GBP', 0.8500000000, '2026-07-01', 'test')
on conflict do nothing;
select tests.authenticate_as('fx_owner');

select lives_ok(
  format(
    $fmt$
      select nido.create_transaction(jsonb_build_object(
        'space_id', %L::uuid,
        'kind', 'expense',
        'booked_on', '2026-07-15',
        'amount_minor', 8500,
        'currency', 'GBP',
        'description', 'London lunch',
        'category_id', %L::uuid,
        'account_id', '50000000-0000-0000-0000-000000000001',
        'payer_participant_id', %L::uuid,
        'split_mode', 'personal',
        'participants', jsonb_build_array(
          jsonb_build_object('participant_id', %L::uuid, 'weight', 1)
        )
      ))
    $fmt$,
    current_setting('test.fx_space'),
    current_setting('test.fx_category'),
    current_setting('test.fx_participant'),
    current_setting('test.fx_participant')
  ),
  'GBP transaction inserts with FX trigger'
);

select ok(
  (
    select base_amount_minor > 8500
    from nido.transactions
    where space_id = current_setting('test.fx_space')::uuid
      and currency = 'GBP'
      and deleted_at is null
    limit 1
  ),
  'GBP expense converts to more EUR minor units than face value'
);

select is(
  nido.backfill_base_amounts(current_setting('test.fx_space')::uuid)::integer >= 1,
  true,
  'backfill touches at least one row'
);

select ok(
  nido.period_snapshot(
    current_setting('test.fx_space')::uuid,
    '2026-07-01'::date,
    '2026-07-31'::date
  ) ? 'totals',
  'period_snapshot includes totals'
);

reset role;
select set_config('request.jwt.claim.role', 'service_role', true);
select set_config(
  'request.jwt.claims',
  json_build_object('role', 'service_role')::text,
  true
);
set local role service_role;
select set_config(
  'test.fx_snapshot',
  nido.store_period_snapshot(
    current_setting('test.fx_space')::uuid,
    '2026-07-01'::date,
    '2026-07-31'::date
  )::text,
  true
);

select tests.authenticate_as('fx_outsider');
select is(
  (select count(*)::int from nido.period_snapshots
   where space_id = current_setting('test.fx_space')::uuid),
  0,
  'outsider cannot read period snapshots'
);

select tests.authenticate_as('fx_owner');
select is(
  (select count(*)::int from nido.period_snapshots
   where space_id = current_setting('test.fx_space')::uuid),
  1,
  'member can read period snapshots'
);

select * from finish();
rollback;
