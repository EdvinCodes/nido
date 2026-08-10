-- Fix RAISE format placeholders: PostgreSQL uses `%`, not `%s` (which prints the value
-- then a literal "s", producing messages like "sum=800s").

create or replace function nido.tg_splits_balance()
returns trigger
language plpgsql
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
