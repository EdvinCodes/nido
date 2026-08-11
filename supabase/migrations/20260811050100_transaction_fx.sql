-- Phase 09 — manual rate flag, base-amount trigger, backfill, and RPC updates.

alter table nido.transactions
  add column base_rate_manual boolean not null default false;

comment on column nido.transactions.base_rate_manual is
  'When true, base_rate was supplied by the user and must not be overwritten by FX refresh.';

create or replace function nido.tg_compute_base_amount()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_base nido.currency_code;
  v_conv jsonb;
begin
  select s.base_currency into v_base
  from nido.spaces s
  where s.id = new.space_id;

  if not found then
    raise exception 'space not found' using errcode = 'P0002';
  end if;

  if new.base_rate_manual then
    new.base_amount_minor := round(new.amount_minor::numeric * new.base_rate)::bigint;
    return new;
  end if;

  if new.currency = v_base then
    new.base_rate := 1;
    new.base_amount_minor := new.amount_minor;
    return new;
  end if;

  v_conv := nido.convert(new.amount_minor, new.currency, v_base, new.booked_on);
  new.base_amount_minor := (v_conv ->> 'amount_minor')::bigint;
  new.base_rate := (v_conv ->> 'rate')::numeric(20, 10);

  return new;
end;
$$;

create trigger transactions_compute_base_amount
  before insert or update of amount_minor, currency, booked_on, base_rate, base_rate_manual
  on nido.transactions
  for each row
  execute function nido.tg_compute_base_amount();

