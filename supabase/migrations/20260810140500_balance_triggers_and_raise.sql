-- Balance triggers must read all rows regardless of RLS (invariant enforcement).
-- Also fix _insert_splits RAISE placeholders (% not %s).

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
        'exact splits must sum to amount_minor (sum=% amount=%)',
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
