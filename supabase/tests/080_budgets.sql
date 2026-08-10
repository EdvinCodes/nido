-- Phase 04 — budgets spend, rollover, thresholds, RLS.
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

select tests.create_user('bud_alice');
select tests.create_user('bud_bob');
select tests.create_user('bud_outsider');

select tests.authenticate_as('bud_alice');
select set_config(
  'test.bud_space',
  nido.create_space(
    'Budget Home',
    'couple'::nido.space_kind,
    'EUR'::nido.currency_code,
    'Europe/Madrid',
    '[{"display_name":"Ghost Bud"}]'::jsonb,
    1::smallint,
    1::smallint,
    null::text[]
  )::text,
  true
);

select set_config(
  'test.alice_p',
  (select p.id::text from nido.participants p
   where p.space_id = current_setting('test.bud_space')::uuid
     and p.user_id = tests.uid('bud_alice')
   limit 1),
  true
);
select set_config(
  'test.ghost_p',
  (select p.id::text from nido.participants p
   where p.space_id = current_setting('test.bud_space')::uuid
     and p.user_id is null
   limit 1),
  true
);
select set_config(
  'test.cat_a',
  (select c.id::text from nido.categories c
   where c.space_id = current_setting('test.bud_space')::uuid
     and c.parent_id is null and c.kind = 'expense'
   order by c.position limit 1),
  true
);
select set_config(
  'test.cat_b',
  (select c.id::text from nido.categories c
   where c.space_id = current_setting('test.bud_space')::uuid
     and c.parent_id is null and c.kind = 'expense'
   order by c.position offset 1 limit 1),
  true
);

insert into nido.accounts (id, space_id, name, kind, currency, opening_balance_minor, position)
values (
  '20000000-0000-4000-8000-0000000000b1',
  current_setting('test.bud_space')::uuid,
  'Checking',
  'bank',
  'EUR',
  0,
  0
);

select plan(21);

-- 1. Category-scope budget spends base_amount_minor for expenses only.
select lives_ok(
  format(
    $fmt$
      insert into nido.budgets (
        id, space_id, name, scope, category_id, period, limit_minor, currency,
        starts_on, alert_thresholds, created_by
      ) values (
        '20000000-0000-4000-8000-0000000000c1',
        %L::uuid, 'Cat A', 'category', %L::uuid, 'month', 10000, 'EUR',
        '2026-05-01', '{50,80,100}', tests.uid('bud_alice')
      )
    $fmt$,
    current_setting('test.bud_space'),
    current_setting('test.cat_a')
  ),
  'insert category budget'
);

select lives_ok(
  format(
    $fmt$
      select nido.create_transaction(jsonb_build_object(
        'space_id', %L::uuid,
        'kind', 'expense',
        'booked_on', '2026-05-10',
        'amount_minor', 2500,
        'currency', 'EUR',
        'category_id', %L::uuid,
        'account_id', '20000000-0000-4000-8000-0000000000b1',
        'payer_participant_id', %L::uuid,
        'split_mode', 'equal',
        'participants', jsonb_build_array(
          jsonb_build_object('participant_id', %L::uuid),
          jsonb_build_object('participant_id', %L::uuid)
        )
      ))
    $fmt$,
    current_setting('test.bud_space'),
    current_setting('test.cat_a'),
    current_setting('test.alice_p'),
    current_setting('test.alice_p'),
    current_setting('test.ghost_p')
  ),
  'expense against category budget'
);

select is(
  (
    select bp.spent_minor
    from nido.budget_periods bp
    where bp.budget_id = '20000000-0000-4000-8000-0000000000c1'::uuid
      and '2026-05-10'::date between bp.starts_on and bp.ends_on
  ),
  2500::bigint,
  'category budget spent equals full expense amount'
);

