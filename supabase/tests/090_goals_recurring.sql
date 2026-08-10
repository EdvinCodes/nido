-- Phase 05 — goals, next_occurrence, materialize, candidates, RLS.
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

select tests.create_user('goal_alice');
select tests.create_user('goal_bob');
select tests.create_user('goal_outsider');

select tests.authenticate_as('goal_alice');
select set_config(
  'test.goal_space',
  nido.create_space(
    'Goals Home',
    'couple'::nido.space_kind,
    'EUR'::nido.currency_code,
    'Europe/Madrid',
    '[{"display_name":"Ghost Goal"}]'::jsonb,
    1::smallint,
    1::smallint,
    null::text[]
  )::text,
  true
);

-- Add bob while still able to write as owner (same pattern as 050_tenancy_rls).
insert into nido.participants (space_id, user_id, display_name, position)
values (current_setting('test.goal_space')::uuid, tests.uid('goal_bob'), 'Bob', 2);

insert into nido.space_members (space_id, user_id, participant_id, role, status)
select current_setting('test.goal_space')::uuid, tests.uid('goal_bob'), p.id, 'member', 'active'
from nido.participants p
where p.space_id = current_setting('test.goal_space')::uuid
  and p.user_id = tests.uid('goal_bob');

select set_config(
  'test.alice_p',
  (select p.id::text from nido.participants p
   where p.space_id = current_setting('test.goal_space')::uuid
     and p.user_id = tests.uid('goal_alice')
   limit 1),
  true
);
select set_config(
  'test.bob_p',
  (select p.id::text from nido.participants p
   where p.space_id = current_setting('test.goal_space')::uuid
     and p.user_id = tests.uid('goal_bob')
   limit 1),
  true
);
select set_config(
  'test.cat',
  (select c.id::text from nido.categories c
   where c.space_id = current_setting('test.goal_space')::uuid
     and c.parent_id is null and c.kind = 'expense'
   order by c.position limit 1),
  true
);

insert into nido.accounts (id, space_id, name, kind, currency, opening_balance_minor, position)
values (
  '30000000-0000-4000-8000-0000000000b1',
  current_setting('test.goal_space')::uuid,
  'Checking',
  'bank',
  'EUR',
  0,
  0
);

select plan(32);

select is(
  (
    select count(*)::int
    from nido.space_members
    where space_id = current_setting('test.goal_space')::uuid
      and status = 'active'
  ),
  2,
  'fixture has two active members'
);

-- ---------------------------------------------------------------------------
-- next_occurrence cases
-- ---------------------------------------------------------------------------

-- 1. Monthly on the 31st clamps through February (non-leap 2025 → 28).
insert into nido.recurring_rules (
  id, space_id, kind, name, amount_minor, currency, category_id, account_id,
  payer_participant_id, split_mode, split_config, freq, interval_count,
  by_month_day, starts_on, next_run_on, created_by
) values (
  '30000000-0000-4000-8000-0000000000f1',
  current_setting('test.goal_space')::uuid,
  'subscription',
  'Month31',
  1000,
  'EUR',
  current_setting('test.cat')::uuid,
  '30000000-0000-4000-8000-0000000000b1',
  current_setting('test.alice_p')::uuid,
  'equal',
  jsonb_build_array(
    jsonb_build_object('participant_id', current_setting('test.alice_p')),
    jsonb_build_object('participant_id', current_setting('test.bob_p'))
  ),
  'month',
  1,
  31,
  '2025-01-31',
  '2025-01-31',
  tests.uid('goal_alice')
);

select is(
  nido.next_occurrence_after('30000000-0000-4000-8000-0000000000f1'::uuid, '2025-01-31'::date),
  '2025-02-28'::date,
  'monthly 31st clamps to Feb 28 in non-leap year'
);

-- 2. Same rule through leap February 2024.
update nido.recurring_rules
set starts_on = '2024-01-31', next_run_on = '2024-01-31', by_month_day = 31
where id = '30000000-0000-4000-8000-0000000000f1';

