-- Phase 06 — balances view, settlements RLS, propose/confirm/reverse invariants.
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

select plan(20);

select tests.create_user('bal_alice');
select tests.create_user('bal_bob');
select tests.create_user('bal_outsider');

select tests.authenticate_as('bal_alice');
select set_config(
  'test.bal_space',
  nido.create_space(
    'Balances Home',
    'couple'::nido.space_kind,
    'EUR'::nido.currency_code,
    'Europe/Madrid',
    '[{"display_name":"Ghost Bal"}]'::jsonb,
    1::smallint,
    1::smallint,
    null::text[]
  )::text,
  true
);

insert into nido.participants (space_id, user_id, display_name, position)
values (current_setting('test.bal_space')::uuid, tests.uid('bal_bob'), 'Bob', 2);

insert into nido.space_members (space_id, user_id, participant_id, role, status)
select current_setting('test.bal_space')::uuid, tests.uid('bal_bob'), p.id, 'member', 'active'
from nido.participants p
where p.space_id = current_setting('test.bal_space')::uuid
  and p.user_id = tests.uid('bal_bob');

select set_config(
  'test.alice_p',
  (select p.id::text from nido.participants p
   where p.space_id = current_setting('test.bal_space')::uuid
     and p.user_id = tests.uid('bal_alice')
   limit 1),
  true
);
select set_config(
  'test.bob_p',
  (select p.id::text from nido.participants p
   where p.space_id = current_setting('test.bal_space')::uuid
     and p.user_id = tests.uid('bal_bob')
   limit 1),
  true
);
select set_config(
  'test.ghost_p',
  (select p.id::text from nido.participants p
   where p.space_id = current_setting('test.bal_space')::uuid
     and p.user_id is null
   limit 1),
  true
);

select set_config(
  'test.cat',
  (
    select c.id::text from nido.categories c
    where c.space_id = current_setting('test.bal_space')::uuid
      and c.parent_id is null
    order by c.position
    limit 1
  ),
  true
);

insert into nido.accounts (id, space_id, name, kind, currency, opening_balance_minor, position)
values (
  '16000000-0000-0000-0000-0000000000a1',
  current_setting('test.bal_space')::uuid,
  'Checking',
  'bank',
  'EUR',
  0,
  0
);

select nido.create_transaction(jsonb_build_object(
  'space_id', current_setting('test.bal_space')::uuid,
  'kind', 'expense',
  'amount_minor', 10000,
  'currency', 'EUR',
  'booked_on', current_date,
  'description', 'Dinner',
  'account_id', '16000000-0000-0000-0000-0000000000a1'::uuid,
  'category_id', current_setting('test.cat')::uuid,
  'payer_participant_id', current_setting('test.alice_p')::uuid,
  'split_mode', 'exact',
  'participants', jsonb_build_array(
    jsonb_build_object(
      'participant_id', current_setting('test.alice_p')::uuid,
      'owed_minor', 4000
    ),
    jsonb_build_object(
      'participant_id', current_setting('test.bob_p')::uuid,
      'owed_minor', 6000
    )
  )
));

-- Net: alice paid 10000 owed 4000 => +6000; bob paid 0 owed 6000 => -6000.
select is(
  (
    select coalesce(sum(net_minor), 0)::bigint
    from nido.v_participant_balances
    where space_id = current_setting('test.bal_space')::uuid
  )::bigint,
  0::bigint,
  'net positions sum to zero'
);

select is(
  (
    select net_minor from nido.v_participant_balances
    where participant_id = current_setting('test.alice_p')::uuid
  ),
  6000::bigint,
  'alice net after expense'
);

select is(
  (
    select net_minor from nido.v_participant_balances
    where participant_id = current_setting('test.bob_p')::uuid
  ),
  (-6000)::bigint,
  'bob net after expense'
);

-- Breakdown reconstructs alice figure.
select is(
  (
    select coalesce(sum((t ->> 'delta_minor')::bigint), 0)::bigint
    from jsonb_array_elements(
      nido.balance_breakdown(
        current_setting('test.bal_space')::uuid,
        current_setting('test.alice_p')::uuid
      ) -> 'transactions'
    ) t
  ),
  6000::bigint,
  'breakdown deltas reconstruct alice net'
);

-- Bob proposes; propose does not move balances until confirm.
select tests.authenticate_as('bal_bob');
select set_config(
  'test.settlement',
  (
    nido.propose_settlement(jsonb_build_object(
      'space_id', current_setting('test.bal_space')::uuid,
      'from_participant_id', current_setting('test.bob_p')::uuid,
      'to_participant_id', current_setting('test.alice_p')::uuid,
      'amount_minor', 6000,
      'currency', 'EUR',
      'method', 'bizum',
      'note', 'Dinner settle'
    )) ->> 'id'
  ),
  true
);

select is(
  (
    select confirmed_at is null from nido.settlements
    where id = current_setting('test.settlement')::uuid
  ),
  true,
  'proposed settlement stays unconfirmed'
);

