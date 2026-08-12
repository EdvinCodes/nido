-- Harden update_transaction against mid-mutation balance checks.
-- Amount was updated before splits were rewritten; if constraints are forced IMMEDIATE
-- (or checked between statements), the row briefly fails the owed_minor == amount_minor
-- invariant. Suppress the check for the duration of the RPC, reorder mutations, then
-- re-validate explicitly before returning.

create or replace function nido.tg_splits_balance()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tx_id uuid;
  v_kind nido.tx_kind;
  v_amount bigint;
  v_sum bigint;
  v_deleted timestamptz;
begin
  if current_setting('nido.skip_balance_check', true) = '1' then
    return null;
  end if;

  v_tx_id := coalesce(new.transaction_id, old.transaction_id);

  select t.kind, t.amount_minor, t.deleted_at
    into v_kind, v_amount, v_deleted
  from nido.transactions t
  where t.id = v_tx_id;

  if not found then
    return null;
  end if;

  if v_deleted is not null then
    return null;
  end if;

  select coalesce(sum(s.owed_minor), 0)
    into v_sum
  from nido.transaction_splits s
  where s.transaction_id = v_tx_id;

  if v_kind = 'transfer' then
    if v_sum <> 0 then
      raise exception
        'transfer % must have no splits (sum=%)',
        v_tx_id, v_sum
        using errcode = 'P0001';
    end if;
  elsif v_sum <> v_amount then
    raise exception
      'split imbalance for transaction %: sum(owed_minor)=% amount_minor=%',
      v_tx_id, v_sum, v_amount
      using errcode = 'P0001';
  end if;

  return null;
end;
$$;

create or replace function nido.tg_transactions_balance()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sum bigint;
begin
  if current_setting('nido.skip_balance_check', true) = '1' then
    return null;
  end if;

  if new.deleted_at is not null then
    return null;
  end if;

  select coalesce(sum(s.owed_minor), 0)
    into v_sum
  from nido.transaction_splits s
  where s.transaction_id = new.id;

  if new.kind = 'transfer' then
    if v_sum <> 0 then
      raise exception
        'transfer % must have no splits (sum=%)',
        new.id, v_sum
        using errcode = 'P0001';
    end if;
  elsif v_sum <> new.amount_minor then
    raise exception
      'split imbalance for transaction %: sum(owed_minor)=% amount_minor=%',
      new.id, v_sum, new.amount_minor
      using errcode = 'P0001';
  end if;

  return null;
end;
$$;

create or replace function nido._assert_transaction_balanced(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_kind nido.tx_kind;
  v_amount bigint;
  v_deleted timestamptz;
  v_sum bigint;
begin
  select t.kind, t.amount_minor, t.deleted_at
    into v_kind, v_amount, v_deleted
  from nido.transactions t
  where t.id = p_id;

  if not found then
    raise exception 'transaction not found' using errcode = 'P0002';
  end if;

  if v_deleted is not null then
    return;
  end if;

  select coalesce(sum(s.owed_minor), 0)
    into v_sum
  from nido.transaction_splits s
  where s.transaction_id = p_id;

  if v_kind = 'transfer' then
    if v_sum <> 0 then
      raise exception
        'transfer % must have no splits (sum=%)',
        p_id, v_sum
        using errcode = 'P0001';
    end if;
  elsif v_sum <> v_amount then
    raise exception
      'split imbalance for transaction %: sum(owed_minor)=% amount_minor=%',
      p_id, v_sum, v_amount
      using errcode = 'P0001';
  end if;
end;
$$;

revoke all on function nido._assert_transaction_balanced(uuid) from public;

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

  -- Hold the invariant check while amount and splits are rewritten together.
  perform set_config('nido.skip_balance_check', '1', true);

  delete from nido.transaction_splits where transaction_id = p_id;

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

  perform set_config('nido.skip_balance_check', '', true);
  perform nido._assert_transaction_balanced(p_id);

  v_cached := jsonb_build_object('id', p_id);

  if v_request_id is not null then
    insert into nido.idempotency_keys (user_id, request_id, action, space_id, result)
    values (v_uid, v_request_id, 'update_transaction', v_tx.space_id, v_cached)
    on conflict (user_id, request_id) do nothing;
  end if;

  return v_cached;
exception
  when others then
    perform set_config('nido.skip_balance_check', '', true);
    raise;
end;
$$;
