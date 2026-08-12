-- Phase 02 — ledger invariants, RPCs, and RLS.
begin;

create schema if not exists tests;
grant usage on schema tests to authenticated, anon, service_role;

-- Reuse helpers if 050 already defined them in this session; recreate is fine in a fresh plan.
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

select tests.create_user('ledger_alice');
select tests.create_user('ledger_bob');
select tests.create_user('ledger_outsider');

select tests.authenticate_as('ledger_alice');
select set_config(
  'test.ledger_space',
  nido.create_space(
    'Ledger Home', 'couple', 'EUR', 'Europe/Madrid',
    '[{"display_name":"Ghost Pat"}]'::jsonb
  )::text,
  true
);

-- Resolve participants and a category for alice's space.
select set_config(
  'test.alice_participant',
  (select p.id::text from nido.participants p
   where p.space_id = current_setting('test.ledger_space')::uuid
     and p.user_id = tests.uid('ledger_alice')
   limit 1),
  true
);
select set_config(
  'test.ghost_participant',
  (select p.id::text from nido.participants p
   where p.space_id = current_setting('test.ledger_space')::uuid
     and p.user_id is null
   limit 1),
  true
);
select set_config(
  'test.category',
  (select c.id::text from nido.categories c
   where c.space_id = current_setting('test.ledger_space')::uuid
     and c.parent_id is null
   order by c.position
   limit 1),
  true
);

-- Two accounts for transfers + balance checks.
insert into nido.accounts (id, space_id, name, kind, currency, opening_balance_minor, position)
values
  ('10000000-0000-0000-0000-0000000000a1', current_setting('test.ledger_space')::uuid, 'Checking', 'bank', 'EUR', 100000, 0),
  ('10000000-0000-0000-0000-0000000000a2', current_setting('test.ledger_space')::uuid, 'Savings', 'savings', 'EUR', 0, 1);

-- Third participant so three-way equal splits are legal.
insert into nido.participants (id, space_id, user_id, display_name, color, position)
values (
  '10000000-0000-0000-0000-0000000000d3',
  current_setting('test.ledger_space')::uuid,
  null,
  'Ghost Rio',
  '#D4849A',
  2
);
select set_config('test.third_participant', '10000000-0000-0000-0000-0000000000d3', true);

select plan(20);

-- 1. Equal split of 1000 across three participants sums exactly.
select lives_ok(
  format(
    $fmt$
      select nido.create_transaction(jsonb_build_object(
        'space_id', %L::uuid,
        'kind', 'expense',
        'booked_on', '2026-05-01',
        'amount_minor', 1000,
        'currency', 'EUR',
        'category_id', %L::uuid,
        'payer_participant_id', %L::uuid,
        'split_mode', 'equal',
        'participants', jsonb_build_array(
          jsonb_build_object('participant_id', %L::uuid, 'weight', 1),
          jsonb_build_object('participant_id', %L::uuid, 'weight', 1),
          jsonb_build_object('participant_id', %L::uuid, 'weight', 1)
        )
      ))
    $fmt$,
    current_setting('test.ledger_space'),
    current_setting('test.category'),
    current_setting('test.alice_participant'),
    current_setting('test.alice_participant'),
    current_setting('test.ghost_participant'),
    current_setting('test.third_participant')
  ),
  'create_transaction accepts equal split of 1000 three ways'
);

select is(
  (
    select sum(s.owed_minor)::bigint
    from nido.transaction_splits s
    join nido.transactions t on t.id = s.transaction_id
    where t.space_id = current_setting('test.ledger_space')::uuid
      and t.amount_minor = 1000
      and t.deleted_at is null
  ),
  1000::bigint,
  'equal three-way split sums to amount_minor'
);

-- 2. Percent summing to 99 is rejected.
select throws_ok(
  format(
    $fmt$
      select nido.create_transaction(jsonb_build_object(
        'space_id', %L::uuid,
        'kind', 'expense',
        'booked_on', '2026-05-02',
        'amount_minor', 1000,
        'currency', 'EUR',
        'category_id', %L::uuid,
        'payer_participant_id', %L::uuid,
        'split_mode', 'percent',
        'participants', jsonb_build_array(
          jsonb_build_object('participant_id', %L::uuid, 'weight', 50),
          jsonb_build_object('participant_id', %L::uuid, 'weight', 49)
        )
      ))
    $fmt$,
    current_setting('test.ledger_space'),
    current_setting('test.category'),
    current_setting('test.alice_participant'),
    current_setting('test.alice_participant'),
    current_setting('test.ghost_participant')
  ),
  'P0001',
  'percent weights must total 100 (got 99)',
  'create_transaction rejects percent split summing to 99'
);

