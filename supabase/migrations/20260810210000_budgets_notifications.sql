-- Phase 04 — budgets, budget periods, notifications, spend triggers, threshold eval.
-- See docs/02-DATA-MODEL.md §6, §12 and docs/phases/PHASE-04-budgets.md.

-- ---------------------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------------------

create table nido.budgets (
  id             uuid primary key default gen_random_uuid(),
  space_id       uuid not null references nido.spaces (id) on delete cascade,
  name           text not null check (char_length(name) between 1 and 80),
  scope          nido.budget_scope not null,
  category_id    uuid references nido.categories (id) on delete cascade,
  participant_id uuid references nido.participants (id) on delete cascade,
  period         nido.budget_period not null default 'month',
  limit_minor    bigint not null check (limit_minor > 0),
  currency       nido.currency_code not null,
  include_subcategories boolean not null default true,
  rollover       boolean not null default false,
  starts_on      date not null default (current_date),
  ends_on        date,
  alert_thresholds smallint[] not null default '{50,80,100}',
  is_active      boolean not null default true,
  created_by     uuid not null references nido.profiles (id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint budgets_scope_shape check (
    (scope = 'space' and category_id is null and participant_id is null)
    or (scope = 'category' and category_id is not null and participant_id is null)
    or (scope = 'participant' and category_id is null and participant_id is not null)
    or (scope = 'category_participant' and category_id is not null and participant_id is not null)
  ),
  constraint budgets_ends_after_starts check (ends_on is null or ends_on >= starts_on),
  constraint budgets_thresholds_valid check (
    cardinality(alert_thresholds) >= 1
    and alert_thresholds <@ array[50, 80, 100, 25, 75, 90, 110, 120, 150, 200]::smallint[]
  )
);

create index budgets_space_active_idx on nido.budgets (space_id) where is_active;

create trigger budgets_set_updated_at
  before update on nido.budgets
  for each row execute function nido.tg_set_updated_at();

create table nido.budget_periods (
  id            uuid primary key default gen_random_uuid(),
  budget_id     uuid not null references nido.budgets (id) on delete cascade,
  space_id      uuid not null references nido.spaces (id) on delete cascade,
  starts_on     date not null,
  ends_on       date not null,
  limit_minor   bigint not null,
  spent_minor   bigint not null default 0,
  notified      smallint[] not null default '{}',
  constraint budget_periods_range check (ends_on >= starts_on),
  unique (budget_id, starts_on)
);

create index budget_periods_space_range_idx
  on nido.budget_periods (space_id, starts_on, ends_on);

create table nido.notifications (
  id          uuid primary key default gen_random_uuid(),
  space_id    uuid not null references nido.spaces (id) on delete cascade,
  user_id     uuid not null references nido.profiles (id) on delete cascade,
  kind        nido.notification_kind not null,
  title       text not null,
  body        text,
  payload     jsonb not null default '{}'::jsonb,
  link        text,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);

create index notifications_user_unread_idx
  on nido.notifications (user_id, created_at desc)
  where read_at is null;

create index notifications_space_created_idx
  on nido.notifications (space_id, created_at desc);

create table nido.notification_preferences (
  user_id  uuid not null references nido.profiles (id) on delete cascade,
  space_id uuid not null references nido.spaces (id) on delete cascade,
  kind     nido.notification_kind not null,
  in_app   boolean not null default true,
  push     boolean not null default false,
  email    boolean not null default false,
  primary key (user_id, space_id, kind)
);

-- ---------------------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------------------

alter table nido.budgets enable row level security;
alter table nido.budget_periods enable row level security;
alter table nido.notifications enable row level security;
alter table nido.notification_preferences enable row level security;

create policy "budgets_select_members"
  on nido.budgets for select
  using (nido.is_member(space_id));

create policy "budgets_insert_editors"
  on nido.budgets for insert
  with check (
    nido.is_member(space_id, array['owner', 'admin', 'member']::nido.member_role[])
    and created_by = (select auth.uid())
  );

create policy "budgets_update_editors"
  on nido.budgets for update
  using (nido.is_member(space_id, array['owner', 'admin', 'member']::nido.member_role[]))
  with check (nido.is_member(space_id, array['owner', 'admin', 'member']::nido.member_role[]));

create policy "budgets_delete_admins"
  on nido.budgets for delete
  using (nido.is_member(space_id, array['owner', 'admin']::nido.member_role[]));

create policy "budget_periods_select_members"
  on nido.budget_periods for select
  using (nido.is_member(space_id));

-- Periods are written only by security-definer functions / triggers.
create policy "budget_periods_insert_deny"
  on nido.budget_periods for insert
  with check (false);

create policy "budget_periods_update_deny"
  on nido.budget_periods for update
  using (false);

create policy "budget_periods_delete_deny"
  on nido.budget_periods for delete
  using (false);

create policy "notifications_select_own"
  on nido.notifications for select
  using (user_id = (select auth.uid()) and nido.is_member(space_id));

create policy "notifications_update_own"
  on nido.notifications for update
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "notification_prefs_select_own"
  on nido.notification_preferences for select
  using (user_id = (select auth.uid()) and nido.is_member(space_id));

create policy "notification_prefs_upsert_own"
  on nido.notification_preferences for all
  using (user_id = (select auth.uid()) and nido.is_member(space_id))
  with check (user_id = (select auth.uid()) and nido.is_member(space_id));

grant select, insert, update, delete on nido.budgets to authenticated, service_role;
grant select on nido.budget_periods to authenticated, service_role;
grant select, update on nido.notifications to authenticated, service_role;
grant select, insert, update, delete on nido.notification_preferences to authenticated, service_role;

-- ---------------------------------------------------------------------------------------
-- Period arithmetic (mirrors src/lib/dates/periods.ts)
-- ---------------------------------------------------------------------------------------

create or replace function nido.household_month_start(p_date date, p_month_starts_on smallint)
returns date
language sql
immutable
set search_path = ''
as $$
  select case
    when extract(day from p_date)::int >= p_month_starts_on
      then make_date(extract(year from p_date)::int, extract(month from p_date)::int, p_month_starts_on)
    else (
      make_date(extract(year from p_date)::int, extract(month from p_date)::int, p_month_starts_on)
      - interval '1 month'
    )::date
  end;
$$;

create or replace function nido.period_bounds(
  p_period nido.budget_period,
  p_reference date,
  p_week_starts_on smallint,
  p_month_starts_on smallint
)
returns table (starts_on date, ends_on date)
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_from date;
  v_dow int;
  v_offset int;
  v_month_start date;
  v_year int;
  v_month int;
  v_q_month int;
begin
  if p_week_starts_on < 0 or p_week_starts_on > 6 then
    raise exception 'invalid week_starts_on' using errcode = '22023';
  end if;
  if p_month_starts_on < 1 or p_month_starts_on > 28 then
    raise exception 'invalid month_starts_on' using errcode = '22023';
  end if;

  case p_period
    when 'day' then
      v_from := p_reference;
      return query select v_from, v_from;
    when 'week' then
      -- Postgres DOW: 0=Sunday … 6=Saturday (same as JS).
      v_dow := extract(dow from p_reference)::int;
      v_offset := (v_dow - p_week_starts_on + 7) % 7;
      v_from := p_reference - v_offset;
      return query select v_from, (v_from + 6);
    when 'month' then
      v_from := nido.household_month_start(p_reference, p_month_starts_on);
      return query select v_from, (v_from + interval '1 month' - interval '1 day')::date;
    when 'quarter' then
      v_month_start := nido.household_month_start(p_reference, p_month_starts_on);
      v_year := extract(year from v_month_start)::int;
      v_month := extract(month from v_month_start)::int;
      v_q_month := ((v_month - 1) / 3) * 3 + 1;
      v_from := make_date(v_year, v_q_month, p_month_starts_on);
      return query select v_from, (v_from + interval '3 months' - interval '1 day')::date;
    when 'year' then
      v_month_start := nido.household_month_start(p_reference, p_month_starts_on);
      v_year := extract(year from v_month_start)::int;
      v_from := make_date(v_year, 1, p_month_starts_on);
      return query select v_from, (v_from + interval '12 months' - interval '1 day')::date;
  end case;
end;
$$;

-- ---------------------------------------------------------------------------------------
-- Spend definition
-- ---------------------------------------------------------------------------------------

create or replace function nido.budget_category_ids(p_budget nido.budgets)
returns uuid[]
language sql
stable
set search_path = ''
as $$
  select case
    when p_budget.category_id is null then null
    when p_budget.include_subcategories then
      array(
        select c.id
        from nido.categories c
        where c.space_id = p_budget.space_id
          and (c.id = p_budget.category_id or c.parent_id = p_budget.category_id)
      )
    else array[p_budget.category_id]
  end;
$$;

create or replace function nido.compute_budget_spent(
  p_budget_id uuid,
  p_from date,
  p_to date
)
returns bigint
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_budget nido.budgets%rowtype;
  v_cats uuid[];
  v_spent bigint;
begin
  select * into v_budget from nido.budgets where id = p_budget_id;
  if not found then
    raise exception 'budget not found' using errcode = 'P0002';
  end if;

  v_cats := nido.budget_category_ids(v_budget);

  if v_budget.scope in ('participant', 'category_participant') then
    select coalesce(sum(s.base_owed_minor), 0)
      into v_spent
    from nido.transaction_splits s
    join nido.transactions t on t.id = s.transaction_id
    where t.space_id = v_budget.space_id
      and t.deleted_at is null
      and t.kind = 'expense'
      and t.booked_on between p_from and p_to
      and s.participant_id = v_budget.participant_id
      and (
        v_cats is null
        or t.category_id = any (v_cats)
      );
  else
    select coalesce(sum(t.base_amount_minor), 0)
      into v_spent
    from nido.transactions t
    where t.space_id = v_budget.space_id
      and t.deleted_at is null
      and t.kind = 'expense'
      and t.booked_on between p_from and p_to
      and (
        v_cats is null
        or t.category_id = any (v_cats)
      );
  end if;

  return v_spent;
end;
$$;

create or replace function nido.refresh_rollover_limits(p_budget_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_budget nido.budgets%rowtype;
  v_row record;
  v_prev_limit bigint := 0;
  v_prev_spent bigint := 0;
  v_limit bigint;
  v_first boolean := true;
begin
  select * into v_budget from nido.budgets where id = p_budget_id;
  if not found or not v_budget.rollover then
    return;
  end if;

  for v_row in
    select id, limit_minor, spent_minor
    from nido.budget_periods
    where budget_id = p_budget_id
    order by starts_on
    for update
  loop
    if v_first then
      v_limit := v_budget.limit_minor;
      v_first := false;
    else
      v_limit := v_budget.limit_minor + greatest(v_prev_limit - v_prev_spent, 0);
    end if;

    if v_row.limit_minor is distinct from v_limit then
      update nido.budget_periods set limit_minor = v_limit where id = v_row.id;
    end if;

    v_prev_limit := v_limit;
    v_prev_spent := v_row.spent_minor;
  end loop;
end;
$$;

create or replace function nido.recompute_budget_period(p_period_id uuid)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_period nido.budget_periods%rowtype;
  v_spent bigint;
begin
  select * into v_period from nido.budget_periods where id = p_period_id for update;
  if not found then
    raise exception 'budget period not found' using errcode = 'P0002';
  end if;

  v_spent := nido.compute_budget_spent(v_period.budget_id, v_period.starts_on, v_period.ends_on);

  update nido.budget_periods
  set spent_minor = v_spent
  where id = p_period_id;

  perform nido.refresh_rollover_limits(v_period.budget_id);

  return v_spent;
end;
$$;

revoke all on function nido.recompute_budget_period(uuid) from public;
grant execute on function nido.recompute_budget_period(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------------------
-- ensure_budget_periods
-- ---------------------------------------------------------------------------------------

create or replace function nido.ensure_budget_periods(p_budget_id uuid, p_through date)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_budget nido.budgets%rowtype;
  v_space nido.spaces%rowtype;
  v_cursor date;
  v_bounds record;
  v_created int := 0;
  v_prev nido.budget_periods%rowtype;
  v_limit bigint;
  v_through date;
begin
  select * into v_budget from nido.budgets where id = p_budget_id;
  if not found then
    raise exception 'budget not found' using errcode = 'P0002';
  end if;

  if auth.role() is distinct from 'service_role'
     and not nido.is_member(v_budget.space_id, array['owner', 'admin', 'member']::nido.member_role[]) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select * into v_space from nido.spaces where id = v_budget.space_id;

  v_through := least(coalesce(v_budget.ends_on, p_through), p_through);
  if v_through < v_budget.starts_on then
    return 0;
  end if;

  select * into v_bounds
  from nido.period_bounds(
    v_budget.period,
    v_budget.starts_on,
    v_space.week_starts_on,
    v_space.month_starts_on
  );
  v_cursor := v_bounds.starts_on;

  while v_cursor <= v_through loop
    select * into v_bounds
    from nido.period_bounds(
      v_budget.period,
      v_cursor,
      v_space.week_starts_on,
      v_space.month_starts_on
    );

    if v_bounds.ends_on < v_budget.starts_on then
      v_cursor := v_bounds.ends_on + 1;
      continue;
    end if;

    if not exists (
      select 1 from nido.budget_periods bp
      where bp.budget_id = p_budget_id and bp.starts_on = v_bounds.starts_on
    ) then
      v_limit := v_budget.limit_minor;

      if v_budget.rollover then
        select * into v_prev
        from nido.budget_periods
        where budget_id = p_budget_id
          and starts_on < v_bounds.starts_on
        order by starts_on desc
        limit 1;

        if found then
          -- Unspent carries forward; overspend does not (demoralising — off by default path).
          v_limit := v_budget.limit_minor + greatest(v_prev.limit_minor - v_prev.spent_minor, 0);
        end if;
      end if;

      insert into nido.budget_periods (
        budget_id, space_id, starts_on, ends_on, limit_minor, spent_minor
      ) values (
        p_budget_id,
        v_budget.space_id,
        v_bounds.starts_on,
        least(v_bounds.ends_on, coalesce(v_budget.ends_on, v_bounds.ends_on)),
        v_limit,
        nido.compute_budget_spent(p_budget_id, v_bounds.starts_on, least(v_bounds.ends_on, coalesce(v_budget.ends_on, v_bounds.ends_on)))
      );
      v_created := v_created + 1;
    end if;

    v_cursor := v_bounds.ends_on + 1;
  end loop;

  perform nido.refresh_rollover_limits(p_budget_id);

  return v_created;
end;
$$;

revoke all on function nido.ensure_budget_periods(uuid, date) from public;
grant execute on function nido.ensure_budget_periods(uuid, date) to authenticated, service_role;

-- ---------------------------------------------------------------------------------------
-- Threshold evaluation + notifications
-- ---------------------------------------------------------------------------------------

create or replace function nido.ensure_default_notification_prefs(p_space_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into nido.notification_preferences (user_id, space_id, kind, in_app, push, email)
  values
    (p_user_id, p_space_id, 'budget_threshold', true, false, false),
    (p_user_id, p_space_id, 'budget_exceeded', true, false, false)
  on conflict do nothing;
end;
$$;

create or replace function nido.evaluate_budget_thresholds(p_period_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_period nido.budget_periods%rowtype;
  v_budget nido.budgets%rowtype;
  v_pct numeric;
  v_threshold smallint;
  v_kind nido.notification_kind;
  v_inserted int := 0;
  v_recipient uuid;
  v_title text;
  v_body text;
  v_link text;
begin
  select * into v_period from nido.budget_periods where id = p_period_id for update;
  if not found then
    raise exception 'budget period not found' using errcode = 'P0002';
  end if;

  select * into v_budget from nido.budgets where id = v_period.budget_id;
  if not v_budget.is_active then
    return 0;
  end if;

  if v_period.limit_minor <= 0 then
    return 0;
  end if;

  v_pct := (v_period.spent_minor::numeric * 100) / v_period.limit_minor::numeric;
  v_link := '/s/' || v_budget.space_id::text || '/budgets/' || v_budget.id::text;

  foreach v_threshold in array v_budget.alert_thresholds loop
    if v_pct < v_threshold then
      continue;
    end if;
    if v_threshold = any (v_period.notified) then
      continue;
    end if;

    v_kind := case
      when v_threshold >= 100 then 'budget_exceeded'::nido.notification_kind
      else 'budget_threshold'::nido.notification_kind
    end;

    v_title := case
      when v_threshold >= 100 then format('%s is over its limit', v_budget.name)
      else format('%s reached %s%%', v_budget.name, v_threshold)
    end;

    v_body := format(
      'Spent %s of %s in the period %s – %s.',
      v_period.spent_minor,
      v_period.limit_minor,
      v_period.starts_on,
      v_period.ends_on
    );

    for v_recipient in
      select distinct m.user_id
      from nido.space_members m
      where m.space_id = v_budget.space_id
        and m.status = 'active'
        and (
          v_budget.scope in ('space', 'category')
          or m.role in ('owner', 'admin')
          or exists (
            select 1
            from nido.participants p
            where p.id = v_budget.participant_id
              and p.user_id = m.user_id
          )
        )
    loop
      perform nido.ensure_default_notification_prefs(v_budget.space_id, v_recipient);

      if exists (
        select 1
        from nido.notification_preferences pref
        where pref.user_id = v_recipient
          and pref.space_id = v_budget.space_id
          and pref.kind = v_kind
          and pref.in_app
      ) then
        insert into nido.notifications (space_id, user_id, kind, title, body, payload, link)
        values (
          v_budget.space_id,
          v_recipient,
          v_kind,
          v_title,
          v_body,
          jsonb_build_object(
            'budget_id', v_budget.id,
            'period_id', v_period.id,
            'threshold', v_threshold,
            'spent_minor', v_period.spent_minor,
            'limit_minor', v_period.limit_minor
          ),
          v_link
        );
        v_inserted := v_inserted + 1;
      end if;
    end loop;

    update nido.budget_periods
    set notified = array(select distinct unnest(notified || v_threshold) order by 1)
    where id = p_period_id;

    select notified into v_period.notified from nido.budget_periods where id = p_period_id;
  end loop;

  return v_inserted;
end;
$$;

revoke all on function nido.evaluate_budget_thresholds(uuid) from public;
grant execute on function nido.evaluate_budget_thresholds(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------------------
-- Touch affected periods after ledger changes
-- ---------------------------------------------------------------------------------------

create or replace function nido.refresh_budgets_for_transaction(
  p_space_id uuid,
  p_booked_on date,
  p_category_id uuid,
  p_old_booked_on date default null,
  p_old_category_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_period_id uuid;
begin
  for v_period_id in
    select distinct bp.id
    from nido.budget_periods bp
    join nido.budgets b on b.id = bp.budget_id
    where bp.space_id = p_space_id
      and b.is_active
      and (
        p_booked_on between bp.starts_on and bp.ends_on
        or (p_old_booked_on is not null and p_old_booked_on between bp.starts_on and bp.ends_on)
      )
  loop
    perform nido.recompute_budget_period(v_period_id);
    perform nido.evaluate_budget_thresholds(v_period_id);
  end loop;
end;
$$;

create or replace function nido.tg_budget_on_transaction()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.kind = 'expense' and new.deleted_at is null then
      perform nido.refresh_budgets_for_transaction(new.space_id, new.booked_on, new.category_id);
    end if;
    return new;
  elsif tg_op = 'UPDATE' then
    if (
      old.kind is distinct from new.kind
      or old.booked_on is distinct from new.booked_on
      or old.category_id is distinct from new.category_id
      or old.base_amount_minor is distinct from new.base_amount_minor
      or old.deleted_at is distinct from new.deleted_at
      or old.amount_minor is distinct from new.amount_minor
    ) then
      perform nido.refresh_budgets_for_transaction(
        new.space_id,
        coalesce(new.booked_on, old.booked_on),
        coalesce(new.category_id, old.category_id),
        old.booked_on,
        old.category_id
      );
    end if;
    return new;
  elsif tg_op = 'DELETE' then
    if old.kind = 'expense' then
      perform nido.refresh_budgets_for_transaction(old.space_id, old.booked_on, old.category_id);
    end if;
    return old;
  end if;
  return null;
end;
$$;

create trigger transactions_budget_refresh
  after insert or update or delete on nido.transactions
  for each row execute function nido.tg_budget_on_transaction();

create or replace function nido.tg_budget_on_split()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tx nido.transactions%rowtype;
begin
  if tg_op = 'DELETE' then
    select * into v_tx from nido.transactions where id = old.transaction_id;
  else
    select * into v_tx from nido.transactions where id = new.transaction_id;
  end if;

  if v_tx.id is null or v_tx.kind <> 'expense' or v_tx.deleted_at is not null then
    return coalesce(new, old);
  end if;

  perform nido.refresh_budgets_for_transaction(v_tx.space_id, v_tx.booked_on, v_tx.category_id);
  return coalesce(new, old);
end;
$$;

create trigger transaction_splits_budget_refresh
  after insert or update or delete on nido.transaction_splits
  for each row execute function nido.tg_budget_on_split();

-- ---------------------------------------------------------------------------------------
-- suggest_budgets
-- ---------------------------------------------------------------------------------------

create or replace function nido.suggest_budgets(p_space_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_space nido.spaces%rowtype;
  v_result jsonb;
begin
  if auth.role() is distinct from 'service_role' and not nido.is_member(p_space_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select * into v_space from nido.spaces where id = p_space_id;

  with bounds as (
    select * from nido.period_bounds(
      'month'::nido.budget_period,
      (current_date - interval '1 day')::date,
      v_space.week_starts_on,
      v_space.month_starts_on
    )
  ),
  months as (
    select
      (select starts_on from nido.period_bounds(
        'month'::nido.budget_period,
        (b.starts_on - (n || ' months')::interval)::date,
        v_space.week_starts_on,
        v_space.month_starts_on
      )) as starts_on,
      (select ends_on from nido.period_bounds(
        'month'::nido.budget_period,
        (b.starts_on - (n || ' months')::interval)::date,
        v_space.week_starts_on,
        v_space.month_starts_on
      )) as ends_on
    from bounds b
    cross join generate_series(1, 3) as n
  ),
  cat_month as (
    select
      t.category_id,
      m.starts_on,
      sum(t.base_amount_minor)::bigint as spent
    from months m
    join nido.transactions t
      on t.space_id = p_space_id
     and t.deleted_at is null
     and t.kind = 'expense'
     and t.booked_on between m.starts_on and m.ends_on
     and t.category_id is not null
    group by t.category_id, m.starts_on
  ),
  medians as (
    select
      category_id,
      percentile_cont(0.5) within group (order by spent)::bigint as median_spent,
      count(*)::int as periods
    from cat_month
    group by category_id
    having count(*) >= 3
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'category_id', m.category_id,
        'category_name', c.name,
        'category_color', c.color,
        'suggested_limit_minor',
          greatest(
            500,
            (ceil(m.median_spent::numeric / case when m.median_spent >= 10000 then 1000 else 500 end)
              * case when m.median_spent >= 10000 then 1000 else 500 end)::bigint
          )
      )
      order by m.median_spent desc
    ),
    '[]'::jsonb
  )
    into v_result
  from medians m
  join nido.categories c on c.id = m.category_id;

  return v_result;
end;
$$;

revoke all on function nido.suggest_budgets(uuid) from public;
grant execute on function nido.suggest_budgets(uuid) to authenticated, service_role;

-- After creating a budget, ensure the current period exists.
create or replace function nido.tg_budget_ensure_periods()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform nido.ensure_budget_periods(new.id, coalesce(new.ends_on, current_date + 90));
  return new;
end;
$$;

create trigger budgets_ensure_periods
  after insert on nido.budgets
  for each row execute function nido.tg_budget_ensure_periods();

-- ---------------------------------------------------------------------------------------
-- Cron entry points (called by Edge Functions with service_role)
-- ---------------------------------------------------------------------------------------

create or replace function nido.run_budget_alerts(p_through date default current_date)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_budget record;
  v_period record;
  v_inserted int := 0;
  v_n int;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  for v_budget in
    select id from nido.budgets where is_active
  loop
    perform nido.ensure_budget_periods(v_budget.id, p_through);
  end loop;

  for v_period in
    select bp.id
    from nido.budget_periods bp
    join nido.budgets b on b.id = bp.budget_id
    where b.is_active
      and bp.starts_on <= p_through
      and bp.ends_on >= (p_through - 90)
  loop
    v_n := nido.evaluate_budget_thresholds(v_period.id);
    v_inserted := v_inserted + v_n;
  end loop;

  return v_inserted;
end;
$$;

revoke all on function nido.run_budget_alerts(date) from public;
grant execute on function nido.run_budget_alerts(date) to service_role;

create or replace function nido.reconcile_open_budget_periods()
returns table (
  period_id uuid,
  budget_id uuid,
  before_minor bigint,
  after_minor bigint
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row record;
  v_computed bigint;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  for v_row in
    select bp.id, bp.budget_id, bp.spent_minor, bp.starts_on, bp.ends_on
    from nido.budget_periods bp
    join nido.budgets b on b.id = bp.budget_id
    where b.is_active
      and bp.ends_on >= (current_date - 120)
  loop
    v_computed := nido.compute_budget_spent(v_row.budget_id, v_row.starts_on, v_row.ends_on);
    if v_computed is distinct from v_row.spent_minor then
      update nido.budget_periods
      set spent_minor = v_computed
      where id = v_row.id;

      period_id := v_row.id;
      budget_id := v_row.budget_id;
      before_minor := v_row.spent_minor;
      after_minor := v_computed;
      return next;
    end if;
  end loop;
end;
$$;

revoke all on function nido.reconcile_open_budget_periods() from public;
grant execute on function nido.reconcile_open_budget_periods() to service_role;

alter table nido.notifications replica identity full;
alter publication supabase_realtime add table nido.notifications;

comment on table nido.budgets is 'Spending limits scoped to space/category/participant.';
comment on table nido.budget_periods is 'One row per budget period; spent_minor maintained by ledger triggers.';
comment on function nido.compute_budget_spent(uuid, date, date) is
  'Authoritative spend: base_owed_minor for participant scopes, base_amount_minor otherwise; expenses only.';
