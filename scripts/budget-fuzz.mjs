/**
 * Phase 04 drift test: 200 random ledger ops against a budget, then reconcile.
 * Zero drift required. Run after `pnpm db:reset` with local Supabase up.
 *
 *   pnpm budget:fuzz
 */
import { execFileSync } from 'node:child_process';
import { randomInt } from 'node:crypto';

const CONTAINER = process.env.SUPABASE_DB_CONTAINER ?? 'supabase_db_nido';
const OPS = 200;

function psql(sql) {
  return execFileSync(
    'docker',
    [
      'exec',
      '-i',
      CONTAINER,
      'psql',
      '-U',
      'postgres',
      '-d',
      'postgres',
      '-v',
      'ON_ERROR_STOP=1',
      '-At',
    ],
    { encoding: 'utf8', input: sql },
  ).trim();
}

const opBlocks = [];
for (let i = 0; i < OPS; i++) {
  const op = randomInt(0, 5);
  const amount = randomInt(100, 50000);
  const day = randomInt(1, 28);
  opBlocks.push(`
  v_op := ${op};
  v_amount := ${amount};
  v_day := ${day};
  if v_op = 0 then
    perform nido.create_transaction(jsonb_build_object(
      'space_id', v_space,
      'kind', 'expense',
      'booked_on', make_date(extract(year from current_date)::int, extract(month from current_date)::int, v_day),
      'amount_minor', v_amount,
      'currency', 'EUR',
      'category_id', v_cat,
      'payer_participant_id', v_part,
      'split_mode', 'personal',
      'participants', jsonb_build_array(jsonb_build_object('participant_id', v_part))
    ));
  elsif v_op = 1 then
    -- Amount/date "edit": replace via delete + create (update_transaction reorders amount before splits).
    select array_agg(id) into v_ids from nido.transactions
      where space_id = v_space and deleted_at is null and kind = 'expense';
    if v_ids is not null and cardinality(v_ids) > 0 then
      v_pick := v_ids[1 + (floor(random() * cardinality(v_ids)))::int];
      perform nido.delete_transaction(v_pick);
      perform nido.create_transaction(jsonb_build_object(
        'space_id', v_space,
        'kind', 'expense',
        'booked_on', make_date(extract(year from current_date)::int, extract(month from current_date)::int, v_day),
        'amount_minor', v_amount,
        'currency', 'EUR',
        'category_id', v_cat,
        'payer_participant_id', v_part,
        'split_mode', 'personal',
        'participants', jsonb_build_array(jsonb_build_object('participant_id', v_part))
      ));
    end if;
  elsif v_op = 2 then
    -- Category change: move spend off the budget category, then sometimes back.
    select array_agg(id) into v_ids from nido.transactions
      where space_id = v_space and deleted_at is null and kind = 'expense' and category_id = v_cat;
    if v_ids is not null and cardinality(v_ids) > 0 and v_cat2 is not null then
      v_pick := v_ids[1 + (floor(random() * cardinality(v_ids)))::int];
      perform nido.delete_transaction(v_pick);
      perform nido.create_transaction(jsonb_build_object(
        'space_id', v_space,
        'kind', 'expense',
        'booked_on', make_date(extract(year from current_date)::int, extract(month from current_date)::int, v_day),
        'amount_minor', v_amount,
        'currency', 'EUR',
        'category_id', case when random() < 0.5 then v_cat2 else v_cat end,
        'payer_participant_id', v_part,
        'split_mode', 'personal',
        'participants', jsonb_build_array(jsonb_build_object('participant_id', v_part))
      ));
    end if;
  elsif v_op = 3 then
    select array_agg(id) into v_ids from nido.transactions
      where space_id = v_space and deleted_at is null and kind = 'expense';
    if v_ids is not null and cardinality(v_ids) > 0 then
      v_pick := v_ids[1 + (floor(random() * cardinality(v_ids)))::int];
      perform nido.delete_transaction(v_pick);
    end if;
  else
    select array_agg(id) into v_ids from nido.transactions
      where space_id = v_space and deleted_at is not null and kind = 'expense';
    if v_ids is not null and cardinality(v_ids) > 0 then
      v_pick := v_ids[1 + (floor(random() * cardinality(v_ids)))::int];
      perform nido.restore_transaction(v_pick);
    end if;
  end if;
`);
}

