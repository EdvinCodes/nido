-- Phase 06 — settlements, participant balances view, breakdown + pairwise RPCs.

-- ---------------------------------------------------------------------------------------
-- Settlements
-- ---------------------------------------------------------------------------------------

create table nido.settlements (
  id                  uuid primary key default gen_random_uuid(),
  space_id            uuid not null references nido.spaces (id) on delete cascade,
  from_participant_id uuid not null references nido.participants (id),
  to_participant_id   uuid not null references nido.participants (id),
  amount_minor        bigint not null check (amount_minor > 0),
  currency            nido.currency_code not null,
  base_amount_minor   bigint not null check (base_amount_minor > 0),
  method              text check (method is null or method in ('cash', 'transfer', 'bizum', 'other')),
  note                text check (note is null or char_length(note) <= 2000),
  settled_on          date not null default (current_date),
  confirmed_at        timestamptz,
  confirmed_by        uuid references nido.profiles (id),
  disputed_at         timestamptz,
  dispute_note        text check (dispute_note is null or char_length(dispute_note) <= 2000),
  reversed_at         timestamptz,
  reverse_of_id       uuid references nido.settlements (id) on delete restrict,
  created_by          uuid not null references nido.profiles (id),
  created_at          timestamptz not null default now(),
  constraint settlements_distinct_parties check (from_participant_id <> to_participant_id),
  constraint settlements_dispute_note check (
    disputed_at is null or (dispute_note is not null and char_length(trim(dispute_note)) >= 1)
  )
);

create index settlements_space_created_idx
  on nido.settlements (space_id, created_at desc);

create index settlements_space_confirmed_idx
  on nido.settlements (space_id)
  where confirmed_at is not null and reversed_at is null;

create trigger settlements_audit
  after insert or update or delete on nido.settlements
  for each row execute function nido.tg_audit('settlements');

alter table nido.settlements enable row level security;