-- 3. Transfer with category rejected.
select throws_ok(
  format(
    $fmt$
      select nido.create_transaction(jsonb_build_object(
        'space_id', %L::uuid,
        'kind', 'transfer',
        'booked_on', '2026-05-03',
        'amount_minor', 500,
        'currency', 'EUR',
        'category_id', %L::uuid,
        'account_id', '10000000-0000-0000-0000-0000000000a1',
        'to_account_id', '10000000-0000-0000-0000-0000000000a2'
      ))
    $fmt$,
    current_setting('test.ledger_space'),
    current_setting('test.category')
  ),
  '22023',
  'transfers must not have a category',
  'transfer with category is rejected'
);

-- 4. Non-transfer without payer rejected.
select throws_ok(
  format(
    $fmt$
      select nido.create_transaction(jsonb_build_object(
        'space_id', %L::uuid,
        'kind', 'expense',
        'booked_on', '2026-05-04',
        'amount_minor', 500,
        'currency', 'EUR',
        'category_id', %L::uuid,
        'split_mode', 'personal',
        'participants', jsonb_build_array(
          jsonb_build_object('participant_id', %L::uuid, 'weight', 1)
        )
      ))
    $fmt$,
    current_setting('test.ledger_space'),
    current_setting('test.category'),
    current_setting('test.alice_participant')
  ),
  '22023',
  'non-transfer transactions require a payer',
  'expense without payer is rejected'
);

-- 5. Exact mode imbalance rejected.
select throws_ok(
  format(
    $fmt$
      select nido.create_transaction(jsonb_build_object(
        'space_id', %L::uuid,
        'kind', 'expense',
        'booked_on', '2026-05-05',
        'amount_minor', 1000,
        'currency', 'EUR',
        'category_id', %L::uuid,
        'payer_participant_id', %L::uuid,
        'split_mode', 'exact',
        'participants', jsonb_build_array(
          jsonb_build_object('participant_id', %L::uuid, 'owed_minor', 400),
          jsonb_build_object('participant_id', %L::uuid, 'owed_minor', 400)
        )
      ))
    $fmt$,
    current_setting('test.ledger_space'),
    current_setting('test.category'),
    current_setting('test.alice_participant'),
    current_setting('test.alice_participant'),
    current_setting('test.ghost_participant')
  ),
  'P0001',
  null,
  'exact imbalance is rejected'
);

-- 6. Direct unbalanced split insert violates deferred invariant.
select throws_ok(
  format(
    $fmt$
      do $body$
      declare
        v_tx uuid;
      begin
        insert into nido.transactions (
          space_id, kind, booked_on, amount_minor, currency, base_amount_minor,
          category_id, payer_participant_id, split_mode, created_by
        ) values (
          %L::uuid, 'expense', '2026-05-06', 1000, 'EUR', 1000,
          %L::uuid, %L::uuid, 'exact', tests.uid('ledger_alice')
        ) returning id into v_tx;
        insert into nido.transaction_splits (
          transaction_id, space_id, participant_id, weight, owed_minor, base_owed_minor
        ) values (
          v_tx, %L::uuid, %L::uuid, 1, 400, 400
        );
        -- Deferred constraint triggers only fire at commit unless forced immediate.
        set local search_path to nido, public;
        set constraints all immediate;
      end;
      $body$;
    $fmt$,
    current_setting('test.ledger_space'),
    current_setting('test.category'),
    current_setting('test.alice_participant'),
    current_setting('test.ledger_space'),
    current_setting('test.alice_participant')
  ),
  'P0001',
  null,
  'deferred balance trigger rejects unbalanced direct insert'
);

-- 7–8. Successful transfer + account_balance signs correctly.
select lives_ok(
  format(
    $fmt$
      select nido.create_transaction(jsonb_build_object(
        'space_id', %L::uuid,
        'kind', 'transfer',
        'booked_on', '2026-05-07',
        'amount_minor', 25000,
        'currency', 'EUR',
        'account_id', '10000000-0000-0000-0000-0000000000a1',
        'to_account_id', '10000000-0000-0000-0000-0000000000a2'
      ))
    $fmt$,
    current_setting('test.ledger_space')
  ),
  'transfer without category/payer succeeds'
);

select is(
  nido.account_balance('10000000-0000-0000-0000-0000000000a1'),
  75000::bigint,
  'source account balance decreases by transfer'
);

select is(
  nido.account_balance('10000000-0000-0000-0000-0000000000a2'),
  25000::bigint,
  'destination account balance increases by transfer'
);

-- 9–10. Soft delete excludes from view; restore brings back.
select set_config(
  'test.tx_to_delete',
  (select id::text from nido.v_transactions
   where space_id = current_setting('test.ledger_space')::uuid
     and amount_minor = 1000
   limit 1),
  true
);

select ok(
  (select nido.delete_transaction(current_setting('test.tx_to_delete')::uuid)->>'deleted')::boolean,
  'delete_transaction soft-deletes'
);

select is(
  (select count(*)::int from nido.v_transactions
   where id = current_setting('test.tx_to_delete')::uuid),
  0,
  'soft-deleted row is absent from v_transactions'
);