const sql = `
drop table if exists public.budget_fuzz_state;
create table public.budget_fuzz_state (
  space_id uuid,
  participant_id uuid,
  category_id uuid,
  budget_id uuid,
  user_id uuid
);

do $setup$
declare
  v_uid uuid;
  v_space uuid;
  v_part uuid;
  v_cat uuid;
  v_budget uuid;
  v_email text := 'fuzz-' || replace(gen_random_uuid()::text, '-', '') || '@test.nido.local';
begin
  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at,
    confirmation_token, recovery_token, email_change,
    email_change_token_new, email_change_token_current,
    phone_change, phone_change_token
  ) values (
    gen_random_uuid(),
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    v_email,
    extensions.crypt('password123', extensions.gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"display_name":"fuzz"}'::jsonb,
    now(), now(), '', '', '', '', '', '', ''
  ) returning id into v_uid;

  perform set_config('request.jwt.claim.sub', v_uid::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', v_uid::text, 'role', 'authenticated')::text,
    true
  );
  execute 'set local role authenticated';

  v_space := nido.create_space(
    'Fuzz Nest', 'solo', 'EUR', 'UTC', '[]'::jsonb, 1::smallint, 1::smallint, null::text[]
  );
  select id into v_part from nido.participants where space_id = v_space and user_id = v_uid;
  select id into v_cat from nido.categories
    where space_id = v_space and kind = 'expense' and parent_id is null
    order by position limit 1;

  insert into nido.budgets (
    space_id, name, scope, category_id, period, limit_minor, currency,
    starts_on, alert_thresholds, created_by
  ) values (
    v_space, 'Fuzz Cat', 'category', v_cat, 'month', 1000000, 'EUR',
    date_trunc('month', current_date)::date, '{100}', v_uid
  ) returning id into v_budget;

  reset role;
  insert into public.budget_fuzz_state values (v_space, v_part, v_cat, v_budget, v_uid);
end;
$setup$;

do $fuzz$
declare
  v_space uuid;
  v_part uuid;
  v_cat uuid;
  v_budget uuid;
  v_uid uuid;
  v_ids uuid[];
  v_pick uuid;
  v_amount bigint;
  v_day int;
  v_op int;
  v_cat2 uuid;
begin
  select space_id, participant_id, category_id, budget_id, user_id
    into v_space, v_part, v_cat, v_budget, v_uid
  from public.budget_fuzz_state
  limit 1;

  perform set_config('request.jwt.claim.sub', v_uid::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', v_uid::text, 'role', 'authenticated')::text,
    true
  );
  execute 'set local role authenticated';

  select id into v_cat2 from nido.categories
    where space_id = v_space and kind = 'expense' and parent_id is null and id <> v_cat
    order by position limit 1;

${opBlocks.join('\n')}
end;
$fuzz$;

do $check$
declare
  v_budget uuid;
  v_drift int;
  v_reconcile int;
begin
  select budget_id into v_budget from public.budget_fuzz_state limit 1;

  select count(*)::int into v_drift
  from nido.budget_periods bp
  where bp.budget_id = v_budget
    and bp.spent_minor is distinct from
      nido.compute_budget_spent(bp.budget_id, bp.starts_on, bp.ends_on);

  if v_drift <> 0 then
    raise exception 'budget-fuzz drift: % period(s) disagree with compute_budget_spent', v_drift;
  end if;

  perform set_config('request.jwt.claim.role', 'service_role', true);
  execute 'set local role service_role';

  select count(*)::int into v_reconcile
  from nido.reconcile_open_budget_periods() r
  where r.budget_id = v_budget;

  if v_reconcile <> 0 then
    raise exception 'budget-fuzz reconcile reported % drifted period(s)', v_reconcile;
  end if;

  raise notice 'budget-fuzz: ${OPS} ops, zero drift';
end;
$check$;

drop table if exists public.budget_fuzz_state;
`;

try {
  psql(sql);
  console.log(`budget-fuzz: ${OPS} ops, zero drift`);
} catch (err) {
  const detail = err.stderr?.toString?.() || err.stdout?.toString?.() || err.message;
  console.error(detail);
  process.exit(1);
}