-- 2. Participant scope uses base_owed_minor (half of equal split = 1250).
select lives_ok(
  format(
    $fmt$
      insert into nido.budgets (
        id, space_id, name, scope, participant_id, period, limit_minor, currency,
        starts_on, alert_thresholds, created_by
      ) values (
        '20000000-0000-4000-8000-0000000000c2',
        %L::uuid, 'Alice only', 'participant', %L::uuid, 'month', 50000, 'EUR',
        '2026-05-01', '{80,100}', tests.uid('bud_alice')
      )
    $fmt$,
    current_setting('test.bud_space'),
    current_setting('test.alice_p')
  ),
  'insert participant budget'
);

select is(
  (
    select bp.spent_minor
    from nido.budget_periods bp
    where bp.budget_id = '20000000-0000-4000-8000-0000000000c2'::uuid
      and '2026-05-10'::date between bp.starts_on and bp.ends_on
  ),
  1250::bigint,
  'participant budget spent equals alice owed share'
);

-- 3. Soft-delete then restore leaves spent unchanged.
select set_config(
  'test.tx_id',
  (
    select t.id::text from nido.transactions t
    where t.space_id = current_setting('test.bud_space')::uuid
      and t.amount_minor = 2500
      and t.deleted_at is null
    limit 1
  ),
  true
);

select lives_ok(
  format($fmt$ select nido.delete_transaction(%L::uuid) $fmt$, current_setting('test.tx_id')),
  'soft-delete expense'
);

select is(
  (
    select bp.spent_minor
    from nido.budget_periods bp
    where bp.budget_id = '20000000-0000-4000-8000-0000000000c1'::uuid
      and '2026-05-10'::date between bp.starts_on and bp.ends_on
  ),
  0::bigint,
  'spent drops to 0 after soft-delete'
);

select lives_ok(
  format($fmt$ select nido.restore_transaction(%L::uuid) $fmt$, current_setting('test.tx_id')),
  'restore expense'
);

select is(
  (
    select bp.spent_minor
    from nido.budget_periods bp
    where bp.budget_id = '20000000-0000-4000-8000-0000000000c1'::uuid
      and '2026-05-10'::date between bp.starts_on and bp.ends_on
  ),
  2500::bigint,
  'spent restored after undelete'
);

-- 4. Threshold notifies once even if spend drops and crosses again.
select lives_ok(
  format(
    $fmt$
      insert into nido.budgets (
        id, space_id, name, scope, category_id, period, limit_minor, currency,
        starts_on, alert_thresholds, created_by
      ) values (
        '20000000-0000-4000-8000-0000000000c3',
        %L::uuid, 'Tight', 'category', %L::uuid, 'month', 1000, 'EUR',
        '2026-06-01', '{80,100}', tests.uid('bud_alice')
      )
    $fmt$,
    current_setting('test.bud_space'),
    current_setting('test.cat_b')
  ),
  'insert tight budget for threshold test'
);

select lives_ok(
  format(
    $fmt$
      select nido.create_transaction(jsonb_build_object(
        'space_id', %L::uuid,
        'kind', 'expense',
        'booked_on', '2026-06-05',
        'amount_minor', 900,
        'currency', 'EUR',
        'category_id', %L::uuid,
        'payer_participant_id', %L::uuid,
        'split_mode', 'personal',
        'participants', jsonb_build_array(
          jsonb_build_object('participant_id', %L::uuid)
        )
      ))
    $fmt$,
    current_setting('test.bud_space'),
    current_setting('test.cat_b'),
    current_setting('test.alice_p'),
    current_setting('test.alice_p')
  ),
  'cross 80%% threshold'
);

select set_config(
  'test.threshold_tx',
  (
    select t.id::text
    from nido.transactions t
    where t.space_id = current_setting('test.bud_space')::uuid
      and t.booked_on = '2026-06-05'
      and t.amount_minor = 900
      and t.deleted_at is null
    order by t.created_at desc
    limit 1
  ),
  true
);