select is(
  nido.next_occurrence_after('30000000-0000-4000-8000-0000000000f1'::uuid, '2024-01-31'::date),
  '2024-02-29'::date,
  'monthly 31st clamps to Feb 29 in leap year'
);

-- 3. by_month_day = -1 → last day of month.
update nido.recurring_rules
set by_month_day = -1, starts_on = '2026-01-31', next_run_on = '2026-01-31'
where id = '30000000-0000-4000-8000-0000000000f1';

select is(
  nido.next_occurrence_after('30000000-0000-4000-8000-0000000000f1'::uuid, '2026-01-31'::date),
  '2026-02-28'::date,
  'by_month_day=-1 lands on last day of February'
);

select is(
  nido.next_occurrence_after('30000000-0000-4000-8000-0000000000f1'::uuid, '2026-03-31'::date),
  '2026-04-30'::date,
  'by_month_day=-1 lands on last day of April'
);

-- 4. Interval greater than one (every 2 months).
update nido.recurring_rules
set by_month_day = 15, interval_count = 2, starts_on = '2026-01-15', next_run_on = '2026-01-15'
where id = '30000000-0000-4000-8000-0000000000f1';

select is(
  nido.next_occurrence_after('30000000-0000-4000-8000-0000000000f1'::uuid, '2026-01-15'::date),
  '2026-03-15'::date,
  'monthly interval_count=2 skips one month'
);

-- 5. Weekly rule honours space week_starts_on (Monday).
insert into nido.recurring_rules (
  id, space_id, kind, name, amount_minor, currency, category_id, account_id,
  payer_participant_id, split_mode, split_config, freq, interval_count,
  by_weekday, starts_on, next_run_on, created_by
) values (
  '30000000-0000-4000-8000-0000000000f2',
  current_setting('test.goal_space')::uuid,
  'subscription',
  'Weekly',
  500,
  'EUR',
  current_setting('test.cat')::uuid,
  '30000000-0000-4000-8000-0000000000b1',
  current_setting('test.alice_p')::uuid,
  'personal',
  jsonb_build_array(jsonb_build_object('participant_id', current_setting('test.alice_p'))),
  'week',
  2,
  3, -- Wednesday
  '2026-01-07', -- Wednesday
  '2026-01-07',
  tests.uid('goal_alice')
);

select is(
  nido.next_occurrence_after('30000000-0000-4000-8000-0000000000f2'::uuid, '2026-01-07'::date),
  '2026-01-21'::date,
  'biweekly Wednesday with Monday week start'
);

-- Flip space to Sunday week start; anchor week changes so next biweekly Wednesday shifts.
update nido.spaces
set week_starts_on = 0
where id = current_setting('test.goal_space')::uuid;

select is(
  nido.next_occurrence_after('30000000-0000-4000-8000-0000000000f2'::uuid, '2026-01-07'::date),
  '2026-01-21'::date,
  'biweekly still advances two weeks from first Wednesday (Sunday week start)'
);

update nido.spaces
set week_starts_on = 1
where id = current_setting('test.goal_space')::uuid;

-- 6. ends_on stops the series.
update nido.recurring_rules
set ends_on = '2026-01-20', freq = 'day', interval_count = 1, by_weekday = null,
    starts_on = '2026-01-10', next_run_on = '2026-01-10'
where id = '30000000-0000-4000-8000-0000000000f2';

select is(
  nido.next_occurrence_after('30000000-0000-4000-8000-0000000000f2'::uuid, '2026-01-20'::date),
  null::date,
  'next_occurrence returns null past ends_on'
);

-- ---------------------------------------------------------------------------
-- materialize + idempotency + splits + price change
-- ---------------------------------------------------------------------------

insert into nido.recurring_rules (
  id, space_id, kind, name, merchant, amount_minor, currency, category_id, account_id,
  payer_participant_id, split_mode, split_config, freq, interval_count,
  by_month_day, starts_on, next_run_on, auto_create, created_by
) values (
  '30000000-0000-4000-8000-0000000000f3',
  current_setting('test.goal_space')::uuid,
  'subscription',
  'Netflix Test',
  'Netflix Test',
  1200,
  'EUR',
  current_setting('test.cat')::uuid,
  '30000000-0000-4000-8000-0000000000b1',
  current_setting('test.alice_p')::uuid,
  'equal',
  jsonb_build_array(
    jsonb_build_object('participant_id', current_setting('test.alice_p')),
    jsonb_build_object('participant_id', current_setting('test.bob_p'))
  ),
  'month',
  1,
  5,
  '2026-01-05',
  '2026-01-05',
  true,
  tests.uid('goal_alice')
);