select ok(
  (select nido.restore_transaction(current_setting('test.tx_to_delete')::uuid)->>'restored')::boolean,
  'restore_transaction clears deleted_at'
);

select is(
  (select count(*)::int from nido.v_transactions
   where id = current_setting('test.tx_to_delete')::uuid),
  1,
  'restored row reappears in v_transactions'
);

-- 11–12. RLS: outsider cannot see transactions / accounts.
reset role;
select tests.authenticate_as('ledger_outsider');

select is_empty(
  format(
    'select 1 from nido.transactions where space_id = %L::uuid',
    current_setting('test.ledger_space')
  ),
  'outsider cannot select transactions'
);

select is_empty(
  format(
    'select 1 from nido.accounts where space_id = %L::uuid',
    current_setting('test.ledger_space')
  ),
  'outsider cannot select accounts'
);

-- 13. Member of the space can select.
reset role;
select tests.authenticate_as('ledger_alice');

select isnt_empty(
  format(
    'select 1 from nido.transactions where space_id = %L::uuid',
    current_setting('test.ledger_space')
  ),
  'member can select transactions'
);

-- 14–16. update_transaction can change amount without mid-mutation split imbalance.
select lives_ok(
  format(
    $fmt$
      select nido.update_transaction(
        (nido.create_transaction(jsonb_build_object(
          'space_id', %L::uuid,
          'kind', 'expense',
          'booked_on', '2026-06-01',
          'amount_minor', 1000,
          'currency', 'EUR',
          'category_id', %L::uuid,
          'payer_participant_id', %L::uuid,
          'split_mode', 'equal',
          'participants', jsonb_build_array(
            jsonb_build_object('participant_id', %L::uuid, 'weight', 1),
            jsonb_build_object('participant_id', %L::uuid, 'weight', 1)
          )
        )) ->> 'id')::uuid,
        jsonb_build_object(
          'request_id', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'::uuid,
          'kind', 'expense',
          'booked_on', '2026-06-01',
          'amount_minor', 2500,
          'currency', 'EUR',
          'category_id', %L::uuid,
          'payer_participant_id', %L::uuid,
          'split_mode', 'equal',
          'participants', jsonb_build_array(
            jsonb_build_object('participant_id', %L::uuid, 'weight', 1),
            jsonb_build_object('participant_id', %L::uuid, 'weight', 1)
          )
        )
      )
    $fmt$,
    current_setting('test.ledger_space'),
    current_setting('test.category'),
    current_setting('test.alice_participant'),
    current_setting('test.alice_participant'),
    current_setting('test.ghost_participant'),
    current_setting('test.category'),
    current_setting('test.alice_participant'),
    current_setting('test.alice_participant'),
    current_setting('test.ghost_participant')
  ),
  'update_transaction can change amount and rebalance equal splits'
);

select is(
  (
    select t.amount_minor
    from nido.transactions t
    where t.booked_on = '2026-06-01'
      and t.amount_minor = 2500
      and t.deleted_at is null
    order by t.created_at desc
    limit 1
  ),
  2500::bigint,
  'updated transaction persists the new amount'
);

select throws_ok(
  format(
    $fmt$
      select nido.update_transaction(
        (nido.create_transaction(jsonb_build_object(
          'space_id', %L::uuid,
          'kind', 'expense',
          'booked_on', '2026-06-03',
          'amount_minor', 1000,
          'currency', 'EUR',
          'category_id', %L::uuid,
          'payer_participant_id', %L::uuid,
          'split_mode', 'exact',
          'participants', jsonb_build_array(
            jsonb_build_object('participant_id', %L::uuid, 'owed_minor', 600),
            jsonb_build_object('participant_id', %L::uuid, 'owed_minor', 400)
          )
        )) ->> 'id')::uuid,
        jsonb_build_object(
          'request_id', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2'::uuid,
          'kind', 'expense',
          'booked_on', '2026-06-03',
          'amount_minor', 1000,
          'currency', 'EUR',
          'category_id', %L::uuid,
          'payer_participant_id', %L::uuid,
          'split_mode', 'exact',
          'participants', jsonb_build_array(
            jsonb_build_object('participant_id', %L::uuid, 'owed_minor', 700),
            jsonb_build_object('participant_id', %L::uuid, 'owed_minor', 200)
          )
        )
      )
    $fmt$,
    current_setting('test.ledger_space'),
    current_setting('test.category'),
    current_setting('test.alice_participant'),
    current_setting('test.alice_participant'),
    current_setting('test.ghost_participant'),
    current_setting('test.category'),
    current_setting('test.alice_participant'),
    current_setting('test.alice_participant'),
    current_setting('test.ghost_participant')
  ),
  'P0001',
  null,
  'update_transaction still rejects unbalanced exact splits'
);

select * from finish();
rollback;