select is(
  (
    select count(*)::int
    from nido.notifications n
    where n.space_id = current_setting('test.bud_space')::uuid
      and n.payload->>'budget_id' = '20000000-0000-4000-8000-0000000000c3'
      and (n.payload->>'threshold')::int = 80
  ),
  1,
  'exactly one 80%% notification after first cross'
);

-- Drop below by soft-delete, restore (cross again) — still one notification.
select lives_ok(
  format(
    $fmt$ select nido.delete_transaction(%L::uuid) $fmt$,
    current_setting('test.threshold_tx')
  ),
  'soft-delete threshold expense'
);

select lives_ok(
  format(
    $fmt$ select nido.restore_transaction(%L::uuid) $fmt$,
    current_setting('test.threshold_tx')
  ),
  'restore threshold expense (re-cross 80%%)'
);

select is(
  (
    select count(*)::int
    from nido.notifications n
    where n.space_id = current_setting('test.bud_space')::uuid
      and n.payload->>'budget_id' = '20000000-0000-4000-8000-0000000000c3'
      and (n.payload->>'threshold')::int = 80
  ),
  1,
  '80%% still notified exactly once after drop and re-cross'
);

-- 5. Rollover carries unspent into next period.
select lives_ok(
  format(
    $fmt$
      insert into nido.budgets (
        id, space_id, name, scope, period, limit_minor, currency,
        starts_on, ends_on, rollover, alert_thresholds, created_by
      ) values (
        '20000000-0000-4000-8000-0000000000c4',
        %L::uuid, 'Roll', 'space', 'month', 10000, 'EUR',
        '2026-01-01', '2026-03-31', true, '{100}', tests.uid('bud_alice')
      )
    $fmt$,
    current_setting('test.bud_space')
  ),
  'insert rollover budget'
);

-- Spend 3000 in January; February limit should be 10000 + 7000 = 17000.
select lives_ok(
  format(
    $fmt$
      select nido.create_transaction(jsonb_build_object(
        'space_id', %L::uuid,
        'kind', 'expense',
        'booked_on', '2026-01-15',
        'amount_minor', 3000,
        'currency', 'EUR',
        'category_id', %L::uuid,
        'payer_participant_id', %L::uuid,
        'split_mode', 'personal',
        'participants', jsonb_build_array(
          jsonb_build_object('participant_id', %L::uuid)
        )
      ))
    $fmt$,
    current_setting('test.bud_space'),
    current_setting('test.cat_a'),
    current_setting('test.alice_p'),
    current_setting('test.alice_p')
  ),
  'january spend for rollover'
);

select is(
  (
    select bp.limit_minor
    from nido.budget_periods bp
    where bp.budget_id = '20000000-0000-4000-8000-0000000000c4'::uuid
      and bp.starts_on = '2026-02-01'::date
  ),
  17000::bigint,
  'february limit includes january unspent rollover'
);

-- 6. Weekly budgets respect week_starts_on (Monday = 1).
select is(
  (
    select starts_on
    from nido.period_bounds('week'::nido.budget_period, '2026-05-13'::date, 1::smallint, 1::smallint)
  ),
  '2026-05-11'::date,
  'week starting Monday: Wed 13 May → Mon 11 May'
);

-- 7. Monthly budgets respect month_starts_on = 25.
select is(
  (
    select starts_on
    from nido.period_bounds('month'::nido.budget_period, '2026-05-10'::date, 1::smallint, 25::smallint)
  ),
  '2026-04-25'::date,
  'household month starting on 25th: May 10 → Apr 25'
);

-- 8. Outsider cannot see budgets.
select tests.authenticate_as('bud_outsider');
select is_empty(
  format(
    $fmt$ select 1 from nido.budgets where space_id = %L::uuid $fmt$,
    current_setting('test.bud_space')
  ),
  'outsider cannot select budgets'
);

select * from finish();
rollback;