select is(
  nido.materialize_recurring('30000000-0000-4000-8000-0000000000f3'::uuid, '2026-01-05'::date),
  1,
  'materialize creates one transaction'
);

select is(
  (
    select count(*)::int from nido.transactions
    where recurring_rule_id = '30000000-0000-4000-8000-0000000000f3'::uuid
      and deleted_at is null
  ),
  1,
  'one materialized row'
);

select is(
  (
    select s.owed_minor
    from nido.transaction_splits s
    join nido.transactions t on t.id = s.transaction_id
    where t.recurring_rule_id = '30000000-0000-4000-8000-0000000000f3'::uuid
      and s.participant_id = current_setting('test.alice_p')::uuid
  ),
  600::bigint,
  'equal split half for alice'
);

-- Force three runs and assert single transaction for Jan 5.
select nido.run_recurring_for_space(current_setting('test.goal_space')::uuid, '2026-01-05'::date);
select nido.run_recurring_for_space(current_setting('test.goal_space')::uuid, '2026-01-05'::date);
select nido.run_recurring_for_space(current_setting('test.goal_space')::uuid, '2026-01-05'::date);

select is(
  (
    select count(*)::int from nido.transactions
    where recurring_rule_id = '30000000-0000-4000-8000-0000000000f3'::uuid
      and booked_on = '2026-01-05'
      and deleted_at is null
  ),
  1,
  'three runs leave a single Jan 5 charge'
);

-- Price change > 1% on a linked create updates rule and notifies both members.
select lives_ok(
  format(
    $fmt$
      select nido.create_transaction(jsonb_build_object(
        'space_id', %L::uuid,
        'kind', 'expense',
        'booked_on', '2026-02-05',
        'amount_minor', 1500,
        'currency', 'EUR',
        'category_id', %L::uuid,
        'account_id', '30000000-0000-4000-8000-0000000000b1',
        'payer_participant_id', %L::uuid,
        'split_mode', 'equal',
        'participants', jsonb_build_array(
          jsonb_build_object('participant_id', %L::uuid),
          jsonb_build_object('participant_id', %L::uuid)
        ),
        'recurring_rule_id', '30000000-0000-4000-8000-0000000000f3',
        'description', 'Netflix hiked',
        'merchant', 'Netflix Test',
        'price_change_source', 'import'
      ))
    $fmt$,
    current_setting('test.goal_space'),
    current_setting('test.cat'),
    current_setting('test.alice_p'),
    current_setting('test.alice_p'),
    current_setting('test.bob_p')
  ),
  'create linked tx with price hike'
);

select is(
  (select amount_minor from nido.recurring_rules where id = '30000000-0000-4000-8000-0000000000f3'),
  1500::bigint,
  'rule amount updated after >1%% price change'
);

select is(
  (
    select count(*)::int from nido.recurring_price_changes
    where rule_id = '30000000-0000-4000-8000-0000000000f3'::uuid
  ),
  1,
  'price change row recorded'
);

-- Counts must run as a BYPASSRLS role; authenticated only sees own rows.
reset role;
select is(
  (
    select count(*)::int from nido.notifications
    where space_id = current_setting('test.goal_space')::uuid
      and kind = 'recurring_price_change'
  ),
  2,
  'price change notifies every active member'
);
select tests.authenticate_as('goal_alice');

-- ---------------------------------------------------------------------------
-- Goals: projection + reached once
-- ---------------------------------------------------------------------------

insert into nido.goals (
  id, space_id, name, target_minor, currency, target_date, created_by
) values (
  '30000000-0000-4000-8000-0000000000f4',
  current_setting('test.goal_space')::uuid,
  'Emergency',
  10000,
  'EUR',
  (current_date + 60),
  tests.uid('goal_alice')
);

