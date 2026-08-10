-- Phase 02 — create/update/delete/restore transaction RPCs + account_balance + idempotency.

create table nido.idempotency_keys (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references nido.profiles (id) on delete cascade,
  request_id   uuid not null,
  action       text not null,
  space_id     uuid references nido.spaces (id) on delete cascade,
  result       jsonb not null,
  created_at   timestamptz not null default now(),
  unique (user_id, request_id)
);

comment on table nido.idempotency_keys is
  'Client request ids for mutating Server Actions / RPCs. Duplicate keys return the stored result.';

create index idempotency_keys_created_idx on nido.idempotency_keys (created_at);

alter table nido.idempotency_keys enable row level security;

-- No direct client access; RPCs (security definer) read/write this table.
grant select, insert, update, delete on nido.idempotency_keys to service_role;

-- ---------------------------------------------------------------------------------------
-- Helpers used by the RPCs
-- ---------------------------------------------------------------------------------------

create or replace function nido._assert_contributor(p_space_id uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if not nido.is_member(p_space_id, array['owner', 'admin', 'member']::nido.member_role[]) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return v_uid;
end;
$$;

create or replace function nido._can_mutate_transaction(p_tx nido.transactions)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    nido.is_member(p_tx.space_id, array['owner', 'admin']::nido.member_role[])
    or (
      nido.is_member(p_tx.space_id, array['member']::nido.member_role[])
      and p_tx.created_by = (select auth.uid())
    );
$$;

create or replace function nido._insert_splits(
  p_tx_id uuid,
  p_space_id uuid,
  p_amount_minor bigint,
  p_base_amount_minor bigint,
  p_base_rate numeric,
  p_split_mode nido.split_mode,
  p_participants jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count int;
  v_elem jsonb;
  v_ids uuid[];
  v_weights numeric[];
  v_owed bigint[];
  v_i int;
  v_sum_percent numeric;
  v_sum_exact bigint;
  v_participant_id uuid;
  v_weight numeric;
  v_owed_minor bigint;
  v_base_owed bigint;
begin
  if p_participants is null or jsonb_typeof(p_participants) <> 'array' then
    raise exception 'participants must be a json array' using errcode = '22023';
  end if;

  v_count := jsonb_array_length(p_participants);
  if v_count < 1 then
    raise exception 'at least one participant is required' using errcode = '22023';
  end if;

  if p_split_mode = 'personal' and v_count <> 1 then
    raise exception 'personal split requires exactly one participant' using errcode = '22023';
  end if;

  if p_split_mode = 'exact' then
    v_sum_exact := 0;
    for v_elem in select * from jsonb_array_elements(p_participants)
    loop
      v_participant_id := (v_elem ->> 'participant_id')::uuid;
      v_owed_minor := (v_elem ->> 'owed_minor')::bigint;
      if v_participant_id is null or v_owed_minor is null then
        raise exception 'exact splits require participant_id and owed_minor' using errcode = '22023';
      end if;
      if v_owed_minor < 0 then
        raise exception 'owed_minor must be >= 0' using errcode = '22023';
      end if;
      if not exists (
        select 1 from nido.participants p
        where p.id = v_participant_id and p.space_id = p_space_id and p.is_active
      ) then
        raise exception 'participant % not in space', v_participant_id using errcode = '22023';
      end if;
      v_sum_exact := v_sum_exact + v_owed_minor;
      v_base_owed := round(v_owed_minor::numeric * p_base_rate)::bigint;
      insert into nido.transaction_splits (
        transaction_id, space_id, participant_id, weight, owed_minor, base_owed_minor
      ) values (
        p_tx_id, p_space_id, v_participant_id, coalesce((v_elem ->> 'weight')::numeric, 0),
        v_owed_minor, v_base_owed
      );
    end loop;
    if v_sum_exact <> p_amount_minor then
      raise exception
        'exact splits must sum to amount_minor (sum=%s amount=%s)',
        v_sum_exact, p_amount_minor
        using errcode = 'P0001';
    end if;
    return;
  end if;

  v_ids := array[]::uuid[];
  v_weights := array[]::numeric[];

  for v_elem in select * from jsonb_array_elements(p_participants)
  loop
    v_participant_id := (v_elem ->> 'participant_id')::uuid;
    if v_participant_id is null then
      raise exception 'participant_id is required' using errcode = '22023';
    end if;
    if not exists (
      select 1 from nido.participants p
      where p.id = v_participant_id and p.space_id = p_space_id and p.is_active
    ) then
      raise exception 'participant % not in space', v_participant_id using errcode = '22023';
    end if;

    if p_split_mode = 'equal' then
      v_weight := 1;
    elsif p_split_mode = 'personal' then
      v_weight := 1;
    elsif p_split_mode = 'shares' then
      v_weight := coalesce((v_elem ->> 'weight')::numeric, 0);
    elsif p_split_mode = 'percent' then
      v_weight := coalesce((v_elem ->> 'weight')::numeric, 0);
    else
      raise exception 'unsupported split mode %', p_split_mode using errcode = '22023';
    end if;

    if v_weight < 0 then
      raise exception 'weight must be >= 0' using errcode = '22023';
    end if;

    v_ids := array_append(v_ids, v_participant_id);
    v_weights := array_append(v_weights, v_weight);
  end loop;

  if p_split_mode = 'percent' then
    v_sum_percent := 0;
    foreach v_weight in array v_weights loop
      v_sum_percent := v_sum_percent + v_weight;
    end loop;
    if v_sum_percent <> 100 then
      raise exception 'percent weights must total 100 (got %)', v_sum_percent
        using errcode = 'P0001';
    end if;
  end if;

  -- Order participants by position so allocate ties match TS (stable key).
  select array_agg(x.pid order by x.pos, x.pid), array_agg(x.w order by x.pos, x.pid)
    into v_ids, v_weights
  from (
    select
      u.pid,
      u.w,
      coalesce(p.position, 32767) as pos
    from unnest(v_ids, v_weights) as u(pid, w)
    left join nido.participants p on p.id = u.pid
  ) x;

  v_owed := nido.allocate(p_amount_minor, v_weights);

  for v_i in 1..array_length(v_ids, 1) loop
    v_base_owed := round(v_owed[v_i]::numeric * p_base_rate)::bigint;
    insert into nido.transaction_splits (
      transaction_id, space_id, participant_id, weight, owed_minor, base_owed_minor
    ) values (
      p_tx_id, p_space_id, v_ids[v_i], v_weights[v_i], v_owed[v_i], v_base_owed
    );
  end loop;
end;
$$;

create or replace function nido._set_transaction_tags(
  p_tx_id uuid,
  p_space_id uuid,
  p_tag_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tag_id uuid;
begin
  delete from nido.transaction_tags where transaction_id = p_tx_id;

  if p_tag_ids is null then
    return;
  end if;

  foreach v_tag_id in array p_tag_ids loop
    if not exists (
      select 1 from nido.tags t where t.id = v_tag_id and t.space_id = p_space_id
    ) then
      raise exception 'tag % not in space', v_tag_id using errcode = '22023';
    end if;
    insert into nido.transaction_tags (transaction_id, tag_id, space_id)
    values (p_tx_id, v_tag_id, p_space_id);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------------------
-- create_transaction
-- ---------------------------------------------------------------------------------------

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
  v_base_rate numeric(20, 10) := coalesce((p ->> 'base_rate')::numeric, 1);
  v_base_amount bigint;
  v_tx_id uuid;
  v_cached jsonb;
  v_tag_ids uuid[];
  v_account_id uuid := nullif(p ->> 'account_id', '')::uuid;
  v_to_account_id uuid := nullif(p ->> 'to_account_id', '')::uuid;
  v_category_id uuid := nullif(p ->> 'category_id', '')::uuid;
  v_payer_id uuid := nullif(p ->> 'payer_participant_id', '')::uuid;
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
    base_amount_minor, base_rate, description, merchant, notes,
    category_id, account_id, to_account_id, payer_participant_id,
    split_mode, external_id, is_pending, created_by
  ) values (
    v_space_id,
    v_kind,
    v_booked_on,
    nullif(p ->> 'occurred_at', '')::timestamptz,
    v_amount_minor,
    v_currency,
    v_base_amount,
    v_base_rate,
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
    v_uid
  )
  returning id into v_tx_id;

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

  v_cached := jsonb_build_object('id', v_tx_id);

  if v_request_id is not null then
    insert into nido.idempotency_keys (user_id, request_id, action, space_id, result)
    values (v_uid, v_request_id, 'create_transaction', v_space_id, v_cached)
    on conflict (user_id, request_id) do nothing;
  end if;

  return v_cached;
end;
$$;

comment on function nido.create_transaction(jsonb) is
  'Atomically inserts a transaction and server-computed splits. Client sends intent, not cents.';

revoke all on function nido.create_transaction(jsonb) from public;
grant execute on function nido.create_transaction(jsonb) to authenticated, service_role;

-- ---------------------------------------------------------------------------------------
-- update_transaction
-- ---------------------------------------------------------------------------------------

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
  v_base_rate := coalesce((p ->> 'base_rate')::numeric, v_tx.base_rate);
  v_base_amount := round(v_amount_minor::numeric * v_base_rate)::bigint;

  if v_amount_minor <= 0 then
    raise exception 'amount_minor must be > 0' using errcode = '22023';
  end if;

  if v_kind = 'transfer' then
    if coalesce(nullif(p ->> 'category_id', '')::uuid, v_tx.category_id) is not null
       and (p ? 'category_id') then
      -- allow clearing via null
      null;
    end if;
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
  where id = p_id;

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

revoke all on function nido.update_transaction(uuid, jsonb) from public;
grant execute on function nido.update_transaction(uuid, jsonb) to authenticated, service_role;

-- ---------------------------------------------------------------------------------------
-- soft delete + restore
-- ---------------------------------------------------------------------------------------

create or replace function nido.delete_transaction(p_id uuid, p_request_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_tx nido.transactions;
  v_cached jsonb;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  if p_request_id is not null then
    select result into v_cached
    from nido.idempotency_keys
    where user_id = v_uid and request_id = p_request_id;
    if found then
      return v_cached;
    end if;
  end if;

  select * into v_tx from nido.transactions where id = p_id for update;
  if not found then
    raise exception 'transaction not found' using errcode = 'P0002';
  end if;
  if not nido._can_mutate_transaction(v_tx) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if v_tx.deleted_at is null then
    update nido.transactions set deleted_at = now() where id = p_id;
  end if;

  v_cached := jsonb_build_object('id', p_id, 'deleted', true);

  if p_request_id is not null then
    insert into nido.idempotency_keys (user_id, request_id, action, space_id, result)
    values (v_uid, p_request_id, 'delete_transaction', v_tx.space_id, v_cached)
    on conflict (user_id, request_id) do nothing;
  end if;

  return v_cached;
end;
$$;

revoke all on function nido.delete_transaction(uuid, uuid) from public;
grant execute on function nido.delete_transaction(uuid, uuid) to authenticated, service_role;

create or replace function nido.restore_transaction(p_id uuid, p_request_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_tx nido.transactions;
  v_cached jsonb;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  if p_request_id is not null then
    select result into v_cached
    from nido.idempotency_keys
    where user_id = v_uid and request_id = p_request_id;
    if found then
      return v_cached;
    end if;
  end if;

  select * into v_tx from nido.transactions where id = p_id for update;
  if not found then
    raise exception 'transaction not found' using errcode = 'P0002';
  end if;
  if not nido._can_mutate_transaction(v_tx) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if v_tx.deleted_at is not null then
    update nido.transactions set deleted_at = null where id = p_id;
  end if;

  v_cached := jsonb_build_object('id', p_id, 'restored', true);

  if p_request_id is not null then
    insert into nido.idempotency_keys (user_id, request_id, action, space_id, result)
    values (v_uid, p_request_id, 'restore_transaction', v_tx.space_id, v_cached)
    on conflict (user_id, request_id) do nothing;
  end if;

  return v_cached;
end;
$$;

revoke all on function nido.restore_transaction(uuid, uuid) from public;
grant execute on function nido.restore_transaction(uuid, uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------------------
-- account_balance
-- ---------------------------------------------------------------------------------------

create or replace function nido.account_balance(p_account_id uuid)
returns bigint
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_space_id uuid;
  v_opening bigint;
  v_delta bigint;
begin
  select a.space_id, a.opening_balance_minor
    into v_space_id, v_opening
  from nido.accounts a
  where a.id = p_account_id;

  if not found then
    raise exception 'account not found' using errcode = 'P0002';
  end if;

  if not nido.is_member(v_space_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select coalesce(sum(
    case
      when t.kind = 'income' and t.account_id = p_account_id then t.amount_minor
      when t.kind = 'expense' and t.account_id = p_account_id then -t.amount_minor
      when t.kind = 'transfer' and t.account_id = p_account_id then -t.amount_minor
      when t.kind = 'transfer' and t.to_account_id = p_account_id then t.amount_minor
      else 0
    end
  ), 0)
    into v_delta
  from nido.transactions t
  where t.deleted_at is null
    and t.space_id = v_space_id
    and (t.account_id = p_account_id or t.to_account_id = p_account_id);

  return v_opening + v_delta;
end;
$$;

comment on function nido.account_balance(uuid) is
  'Opening balance plus signed non-deleted transactions touching the account.';

revoke all on function nido.account_balance(uuid) from public;
grant execute on function nido.account_balance(uuid) to authenticated, service_role;