select is(
  (
    select net_minor from nido.v_participant_balances
    where participant_id = current_setting('test.alice_p')::uuid
  ),
  6000::bigint,
  'proposed settlement does not change alice net'
);

-- Bob (proposer, non-admin) cannot confirm.
select throws_ok(
  format(
    'select nido.confirm_settlement(%L::uuid)',
    current_setting('test.settlement')
  ),
  '42501',
  'proposer cannot confirm',
  'proposer cannot confirm own settlement'
);

-- Alice (counterparty / owner) confirms.
select tests.authenticate_as('bal_alice');
select ok(
  (nido.confirm_settlement(current_setting('test.settlement')::uuid) ->> 'confirmed')::boolean,
  'counterparty can confirm'
);

select is(
  (
    select net_minor from nido.v_participant_balances
    where participant_id = current_setting('test.alice_p')::uuid
  ),
  0::bigint,
  'confirm clears alice net'
);

select is(
  (
    select net_minor from nido.v_participant_balances
    where participant_id = current_setting('test.bob_p')::uuid
  ),
  0::bigint,
  'confirm clears bob net'
);

-- Outsider cannot see settlements.
select tests.authenticate_as('bal_outsider');
select is(
  (
    select count(*)::int from nido.settlements
    where space_id = current_setting('test.bal_space')::uuid
  ),
  0,
  'outsider cannot select settlements'
);

-- Reverse restores.
select tests.authenticate_as('bal_alice');
select ok(
  (nido.reverse_settlement(current_setting('test.settlement')::uuid) ->> 'reversal_id') is not null,
  'reverse creates compensating record'
);

select is(
  (
    select net_minor from nido.v_participant_balances
    where participant_id = current_setting('test.alice_p')::uuid
  ),
  6000::bigint,
  'reverse restores alice net'
);

select is(
  (
    select count(*)::int from nido.settlements
    where space_id = current_setting('test.bal_space')::uuid
  ),
  2,
  'both original and reversal remain visible'
);

-- Ghost auto-confirm.
select set_config(
  'test.ghost_settle',
  (
    nido.propose_settlement(jsonb_build_object(
      'space_id', current_setting('test.bal_space')::uuid,
      'from_participant_id', current_setting('test.ghost_p')::uuid,
      'to_participant_id', current_setting('test.alice_p')::uuid,
      'amount_minor', 100,
      'currency', 'EUR',
      'method', 'cash'
    )) ->> 'id'
  ),
  true
);

select is(
  (
    select confirmed_at is not null from nido.settlements
    where id = current_setting('test.ghost_settle')::uuid
  ),
  true,
  'ghost counterparty auto-confirms'
);

-- Pairwise returns bob→alice debt after reverse (6000) adjusted by ghost settle.
select ok(
  jsonb_typeof(nido.pairwise_balances(current_setting('test.bal_space')::uuid)) = 'array',
  'pairwise_balances returns array'
);

-- Seed invariant: nets sum to zero on demo couple space if present.
select ok(
  coalesce(
    (
      select sum(b.net_minor) = 0
      from nido.v_participant_balances b
      join nido.spaces s on s.id = b.space_id
      where s.name = 'Casa de Alex y Sam'
    ),
    true
  ),
  'seed couple space nets sum to zero when present'
);

-- Member may propose involving self; outsider may not.
select tests.authenticate_as('bal_outsider');
select throws_ok(
  format(
    $fmt$select nido.propose_settlement(%L::jsonb)$fmt$,
    jsonb_build_object(
      'space_id', current_setting('test.bal_space')::uuid,
      'from_participant_id', current_setting('test.bob_p')::uuid,
      'to_participant_id', current_setting('test.alice_p')::uuid,
      'amount_minor', 1,
      'currency', 'EUR'
    )::text
  ),
  '42501',
  'forbidden',
  'outsider cannot propose settlement'
);

-- Dispute path.
select tests.authenticate_as('bal_alice');
select set_config(
  'test.dispute',
  (
    nido.propose_settlement(jsonb_build_object(
      'space_id', current_setting('test.bal_space')::uuid,
      'from_participant_id', current_setting('test.bob_p')::uuid,
      'to_participant_id', current_setting('test.alice_p')::uuid,
      'amount_minor', 50,
      'currency', 'EUR',
      'method', 'other'
    )) ->> 'id'
  ),
  true
);

select tests.authenticate_as('bal_bob');
select ok(
  (nido.dispute_settlement(current_setting('test.dispute')::uuid, 'Wrong amount') ->> 'disputed')::boolean,
  'counterparty can dispute'
);

select throws_ok(
  format(
    'select nido.confirm_settlement(%L::uuid)',
    current_setting('test.dispute')
  ),
  'P0001',
  'settlement was disputed',
  'cannot confirm after dispute'
);

select * from finish();
rollback;