create or replace function nido.backfill_base_amounts(p_space_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer := 0;
begin
  if auth.uid() is not null
     and auth.role() is distinct from 'service_role'
     and not nido.is_member(p_space_id, array['owner', 'admin']::nido.member_role[]) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  update nido.transactions t
  set
    base_rate_manual = false,
    amount_minor = t.amount_minor
  where t.space_id = p_space_id
    and t.deleted_at is null;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

comment on function nido.backfill_base_amounts(uuid) is
  'Recompute base_amount_minor for every transaction in a space after a base-currency change.';

revoke all on function nido.backfill_base_amounts(uuid) from public;
grant execute on function nido.backfill_base_amounts(uuid) to authenticated, service_role;

do $$
declare
  v_space_id uuid;
begin
  for v_space_id in select id from nido.spaces loop
    perform nido.backfill_base_amounts(v_space_id);
  end loop;
end;
$$;

-- Patch create_transaction to persist base_rate_manual.
create or replace function nido.create_transaction(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid;
  v_space_id uuid := (p ->> 'space_id')::uuid;
  v_request_id uuid := nullif(p ->> 'request_id', '')::uuid;
  v_kind nido.tx_kind := (p ->> 'kind')::nido.tx_kind;
  v_booked_on date := (p ->> 'booked_on')::date;
  v_amount_minor bigint := (p ->> 'amount_minor')::bigint;
  v_currency nido.currency_code := (p ->> 'currency')::nido.currency_code;
  v_split_mode nido.split_mode := coalesce((p ->> 'split_mode')::nido.split_mode, 'personal');
  v_base_rate_manual boolean := coalesce((p ->> 'base_rate_manual')::boolean, false);
  v_base_rate numeric(20, 10) := coalesce((p ->> 'base_rate')::numeric, 1);
  v_base_amount bigint;
  v_tx_id uuid;
  v_cached jsonb;
  v_tag_ids uuid[];
  v_account_id uuid := nullif(p ->> 'account_id', '')::uuid;
  v_to_account_id uuid := nullif(p ->> 'to_account_id', '')::uuid;
  v_category_id uuid := nullif(p ->> 'category_id', '')::uuid;
  v_payer_id uuid := nullif(p ->> 'payer_participant_id', '')::uuid;
  v_recurring_rule_id uuid := nullif(p ->> 'recurring_rule_id', '')::uuid;
  v_goal_id uuid := nullif(p ->> 'goal_id', '')::uuid;
  v_price_source text := coalesce(nullif(p ->> 'price_change_source', ''), 'generated');
begin
  v_uid := nido._assert_contributor(v_space_id);

  if v_request_id is not null then
    select result into v_cached
    from nido.idempotency_keys
    where user_id = v_uid and request_id = v_request_id;
    if found then
      return v_cached;
    end if;
  end if;

  if v_kind is null then
    raise exception 'kind is required' using errcode = '22023';
  end if;
  if v_booked_on is null then
    raise exception 'booked_on is required' using errcode = '22023';
  end if;
  if v_amount_minor is null or v_amount_minor <= 0 then
    raise exception 'amount_minor must be > 0' using errcode = '22023';
  end if;
  if v_currency is null then
    select base_currency into v_currency from nido.spaces where id = v_space_id;
  end if;
  if not exists (select 1 from nido.currencies c where c.code = v_currency) then
    raise exception 'unknown currency %', v_currency using errcode = '22023';
  end if;

  if v_recurring_rule_id is not null and not exists (
    select 1 from nido.recurring_rules r
    where r.id = v_recurring_rule_id and r.space_id = v_space_id
  ) then
    raise exception 'recurring rule not in space' using errcode = '22023';
  end if;

  if v_goal_id is not null and not exists (
    select 1 from nido.goals g
    where g.id = v_goal_id and g.space_id = v_space_id
  ) then
    raise exception 'goal not in space' using errcode = '22023';
  end if;

  v_base_amount := round(v_amount_minor::numeric * v_base_rate)::bigint;

  if v_kind = 'transfer' then
    if v_account_id is null or v_to_account_id is null then
      raise exception 'transfers require account_id and to_account_id' using errcode = '22023';
    end if;
    if v_category_id is not null then
      raise exception 'transfers must not have a category' using errcode = '22023';
    end if;
    if v_payer_id is not null then
      raise exception 'transfers must not have a payer' using errcode = '22023';
    end if;
    if not exists (
      select 1 from nido.accounts a
      where a.id = v_account_id and a.space_id = v_space_id and a.archived_at is null
    ) or not exists (
      select 1 from nido.accounts a
      where a.id = v_to_account_id and a.space_id = v_space_id and a.archived_at is null
    ) then
      raise exception 'transfer accounts must belong to the space' using errcode = '22023';
    end if;
  else
    if v_payer_id is null then
      raise exception 'non-transfer transactions require a payer' using errcode = '22023';
    end if;
    if not exists (
      select 1 from nido.participants p
      where p.id = v_payer_id and p.space_id = v_space_id and p.is_active
    ) then
      raise exception 'payer not in space' using errcode = '22023';
    end if;
    if v_category_id is not null and not exists (
      select 1 from nido.categories c
      where c.id = v_category_id and c.space_id = v_space_id and c.archived_at is null
    ) then
      raise exception 'category not in space' using errcode = '22023';
    end if;
  end if;

  if v_account_id is not null and v_kind <> 'transfer' and not exists (
    select 1 from nido.accounts a
    where a.id = v_account_id and a.space_id = v_space_id and a.archived_at is null
  ) then
    raise exception 'account not in space' using errcode = '22023';
  end if;

  insert into nido.transactions (
    space_id, kind, booked_on, occurred_at, amount_minor, currency,
    base_amount_minor, base_rate, base_rate_manual, description, merchant, notes,
    category_id, account_id, to_account_id, payer_participant_id,
    split_mode, external_id, is_pending, created_by,
    recurring_rule_id, goal_id
  ) values (
    v_space_id,
    v_kind,
    v_booked_on,
    nullif(p ->> 'occurred_at', '')::timestamptz,
    v_amount_minor,
    v_currency,
    v_base_amount,
    v_base_rate,
    v_base_rate_manual,
    coalesce(left(trim(coalesce(p ->> 'description', '')), 200), ''),
    nullif(left(trim(coalesce(p ->> 'merchant', '')), 120), ''),
    nullif(left(trim(coalesce(p ->> 'notes', '')), 2000), ''),
    v_category_id,
    v_account_id,
    v_to_account_id,
    v_payer_id,
    case when v_kind = 'transfer' then 'personal'::nido.split_mode else v_split_mode end,
    nullif(p ->> 'external_id', ''),
    coalesce((p ->> 'is_pending')::boolean, false),
    v_uid,
    v_recurring_rule_id,
    v_goal_id
  )
  returning id, base_amount_minor, base_rate into v_tx_id, v_base_amount, v_base_rate;

  if v_kind <> 'transfer' then
    perform nido._insert_splits(
      v_tx_id,
      v_space_id,
      v_amount_minor,
      v_base_amount,
      v_base_rate,
      v_split_mode,
      coalesce(p -> 'participants', '[]'::jsonb)
    );
  end if;

  if p ? 'tag_ids' and jsonb_typeof(p -> 'tag_ids') = 'array' then
    select array_agg((x)::uuid)
      into v_tag_ids
    from jsonb_array_elements_text(p -> 'tag_ids') as x;
    perform nido._set_transaction_tags(v_tx_id, v_space_id, v_tag_ids);
  end if;

  if v_recurring_rule_id is not null then
    perform nido._apply_recurring_price_change(
      v_recurring_rule_id,
      v_amount_minor,
      case
        when v_price_source in ('manual', 'import', 'bank', 'generated') then v_price_source
        else 'generated'
      end
    );
  end if;

  v_cached := jsonb_build_object('id', v_tx_id);

  if v_request_id is not null then
    insert into nido.idempotency_keys (user_id, request_id, action, space_id, result)
    values (v_uid, v_request_id, 'create_transaction', v_space_id, v_cached)
    on conflict (user_id, request_id) do nothing;
  end if;

  return v_cached;
end;
$$;

-- Patch update_transaction to persist base_rate_manual.
create or replace function nido.update_transaction(p_id uuid, p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_tx nido.transactions;
  v_request_id uuid := nullif(p ->> 'request_id', '')::uuid;
  v_cached jsonb;
  v_kind nido.tx_kind;
  v_amount_minor bigint;
  v_currency nido.currency_code;
  v_split_mode nido.split_mode;
  v_base_rate_manual boolean;
  v_base_rate numeric(20, 10);
  v_base_amount bigint;
  v_tag_ids uuid[];
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  if v_request_id is not null then
    select result into v_cached
    from nido.idempotency_keys
    where user_id = v_uid and request_id = v_request_id;
    if found then
      return v_cached;
    end if;
  end if;

  select * into v_tx from nido.transactions where id = p_id for update;
  if not found or v_tx.deleted_at is not null then
    raise exception 'transaction not found' using errcode = 'P0002';
  end if;

  if not nido._can_mutate_transaction(v_tx) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  v_kind := coalesce((p ->> 'kind')::nido.tx_kind, v_tx.kind);
  v_amount_minor := coalesce((p ->> 'amount_minor')::bigint, v_tx.amount_minor);
  v_currency := coalesce((p ->> 'currency')::nido.currency_code, v_tx.currency);
  v_split_mode := coalesce((p ->> 'split_mode')::nido.split_mode, v_tx.split_mode);
  v_base_rate_manual := coalesce((p ->> 'base_rate_manual')::boolean, v_tx.base_rate_manual);
  v_base_rate := case
    when p ? 'base_rate' then (p ->> 'base_rate')::numeric
    when v_base_rate_manual then v_tx.base_rate
    else 1
  end;
  v_base_amount := round(v_amount_minor::numeric * v_base_rate)::bigint;

  if v_amount_minor <= 0 then
    raise exception 'amount_minor must be > 0' using errcode = '22023';
  end if;

  update nido.transactions set
    kind = v_kind,
    booked_on = coalesce((p ->> 'booked_on')::date, booked_on),
    occurred_at = case
      when p ? 'occurred_at' then nullif(p ->> 'occurred_at', '')::timestamptz
      else occurred_at
    end,
    amount_minor = v_amount_minor,
    currency = v_currency,
    base_amount_minor = v_base_amount,
    base_rate = v_base_rate,
    base_rate_manual = v_base_rate_manual,
    description = case
      when p ? 'description' then left(trim(coalesce(p ->> 'description', '')), 200)
      else description
    end,
    merchant = case
      when p ? 'merchant' then nullif(left(trim(coalesce(p ->> 'merchant', '')), 120), '')
      else merchant
    end,
    notes = case
      when p ? 'notes' then nullif(left(trim(coalesce(p ->> 'notes', '')), 2000), '')
      else notes
    end,
    category_id = case
      when v_kind = 'transfer' then null
      when p ? 'category_id' then nullif(p ->> 'category_id', '')::uuid
      else category_id
    end,
    account_id = case
      when p ? 'account_id' then nullif(p ->> 'account_id', '')::uuid
      else account_id
    end,
    to_account_id = case
      when v_kind <> 'transfer' then null
      when p ? 'to_account_id' then nullif(p ->> 'to_account_id', '')::uuid
      else to_account_id
    end,
    payer_participant_id = case
      when v_kind = 'transfer' then null
      when p ? 'payer_participant_id' then nullif(p ->> 'payer_participant_id', '')::uuid
      else payer_participant_id
    end,
    split_mode = case when v_kind = 'transfer' then 'personal'::nido.split_mode else v_split_mode end,
    is_pending = coalesce((p ->> 'is_pending')::boolean, is_pending)
  where id = p_id
  returning base_amount_minor, base_rate into v_base_amount, v_base_rate;

  delete from nido.transaction_splits where transaction_id = p_id;

  if v_kind <> 'transfer' then
    if not exists (
      select 1 from nido.transactions t
      where t.id = p_id and t.payer_participant_id is not null
    ) then
      raise exception 'non-transfer transactions require a payer' using errcode = '22023';
    end if;

    perform nido._insert_splits(
      p_id,
      v_tx.space_id,
      v_amount_minor,
      v_base_amount,
      v_base_rate,
      v_split_mode,
      coalesce(p -> 'participants', '[]'::jsonb)
    );
  end if;

  if p ? 'tag_ids' and jsonb_typeof(p -> 'tag_ids') = 'array' then
    select array_agg((x)::uuid)
      into v_tag_ids
    from jsonb_array_elements_text(p -> 'tag_ids') as x;
    perform nido._set_transaction_tags(p_id, v_tx.space_id, coalesce(v_tag_ids, array[]::uuid[]));
  end if;

  v_cached := jsonb_build_object('id', p_id);

  if v_request_id is not null then
    insert into nido.idempotency_keys (user_id, request_id, action, space_id, result)
    values (v_uid, v_request_id, 'update_transaction', v_tx.space_id, v_cached)
    on conflict (user_id, request_id) do nothing;
  end if;

  return v_cached;
end;
$$;

create or replace function nido.update_space_base_currency(
  p_space_id uuid,
  p_base_currency nido.currency_code
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not nido.is_member(p_space_id, array['owner', 'admin']::nido.member_role[]) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if not exists (select 1 from nido.currencies c where c.code = p_base_currency) then
    raise exception 'unknown currency %', p_base_currency using errcode = '22023';
  end if;

  update nido.spaces
  set base_currency = p_base_currency
  where id = p_space_id;

  perform nido.backfill_base_amounts(p_space_id);
end;
$$;

revoke all on function nido.update_space_base_currency(uuid, nido.currency_code) from public;
grant execute on function nido.update_space_base_currency(uuid, nido.currency_code)
  to authenticated, service_role;