-- Three months of contributions: 2000 each in prior calendar months.
insert into nido.goal_contributions (
  goal_id, space_id, participant_id, amount_minor, contributed_on
) values
  (
    '30000000-0000-4000-8000-0000000000f4',
    current_setting('test.goal_space')::uuid,
    current_setting('test.alice_p')::uuid,
    2000,
    (date_trunc('month', current_date) - interval '3 months')::date + 5
  ),
  (
    '30000000-0000-4000-8000-0000000000f4',
    current_setting('test.goal_space')::uuid,
    current_setting('test.alice_p')::uuid,
    2000,
    (date_trunc('month', current_date) - interval '2 months')::date + 5
  ),
  (
    '30000000-0000-4000-8000-0000000000f4',
    current_setting('test.goal_space')::uuid,
    current_setting('test.bob_p')::uuid,
    2000,
    (date_trunc('month', current_date) - interval '1 months')::date + 5
  );

select is(
  (nido.goal_projection('30000000-0000-4000-8000-0000000000f4'::uuid) ->> 'average_monthly_minor')::bigint,
  2000::bigint,
  'projection average monthly over last three months'
);

select ok(
  (nido.goal_projection('30000000-0000-4000-8000-0000000000f4'::uuid) ->> 'remaining_minor')::bigint = 4000,
  'remaining_minor is target - saved'
);

-- Past target date still returns projection fields.
update nido.goals
set target_date = (current_date - 10)
where id = '30000000-0000-4000-8000-0000000000f4';

select is(
  (nido.goal_projection('30000000-0000-4000-8000-0000000000f4'::uuid) ->> 'target_passed')::boolean,
  true,
  'target_passed when deadline elapsed with remaining balance'
);

-- Reach target → status + one notification per member.
insert into nido.goal_contributions (
  goal_id, space_id, participant_id, amount_minor, contributed_on, note
) values (
  '30000000-0000-4000-8000-0000000000f4',
  current_setting('test.goal_space')::uuid,
  current_setting('test.alice_p')::uuid,
  4000,
  current_date,
  'final push'
);

select is(
  (select status from nido.goals where id = '30000000-0000-4000-8000-0000000000f4'),
  'reached'::nido.goal_status,
  'goal status flips to reached'
);

reset role;
select is(
  (
    select count(*)::int from nido.notifications
    where space_id = current_setting('test.goal_space')::uuid
      and kind = 'goal_reached'
      and payload->>'goal_id' = '30000000-0000-4000-8000-0000000000f4'
  ),
  2,
  'goal_reached notifies each active member once'
);
select tests.authenticate_as('goal_alice');

-- Extra contribution past target does not duplicate notifications.
insert into nido.goal_contributions (
  goal_id, space_id, participant_id, amount_minor, contributed_on
) values (
  '30000000-0000-4000-8000-0000000000f4',
  current_setting('test.goal_space')::uuid,
  current_setting('test.alice_p')::uuid,
  100,
  current_date
);

reset role;
select is(
  (
    select count(*)::int from nido.notifications
    where space_id = current_setting('test.goal_space')::uuid
      and kind = 'goal_reached'
      and payload->>'goal_id' = '30000000-0000-4000-8000-0000000000f4'
  ),
  2,
  'goal_reached stays once per member'
);
select tests.authenticate_as('goal_alice');

-- Withdrawal requires note.
select throws_ok(
  format(
    $fmt$
      insert into nido.goal_contributions (
        goal_id, space_id, participant_id, amount_minor, contributed_on
      ) values (
        '30000000-0000-4000-8000-0000000000f4',
        %L::uuid, %L::uuid, -50, current_date
      )
    $fmt$,
    current_setting('test.goal_space'),
    current_setting('test.alice_p')
  ),
  '23514',
  'new row for relation "goal_contributions" violates check constraint "goal_contributions_withdrawal_reason"',
  'withdrawal without note is rejected'
);

-- ---------------------------------------------------------------------------
-- Candidate detection
-- ---------------------------------------------------------------------------