create or replace function nido._settlement_involves_user(p nido.settlements, p_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  select exists (
    select 1 from nido.participants part
    where part.space_id = p.space_id
      and part.user_id = p_uid
      and part.id in (p.from_participant_id, p.to_participant_id)
  );
$$;

create or replace function nido._settlement_counterparty_user(p nido.settlements)
returns uuid
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  select part.user_id
  from nido.participants part
  where part.id = case
    when exists (
      select 1 from nido.participants me
      where me.id = p.from_participant_id and me.user_id = p.created_by
    ) then p.to_participant_id
    else p.from_participant_id
  end;
$$;

create policy "settlements_select_members"
  on nido.settlements for select
  using (nido.is_member(space_id));

create policy "settlements_insert_editors"
  on nido.settlements for insert
  with check (
    nido.is_member(space_id, array['owner', 'admin', 'member']::nido.member_role[])
    and created_by = (select auth.uid())
    and nido._settlement_involves_user(settlements, (select auth.uid()))
  );

-- Updates: confirm / dispute / reverse metadata — never rewrite money on a confirmed row
-- except via dedicated RPCs. Direct updates allowed for proposer cancel of unconfirmed,
-- counterparty confirm/dispute, or admin.
create policy "settlements_update_involved"
  on nido.settlements for update
  using (
    nido.is_member(space_id, array['owner', 'admin']::nido.member_role[])
    or nido._settlement_involves_user(settlements, (select auth.uid()))
  )
  with check (
    nido.is_member(space_id, array['owner', 'admin']::nido.member_role[])
    or nido._settlement_involves_user(settlements, (select auth.uid()))
  );

create policy "settlements_delete_proposed_own"
  on nido.settlements for delete
  using (
    confirmed_at is null
    and created_by = (select auth.uid())
    and nido.is_member(space_id, array['owner', 'admin', 'member']::nido.member_role[])
  );

grant select, insert, update, delete on nido.settlements to authenticated, service_role;

-- ---------------------------------------------------------------------------------------
-- Notification prefs
-- ---------------------------------------------------------------------------------------

create or replace function nido.ensure_default_notification_prefs(p_space_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
begin
  insert into nido.notification_preferences (user_id, space_id, kind, in_app, push, email)
  values
    (p_user_id, p_space_id, 'budget_threshold', true, false, false),
    (p_user_id, p_space_id, 'budget_exceeded', true, false, false),
    (p_user_id, p_space_id, 'goal_reached', true, false, false),
    (p_user_id, p_space_id, 'recurring_due', true, false, false),
    (p_user_id, p_space_id, 'recurring_price_change', true, false, false),
    (p_user_id, p_space_id, 'settlement_request', true, false, false),
    (p_user_id, p_space_id, 'settlement_confirmed', true, false, false)
  on conflict do nothing;
end;
$$;

-- ---------------------------------------------------------------------------------------
-- Balances view (paid, owed, net)
-- ---------------------------------------------------------------------------------------

create or replace view nido.v_participant_balances
with (security_invoker = true)
as
with paid as (
  select
    t.space_id,
    t.payer_participant_id as participant_id,
    sum(
      case
        when t.kind = 'expense' then t.base_amount_minor
        when t.kind = 'income' then -t.base_amount_minor
        else 0
      end
    )::bigint as paid_minor
  from nido.transactions t
  where t.deleted_at is null
    and t.kind <> 'transfer'
    and t.payer_participant_id is not null
  group by 1, 2
),
owed as (
  select
    s.space_id,
    s.participant_id,
    sum(
      case
        when t.kind = 'expense' then s.base_owed_minor
        when t.kind = 'income' then -s.base_owed_minor
        else 0
      end
    )::bigint as owed_minor
  from nido.transaction_splits s
  join nido.transactions t on t.id = s.transaction_id
  where t.deleted_at is null
    and t.kind <> 'transfer'
  group by 1, 2
),
settled_raw as (
  -- Confirmed settlements always count, including reversed originals and their
  -- compensating rows — the pair cancels and restores prior positions.
  select
    s.space_id,
    s.from_participant_id as participant_id,
    sum(s.base_amount_minor)::bigint as delta
  from nido.settlements s
  where s.confirmed_at is not null
  group by 1, 2
  union all
  select
    s.space_id,
    s.to_participant_id as participant_id,
    -sum(s.base_amount_minor)::bigint as delta
  from nido.settlements s
  where s.confirmed_at is not null
  group by 1, 2
),
settled as (
  select space_id, participant_id, sum(delta)::bigint as delta
  from settled_raw
  group by 1, 2
)
select
  p.space_id,
  p.id as participant_id,
  coalesce(pd.paid_minor, 0)::bigint as paid_minor,
  coalesce(ow.owed_minor, 0)::bigint as owed_minor,
  (
    coalesce(pd.paid_minor, 0)
    - coalesce(ow.owed_minor, 0)
    + coalesce(st.delta, 0)
  )::bigint as net_minor
from nido.participants p
left join paid pd
  on pd.space_id = p.space_id and pd.participant_id = p.id
left join owed ow
  on ow.space_id = p.space_id and ow.participant_id = p.id
left join settled st
  on st.space_id = p.space_id and st.participant_id = p.id
where p.is_active;

grant select on nido.v_participant_balances to authenticated, service_role;

-- ---------------------------------------------------------------------------------------
-- balance_breakdown
-- ---------------------------------------------------------------------------------------

create or replace function nido.balance_breakdown(
  p_space_id uuid,
  p_participant_id uuid,
  p_from date default null,
  p_to date default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $$
declare
  v_rows jsonb;
begin
  if auth.role() is distinct from 'service_role' and not nido.is_member(p_space_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if not exists (
    select 1 from nido.participants p
    where p.id = p_participant_id and p.space_id = p_space_id
  ) then
    raise exception 'participant not in space' using errcode = '22023';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'transaction_id', x.transaction_id,
        'booked_on', x.booked_on,
        'kind', x.kind,
        'description', x.description,
        'merchant', x.merchant,
        'amount_minor', x.amount_minor,
        'currency', x.currency,
        'paid_minor', x.paid_minor,
        'owed_minor', x.owed_minor,
        'delta_minor', x.paid_minor - x.owed_minor
      )
      order by x.booked_on desc, x.transaction_id
    ),
    '[]'::jsonb
  )
  into v_rows
  from (
    select
      t.id as transaction_id,
      t.booked_on,
      t.kind,
      t.description,
      t.merchant,
      t.amount_minor,
      t.currency,
      case
        when t.payer_participant_id = p_participant_id then
          case
            when t.kind = 'expense' then t.base_amount_minor
            when t.kind = 'income' then -t.base_amount_minor
            else 0
          end
        else 0
      end::bigint as paid_minor,
      coalesce(
        (
          select
            case
              when t.kind = 'expense' then s.base_owed_minor
              when t.kind = 'income' then -s.base_owed_minor
              else 0
            end
          from nido.transaction_splits s
          where s.transaction_id = t.id
            and s.participant_id = p_participant_id
        ),
        0
      )::bigint as owed_minor
    from nido.transactions t
    where t.space_id = p_space_id
      and t.deleted_at is null
      and t.kind <> 'transfer'
      and (p_from is null or t.booked_on >= p_from)
      and (p_to is null or t.booked_on <= p_to)
      and (
        t.payer_participant_id = p_participant_id
        or exists (
          select 1 from nido.transaction_splits s
          where s.transaction_id = t.id and s.participant_id = p_participant_id
        )
      )
  ) x
  where x.paid_minor <> 0 or x.owed_minor <> 0;

  return jsonb_build_object(
    'participant_id', p_participant_id,
    'from', p_from,
    'to', p_to,
    'transactions', v_rows
  );
end;
$$;

revoke all on function nido.balance_breakdown(uuid, uuid, date, date) from public;
grant execute on function nido.balance_breakdown(uuid, uuid, date, date) to authenticated, service_role;

-- ---------------------------------------------------------------------------------------
-- pairwise_balances
-- ---------------------------------------------------------------------------------------

create or replace function nido.pairwise_balances(p_space_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $$
begin
  if auth.role() is distinct from 'service_role' and not nido.is_member(p_space_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return coalesce(
    (
      with edges as (
        -- Expense: split participant owes the payer.
        select
          t.space_id,
          s.participant_id as from_id,
          t.payer_participant_id as to_id,
          s.base_owed_minor as amount_minor
        from nido.transactions t
        join nido.transaction_splits s on s.transaction_id = t.id
        where t.space_id = p_space_id
          and t.deleted_at is null
          and t.kind = 'expense'
          and t.payer_participant_id is not null
          and s.participant_id <> t.payer_participant_id
          and s.base_owed_minor > 0
        union all
        -- Income: payer owes split participants their share (money received for the group).
        select
          t.space_id,
          t.payer_participant_id as from_id,
          s.participant_id as to_id,
          s.base_owed_minor as amount_minor
        from nido.transactions t
        join nido.transaction_splits s on s.transaction_id = t.id
        where t.space_id = p_space_id
          and t.deleted_at is null
          and t.kind = 'income'
          and t.payer_participant_id is not null
          and s.participant_id <> t.payer_participant_id
          and s.base_owed_minor > 0
        union all
        -- Confirmed settlements: from paid to (reduces from→to debt).
        select
          s.space_id,
          s.to_participant_id as from_id,
          s.from_participant_id as to_id,
          s.base_amount_minor as amount_minor
        from nido.settlements s
        where s.space_id = p_space_id
          and s.confirmed_at is not null
      ),
      directed as (
        select
          least(from_id, to_id) as a_id,
          greatest(from_id, to_id) as b_id,
          sum(
            case
              when from_id < to_id then amount_minor
              else -amount_minor
            end
          )::bigint as a_owes_b
        from edges
        group by 1, 2
      )
      select jsonb_agg(
        jsonb_build_object(
          'from_participant_id', case when a_owes_b > 0 then a_id else b_id end,
          'to_participant_id', case when a_owes_b > 0 then b_id else a_id end,
          'amount_minor', abs(a_owes_b)
        )
        order by abs(a_owes_b) desc, a_id, b_id
      )
      from directed
      where a_owes_b <> 0
    ),
    '[]'::jsonb
  );
end;
$$;

revoke all on function nido.pairwise_balances(uuid) from public;
grant execute on function nido.pairwise_balances(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------------------
-- Propose / confirm / dispute / reverse
-- ---------------------------------------------------------------------------------------

create or replace function nido.propose_settlement(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  v_uid uuid := (select auth.uid());
  v_space_id uuid := (p ->> 'space_id')::uuid;
  v_from uuid := (p ->> 'from_participant_id')::uuid;
  v_to uuid := (p ->> 'to_participant_id')::uuid;
  v_amount bigint := (p ->> 'amount_minor')::bigint;
  v_currency nido.currency_code := (p ->> 'currency')::nido.currency_code;
  v_method text := nullif(p ->> 'method', '');
  v_note text := nullif(trim(coalesce(p ->> 'note', '')), '');
  v_settled_on date := coalesce((p ->> 'settled_on')::date, current_date);
  v_base bigint;
  v_id uuid;
  v_counterparty uuid;
  v_counterparty_is_ghost boolean;
  v_confirmed_at timestamptz := null;
  v_confirmed_by uuid := null;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if not nido.is_member(v_space_id, array['owner', 'admin', 'member']::nido.member_role[]) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v_from is null or v_to is null or v_from = v_to then
    raise exception 'invalid participants' using errcode = '22023';
  end if;
  if v_amount is null or v_amount <= 0 then
    raise exception 'amount_minor must be > 0' using errcode = '22023';
  end if;
  if v_method is not null and v_method not in ('cash', 'transfer', 'bizum', 'other') then
    raise exception 'invalid method' using errcode = '22023';
  end if;

  if not exists (
    select 1 from nido.participants p1
    where p1.id = v_from and p1.space_id = v_space_id and p1.is_active
  ) or not exists (
    select 1 from nido.participants p2
    where p2.id = v_to and p2.space_id = v_space_id and p2.is_active
  ) then
    raise exception 'participants must belong to the space' using errcode = '22023';
  end if;

  if not exists (
    select 1 from nido.participants me
    where me.space_id = v_space_id
      and me.user_id = v_uid
      and me.id in (v_from, v_to)
  ) and not nido.is_member(v_space_id, array['owner', 'admin']::nido.member_role[]) then
    raise exception 'must involve yourself' using errcode = '42501';
  end if;

  if v_currency is null then
    select base_currency into v_currency from nido.spaces where id = v_space_id;
  end if;
  v_base := v_amount; -- settlements in base currency for v1

  select p.user_id is null, p.user_id
    into v_counterparty_is_ghost, v_counterparty
  from nido.participants p
  where p.id = case
    when exists (
      select 1 from nido.participants me
      where me.id = v_from and me.user_id = v_uid
    ) then v_to
    else v_from
  end;

  if v_counterparty_is_ghost then
    v_confirmed_at := now();
    v_confirmed_by := v_uid;
  end if;

  insert into nido.settlements (
    space_id, from_participant_id, to_participant_id,
    amount_minor, currency, base_amount_minor, method, note, settled_on,
    confirmed_at, confirmed_by, created_by
  ) values (
    v_space_id, v_from, v_to,
    v_amount, v_currency, v_base, v_method, v_note, v_settled_on,
    v_confirmed_at, v_confirmed_by, v_uid
  )
  returning id into v_id;

  if v_confirmed_at is null and v_counterparty is not null then
    perform nido.ensure_default_notification_prefs(v_space_id, v_counterparty);
    if exists (
      select 1 from nido.notification_preferences pref
      where pref.user_id = v_counterparty
        and pref.space_id = v_space_id
        and pref.kind = 'settlement_request'
        and pref.in_app
    ) then
      insert into nido.notifications (space_id, user_id, kind, title, body, payload, link)
      values (
        v_space_id,
        v_counterparty,
        'settlement_request',
        'Settlement to confirm',
        format('A settlement of %s is waiting for your confirmation.', v_amount),
        jsonb_build_object('settlement_id', v_id, 'amount_minor', v_amount),
        '/s/' || v_space_id::text || '/balances'
      );
    end if;
  end if;

  return jsonb_build_object(
    'id', v_id,
    'confirmed', v_confirmed_at is not null
  );
end;
$$;

create or replace function nido.confirm_settlement(
  p_id uuid,
  p_amount_minor bigint default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  v_uid uuid := (select auth.uid());
  v_s nido.settlements%rowtype;
  v_amount bigint;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  select * into v_s from nido.settlements where id = p_id for update;
  if not found then
    raise exception 'settlement not found' using errcode = 'P0002';
  end if;
  if v_s.confirmed_at is not null then
    return jsonb_build_object('id', v_s.id, 'confirmed', true);
  end if;
  if v_s.disputed_at is not null then
    raise exception 'settlement was disputed' using errcode = 'P0001';
  end if;

  -- Counterparty (or admin) confirms.
  if not nido.is_member(v_s.space_id, array['owner', 'admin']::nido.member_role[]) then
    if not nido._settlement_involves_user(v_s, v_uid) then
      raise exception 'forbidden' using errcode = '42501';
    end if;
    if v_s.created_by = v_uid then
      raise exception 'proposer cannot confirm' using errcode = '42501';
    end if;
  end if;

  v_amount := coalesce(p_amount_minor, v_s.amount_minor);
  if v_amount is null or v_amount <= 0 then
    raise exception 'amount_minor must be > 0' using errcode = '22023';
  end if;
  if v_amount > v_s.amount_minor then
    raise exception 'cannot increase settlement amount' using errcode = '22023';
  end if;

  update nido.settlements
  set amount_minor = v_amount,
      base_amount_minor = v_amount,
      confirmed_at = now(),
      confirmed_by = v_uid,
      disputed_at = null,
      dispute_note = null
  where id = p_id;

  -- Notify proposer.
  if v_s.created_by is distinct from v_uid then
    perform nido.ensure_default_notification_prefs(v_s.space_id, v_s.created_by);
    if exists (
      select 1 from nido.notification_preferences pref
      where pref.user_id = v_s.created_by
        and pref.space_id = v_s.space_id
        and pref.kind = 'settlement_confirmed'
        and pref.in_app
    ) then
      insert into nido.notifications (space_id, user_id, kind, title, body, payload, link)
      values (
        v_s.space_id,
        v_s.created_by,
        'settlement_confirmed',
        'Settlement confirmed',
        format('Settlement of %s was confirmed.', v_s.amount_minor),
        jsonb_build_object('settlement_id', v_s.id, 'amount_minor', v_s.amount_minor),
        '/s/' || v_s.space_id::text || '/balances'
      );
    end if;
  end if;

  return jsonb_build_object('id', p_id, 'confirmed', true);
end;
$$;

create or replace function nido.dispute_settlement(p_id uuid, p_note text)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  v_uid uuid := (select auth.uid());
  v_s nido.settlements%rowtype;
  v_note text := trim(coalesce(p_note, ''));
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if char_length(v_note) < 1 then
    raise exception 'dispute note required' using errcode = '22023';
  end if;

  select * into v_s from nido.settlements where id = p_id for update;
  if not found then
    raise exception 'settlement not found' using errcode = 'P0002';
  end if;
  if v_s.confirmed_at is not null then
    raise exception 'cannot dispute confirmed settlement' using errcode = 'P0001';
  end if;
  if v_s.created_by = v_uid then
    raise exception 'proposer cannot dispute' using errcode = '42501';
  end if;
  if not nido._settlement_involves_user(v_s, v_uid)
     and not nido.is_member(v_s.space_id, array['owner', 'admin']::nido.member_role[])
  then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  update nido.settlements
  set disputed_at = now(),
      dispute_note = left(v_note, 2000)
  where id = p_id;

  perform nido.ensure_default_notification_prefs(v_s.space_id, v_s.created_by);
  insert into nido.notifications (space_id, user_id, kind, title, body, payload, link)
  values (
    v_s.space_id,
    v_s.created_by,
    'settlement_request',
    'Settlement disputed',
    left(v_note, 200),
    jsonb_build_object('settlement_id', v_s.id, 'disputed', true),
    '/s/' || v_s.space_id::text || '/balances'
  );

  return jsonb_build_object('id', p_id, 'disputed', true);
end;
$$;

create or replace function nido.reverse_settlement(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  v_uid uuid := (select auth.uid());
  v_s nido.settlements%rowtype;
  v_new uuid;
  v_recipient uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  select * into v_s from nido.settlements where id = p_id for update;
  if not found then
    raise exception 'settlement not found' using errcode = 'P0002';
  end if;
  if v_s.confirmed_at is null then
    raise exception 'only confirmed settlements can be reversed' using errcode = 'P0001';
  end if;
  if v_s.reversed_at is not null then
    raise exception 'already reversed' using errcode = 'P0001';
  end if;
  if v_s.reverse_of_id is not null then
    raise exception 'cannot reverse a reversal' using errcode = 'P0001';
  end if;

  if not nido._settlement_involves_user(v_s, v_uid)
     and not nido.is_member(v_s.space_id, array['owner', 'admin']::nido.member_role[])
  then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  -- Compensating settlement: swap from/to, auto-confirm.
  insert into nido.settlements (
    space_id, from_participant_id, to_participant_id,
    amount_minor, currency, base_amount_minor, method, note, settled_on,
    confirmed_at, confirmed_by, reverse_of_id, created_by
  ) values (
    v_s.space_id,
    v_s.to_participant_id,
    v_s.from_participant_id,
    v_s.amount_minor,
    v_s.currency,
    v_s.base_amount_minor,
    v_s.method,
    coalesce(v_s.note, '') || case when v_s.note is null then '' else ' · ' end || 'Reversal',
    current_date,
    now(),
    v_uid,
    v_s.id,
    v_uid
  )
  returning id into v_new;

  update nido.settlements
  set reversed_at = now()
  where id = p_id;

  for v_recipient in
    select distinct part.user_id
    from nido.participants part
    where part.id in (v_s.from_participant_id, v_s.to_participant_id)
      and part.user_id is not null
  loop
    perform nido.ensure_default_notification_prefs(v_s.space_id, v_recipient);
    insert into nido.notifications (space_id, user_id, kind, title, body, payload, link)
    values (
      v_s.space_id,
      v_recipient,
      'settlement_confirmed',
      'Settlement reversed',
      format('A settlement of %s was reversed.', v_s.amount_minor),
      jsonb_build_object(
        'settlement_id', p_id,
        'reversal_id', v_new,
        'reversed', true
      ),
      '/s/' || v_s.space_id::text || '/balances'
    );
  end loop;

  return jsonb_build_object('id', p_id, 'reversal_id', v_new);
end;
$$;

revoke all on function nido.propose_settlement(jsonb) from public;
revoke all on function nido.confirm_settlement(uuid, bigint) from public;
revoke all on function nido.dispute_settlement(uuid, text) from public;
revoke all on function nido.reverse_settlement(uuid) from public;
grant execute on function nido.propose_settlement(jsonb) to authenticated, service_role;
grant execute on function nido.confirm_settlement(uuid, bigint) to authenticated, service_role;
grant execute on function nido.dispute_settlement(uuid, text) to authenticated, service_role;
grant execute on function nido.reverse_settlement(uuid) to authenticated, service_role;

-- Realtime for settlement confirmations.
alter table nido.settlements replica identity full;
alter publication supabase_realtime add table nido.settlements;