select lives_ok(
  format(
    $fmt$
      select nido.create_transaction(jsonb_build_object(
        'space_id', %L::uuid,
        'kind', 'expense',
        'booked_on', '2025-11-10',
        'amount_minor', 1999,
        'currency', 'EUR',
        'category_id', %L::uuid,
        'account_id', '30000000-0000-4000-8000-0000000000b1',
        'payer_participant_id', %L::uuid,
        'split_mode', 'personal',
        'participants', jsonb_build_array(
          jsonb_build_object('participant_id', %L::uuid)
        ),
        'description', 'Planted series',
        'merchant', 'Streamflix Candidate'
      ))
    $fmt$,
    current_setting('test.goal_space'),
    current_setting('test.cat'),
    current_setting('test.alice_p'),
    current_setting('test.alice_p')
  ),
  'plant candidate tx 1'
);

select lives_ok(
  format(
    $fmt$
      select nido.create_transaction(jsonb_build_object(
        'space_id', %L::uuid,
        'kind', 'expense',
        'booked_on', '2025-12-10',
        'amount_minor', 1999,
        'currency', 'EUR',
        'category_id', %L::uuid,
        'account_id', '30000000-0000-4000-8000-0000000000b1',
        'payer_participant_id', %L::uuid,
        'split_mode', 'personal',
        'participants', jsonb_build_array(
          jsonb_build_object('participant_id', %L::uuid)
        ),
        'description', 'Planted series',
        'merchant', 'Streamflix Candidate'
      ))
    $fmt$,
    current_setting('test.goal_space'),
    current_setting('test.cat'),
    current_setting('test.alice_p'),
    current_setting('test.alice_p')
  ),
  'plant candidate tx 2'
);

select lives_ok(
  format(
    $fmt$
      select nido.create_transaction(jsonb_build_object(
        'space_id', %L::uuid,
        'kind', 'expense',
        'booked_on', '2026-01-10',
        'amount_minor', 2050,
        'currency', 'EUR',
        'category_id', %L::uuid,
        'account_id', '30000000-0000-4000-8000-0000000000b1',
        'payer_participant_id', %L::uuid,
        'split_mode', 'personal',
        'participants', jsonb_build_array(
          jsonb_build_object('participant_id', %L::uuid)
        ),
        'description', 'Planted series',
        'merchant', 'Streamflix Candidate'
      ))
    $fmt$,
    current_setting('test.goal_space'),
    current_setting('test.cat'),
    current_setting('test.alice_p'),
    current_setting('test.alice_p')
  ),
  'plant candidate tx 3'
);

select ok(
  exists (
    select 1
    from jsonb_array_elements(
      nido.detect_recurring_candidates(current_setting('test.goal_space')::uuid)
    ) c
    where c ->> 'merchant_key' = 'streamflix candidate'
  ),
  'candidate detection finds planted Streamflix series'
);

select is(
  (
    select count(*)::int
    from jsonb_array_elements(
      nido.detect_recurring_candidates(current_setting('test.goal_space')::uuid)
    ) c
    where c ->> 'merchant_key' <> 'streamflix candidate'
  ),
  0,
  'no false-positive candidates in test space'
);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

select tests.authenticate_as('goal_outsider');

select is_empty(
  format(
    $fmt$ select id from nido.goals where space_id = %L::uuid $fmt$,
    current_setting('test.goal_space')
  ),
  'outsider cannot select goals'
);

select is_empty(
  format(
    $fmt$ select id from nido.recurring_rules where space_id = %L::uuid $fmt$,
    current_setting('test.goal_space')
  ),
  'outsider cannot select recurring rules'
);

select throws_ok(
  format(
    $fmt$
      insert into nido.goals (
        space_id, name, target_minor, currency, created_by
      ) values (
        %L::uuid, 'Hack', 100, 'EUR', tests.uid('goal_outsider')
      )
    $fmt$,
    current_setting('test.goal_space')
  ),
  '42501',
  'new row violates row-level security policy for table "goals"',
  'outsider cannot insert goals'
);

select * from finish();
rollback;
