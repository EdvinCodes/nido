-- Phase 05 — goals, goal contributions, recurring rules, materialization, detection.
-- See docs/02-DATA-MODEL.md §7–8 and docs/phases/PHASE-05-goals-subscriptions.md.

-- ---------------------------------------------------------------------------------------
-- Goals
-- ---------------------------------------------------------------------------------------

create table nido.goals (
  id             uuid primary key default gen_random_uuid(),
  space_id       uuid not null references nido.spaces (id) on delete cascade,
  name           text not null check (char_length(name) between 1 and 80),
  description    text check (description is null or char_length(description) <= 500),
  target_minor   bigint not null check (target_minor > 0),
  currency       nido.currency_code not null,
  saved_minor    bigint not null default 0,
  target_date    date,
  account_id     uuid references nido.accounts (id) on delete set null,
  color          text not null default '#8B8B8B',
  icon           text not null default 'piggy-bank',
  status         nido.goal_status not null default 'active',
  auto_contribute_minor bigint check (auto_contribute_minor is null or auto_contribute_minor > 0),
  created_by     uuid not null references nido.profiles (id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index goals_space_status_idx on nido.goals (space_id, status);

create trigger goals_set_updated_at
  before update on nido.goals
  for each row execute function nido.tg_set_updated_at();

create table nido.goal_contributions (
  id             uuid primary key default gen_random_uuid(),
  goal_id        uuid not null references nido.goals (id) on delete cascade,
  space_id       uuid not null references nido.spaces (id) on delete cascade,
  participant_id uuid not null references nido.participants (id),
  amount_minor   bigint not null check (amount_minor <> 0),
  transaction_id uuid references nido.transactions (id) on delete set null,
  note           text check (note is null or char_length(note) <= 500),
  contributed_on date not null default (current_date),
  created_at     timestamptz not null default now(),
  constraint goal_contributions_withdrawal_reason check (
    amount_minor > 0 or (note is not null and char_length(trim(note)) >= 1)
  )
);

create index goal_contributions_goal_date_idx
  on nido.goal_contributions (goal_id, contributed_on desc);

-- ---------------------------------------------------------------------------------------
-- Recurring rules
-- ---------------------------------------------------------------------------------------

create table nido.recurring_rules (
  id                   uuid primary key default gen_random_uuid(),
  space_id             uuid not null references nido.spaces (id) on delete cascade,
  kind                 nido.recurring_kind not null default 'subscription',
  name                 text not null check (char_length(name) between 1 and 80),
  merchant             text check (merchant is null or char_length(merchant) <= 120),
  amount_minor         bigint not null check (amount_minor > 0),
  currency             nido.currency_code not null,
  category_id          uuid references nido.categories (id) on delete set null,
  account_id           uuid references nido.accounts (id) on delete set null,
  to_account_id        uuid references nido.accounts (id) on delete set null,
  payer_participant_id uuid references nido.participants (id) on delete set null,
  split_mode           nido.split_mode not null default 'equal',
  split_config         jsonb not null default '[]'::jsonb,
  freq                 nido.recurrence_freq not null default 'month',
  interval_count       smallint not null default 1 check (interval_count > 0),
  by_month_day         smallint check (by_month_day between -1 and 31 and by_month_day <> 0),
  by_weekday           smallint check (by_weekday between 0 and 6),
  starts_on            date not null,
  ends_on              date,
  next_run_on          date not null,
  last_run_on          date,
  auto_create          boolean not null default true,
  reminder_days_before smallint not null default 2 check (reminder_days_before between 0 and 30),
  is_active            boolean not null default true,
  cancelled_at         timestamptz,
  cancel_url           text,
  notes                text check (notes is null or char_length(notes) <= 2000),
  ghost_snoozed_until  date,
  marked_in_use_at     timestamptz,
  created_by           uuid not null references nido.profiles (id),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint recurring_rules_ends_after_starts check (ends_on is null or ends_on >= starts_on),
  constraint recurring_rules_transfer_shape check (
    (kind = 'transfer' and to_account_id is not null and account_id is not null)
    or (kind <> 'transfer' and to_account_id is null)
  )
);

create index recurring_rules_next_run_idx
  on nido.recurring_rules (next_run_on)
  where is_active and cancelled_at is null;

create trigger recurring_rules_set_updated_at
  before update on nido.recurring_rules
  for each row execute function nido.tg_set_updated_at();

create table nido.recurring_price_changes (
  id               uuid primary key default gen_random_uuid(),
  rule_id          uuid not null references nido.recurring_rules (id) on delete cascade,
  space_id         uuid not null references nido.spaces (id) on delete cascade,
  old_amount_minor bigint not null,
  new_amount_minor bigint not null,
  detected_on      date not null default (current_date),
  source           text not null default 'manual'
    check (source in ('manual', 'import', 'bank', 'generated'))
);

create index recurring_price_changes_rule_idx
  on nido.recurring_price_changes (rule_id, detected_on desc);

-- Link ledger rows to rules / goals (deferred from Phase 02 data-model sketch).
alter table nido.transactions
  add column recurring_rule_id uuid references nido.recurring_rules (id) on delete set null,
  add column goal_id uuid references nido.goals (id) on delete set null;

create unique index transactions_recurring_booked_uidx
  on nido.transactions (recurring_rule_id, booked_on)
  where recurring_rule_id is not null and deleted_at is null;

create index transactions_goal_idx
  on nido.transactions (goal_id)
  where goal_id is not null and deleted_at is null;

-- ---------------------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------------------

alter table nido.goals enable row level security;
alter table nido.goal_contributions enable row level security;
alter table nido.recurring_rules enable row level security;
alter table nido.recurring_price_changes enable row level security;

create policy "goals_select_members"
  on nido.goals for select
  using (nido.is_member(space_id));

create policy "goals_insert_editors"
  on nido.goals for insert
  with check (
    nido.is_member(space_id, array['owner', 'admin', 'member']::nido.member_role[])
    and created_by = (select auth.uid())
  );

create policy "goals_update_editors"
  on nido.goals for update
  using (nido.is_member(space_id, array['owner', 'admin', 'member']::nido.member_role[]))
  with check (nido.is_member(space_id, array['owner', 'admin', 'member']::nido.member_role[]));

create policy "goals_delete_admins"
  on nido.goals for delete
  using (nido.is_member(space_id, array['owner', 'admin']::nido.member_role[]));

create policy "goal_contributions_select_members"
  on nido.goal_contributions for select
  using (nido.is_member(space_id));

create policy "goal_contributions_insert_editors"
  on nido.goal_contributions for insert
  with check (nido.is_member(space_id, array['owner', 'admin', 'member']::nido.member_role[]));

create policy "goal_contributions_delete_editors"
  on nido.goal_contributions for delete
  using (nido.is_member(space_id, array['owner', 'admin', 'member']::nido.member_role[]));

create policy "recurring_rules_select_members"
  on nido.recurring_rules for select
  using (nido.is_member(space_id));

create policy "recurring_rules_insert_editors"
  on nido.recurring_rules for insert
  with check (
    nido.is_member(space_id, array['owner', 'admin', 'member']::nido.member_role[])
    and created_by = (select auth.uid())
  );

create policy "recurring_rules_update_editors"
  on nido.recurring_rules for update
  using (nido.is_member(space_id, array['owner', 'admin', 'member']::nido.member_role[]))
  with check (nido.is_member(space_id, array['owner', 'admin', 'member']::nido.member_role[]));

create policy "recurring_rules_delete_admins"
  on nido.recurring_rules for delete
  using (nido.is_member(space_id, array['owner', 'admin']::nido.member_role[]));

create policy "recurring_price_changes_select_members"
  on nido.recurring_price_changes for select
  using (nido.is_member(space_id));

grant select, insert, update, delete on nido.goals to authenticated, service_role;
grant select, insert, delete on nido.goal_contributions to authenticated, service_role;
grant select, insert, update, delete on nido.recurring_rules to authenticated, service_role;
grant select on nido.recurring_price_changes to authenticated, service_role;
grant insert on nido.recurring_price_changes to service_role;

-- ---------------------------------------------------------------------------------------
-- Notification prefs defaults for new kinds
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
    (p_user_id, p_space_id, 'recurring_price_change', true, false, false)
  on conflict do nothing;
end;
$$;

-- ---------------------------------------------------------------------------------------
-- Goal saved_minor + reached notification
-- ---------------------------------------------------------------------------------------

create or replace function nido.tg_goal_contribution_saved()
returns trigger
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  v_goal nido.goals%rowtype;
  v_sum bigint;
  v_recipient uuid;
begin
  if tg_op = 'DELETE' then
    select * into v_goal from nido.goals where id = old.goal_id for update;
  else
    select * into v_goal from nido.goals where id = new.goal_id for update;
  end if;

  if not found then
    return coalesce(new, old);
  end if;

  select coalesce(sum(c.amount_minor), 0)
    into v_sum
  from nido.goal_contributions c
  where c.goal_id = v_goal.id;

  update nido.goals
  set saved_minor = v_sum,
      status = case
        when v_goal.status = 'archived' then v_goal.status
        when v_goal.status = 'paused' then v_goal.status
        when v_sum >= v_goal.target_minor then 'reached'::nido.goal_status
        when v_goal.status = 'reached' and v_sum < v_goal.target_minor then 'active'::nido.goal_status
        else v_goal.status
      end
  where id = v_goal.id;

  -- Notify once when transitioning into reached.
  if v_goal.status is distinct from 'reached' and v_sum >= v_goal.target_minor then
    for v_recipient in
      select m.user_id
      from nido.space_members m
      where m.space_id = v_goal.space_id
        and m.status = 'active'
    loop
      perform nido.ensure_default_notification_prefs(v_goal.space_id, v_recipient);
      if exists (
        select 1 from nido.notification_preferences pref
        where pref.user_id = v_recipient
          and pref.space_id = v_goal.space_id
          and pref.kind = 'goal_reached'
          and pref.in_app
      ) and not exists (
        select 1 from nido.notifications n
        where n.space_id = v_goal.space_id
          and n.user_id = v_recipient
          and n.kind = 'goal_reached'
          and n.payload->>'goal_id' = v_goal.id::text
      ) then
        insert into nido.notifications (space_id, user_id, kind, title, body, payload, link)
        values (
          v_goal.space_id,
          v_recipient,
          'goal_reached',
          format('%s reached its target', v_goal.name),
          format('Saved %s of %s.', v_sum, v_goal.target_minor),
          jsonb_build_object(
            'goal_id', v_goal.id,
            'saved_minor', v_sum,
            'target_minor', v_goal.target_minor
          ),
          '/s/' || v_goal.space_id::text || '/goals/' || v_goal.id::text
        );
      end if;
    end loop;
  end if;

  return coalesce(new, old);
end;
$$;

create trigger goal_contributions_saved
  after insert or update or delete on nido.goal_contributions
  for each row execute function nido.tg_goal_contribution_saved();

create or replace function nido.goal_projection(p_goal_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_goal nido.goals%rowtype;
  v_today date := current_date;
  v_months_left numeric;
  v_remaining bigint;
  v_required_monthly bigint;
  v_avg_monthly bigint;
  v_projected_date date;
  v_on_pace boolean;
  v_three_start date := (date_trunc('month', v_today) - interval '3 months')::date;
begin
  select * into v_goal from nido.goals where id = p_goal_id;
  if not found then
    raise exception 'goal not found' using errcode = 'P0002';
  end if;

  if auth.role() is distinct from 'service_role' and not nido.is_member(v_goal.space_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  v_remaining := greatest(v_goal.target_minor - v_goal.saved_minor, 0);

  select coalesce(
    (sum(c.amount_minor) filter (where c.amount_minor > 0))::bigint / 3,
    0
  )
    into v_avg_monthly
  from nido.goal_contributions c
  where c.goal_id = p_goal_id
    and c.contributed_on >= v_three_start
    and c.contributed_on < date_trunc('month', v_today)::date;

  if v_goal.target_date is not null then
    if v_goal.target_date <= v_today then
      v_months_left := 0;
      v_required_monthly := case when v_remaining > 0 then v_remaining else 0 end;
      v_on_pace := v_remaining = 0;
      v_projected_date := case
        when v_avg_monthly > 0 and v_remaining > 0
          then (v_today + (ceil(v_remaining::numeric / v_avg_monthly) || ' months')::interval)::date
        when v_remaining = 0 then v_today
        else null
      end;
    else
      v_months_left := greatest(
        (
          (extract(year from age(v_goal.target_date, v_today)) * 12)
          + extract(month from age(v_goal.target_date, v_today))
          + case when extract(day from v_goal.target_date) >= extract(day from v_today) then 0 else -1 end
        )::numeric,
        1
      );
      v_required_monthly := ceil(v_remaining::numeric / v_months_left)::bigint;
      v_on_pace := v_avg_monthly >= v_required_monthly or v_remaining = 0;
      v_projected_date := case
        when v_avg_monthly > 0 and v_remaining > 0
          then (v_today + (ceil(v_remaining::numeric / v_avg_monthly) || ' months')::interval)::date
        when v_remaining = 0 then v_today
        else null
      end;
    end if;
  else
    v_required_monthly := null;
    v_on_pace := null;
    v_projected_date := case
      when v_avg_monthly > 0 and v_remaining > 0
        then (v_today + (ceil(v_remaining::numeric / v_avg_monthly) || ' months')::interval)::date
      when v_remaining = 0 then v_today
      else null
    end;
  end if;

  return jsonb_build_object(
    'goal_id', v_goal.id,
    'remaining_minor', v_remaining,
    'required_monthly_minor', v_required_monthly,
    'average_monthly_minor', v_avg_monthly,
    'projected_completion_on', v_projected_date,
    'on_pace', v_on_pace,
    'target_date', v_goal.target_date,
    'target_passed', v_goal.target_date is not null and v_goal.target_date < v_today and v_remaining > 0
  );
end;
$$;

revoke all on function nido.goal_projection(uuid) from public;
grant execute on function nido.goal_projection(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------------------
-- next_occurrence
-- ---------------------------------------------------------------------------------------

create or replace function nido._last_day_of_month(p_date date)
returns date
language sql
immutable
set search_path = ''
as $$
  select (date_trunc('month', p_date) + interval '1 month' - interval '1 day')::date;
$$;

create or replace function nido._clamp_month_day(p_year int, p_month int, p_day int)
returns date
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_last int;
begin
  v_last := extract(day from nido._last_day_of_month(make_date(p_year, p_month, 1)))::int;
  return make_date(p_year, p_month, least(greatest(p_day, 1), v_last));
end;
$$;

create or replace function nido._week_start(p_date date, p_week_starts_on smallint)
returns date
language sql
immutable
set search_path = ''
as $$
  select p_date
    - ((extract(dow from p_date)::int - p_week_starts_on + 7) % 7);
$$;

create or replace function nido.next_occurrence(p_rule nido.recurring_rules, p_after date)
returns date
language plpgsql
stable
set search_path = ''
as $$
declare
  v_week_starts_on smallint;
  v_cursor date;
  v_candidate date;
  v_first date;
  v_target_dow int;
  v_anchor_week date;
  v_cand_week date;
  v_weeks int;
  v_year int;
  v_month int;
  v_day int;
  v_guard int := 0;
begin
  select week_starts_on into v_week_starts_on
  from nido.spaces
  where id = p_rule.space_id;
  v_week_starts_on := coalesce(v_week_starts_on, 1::smallint);

  -- Start searching strictly after p_after.
  v_cursor := p_after + 1;

  if p_rule.ends_on is not null and v_cursor > p_rule.ends_on then
    return null;
  end if;

  case p_rule.freq
    when 'day' then
      -- Align to starts_on + n*interval.
      if v_cursor <= p_rule.starts_on then
        v_candidate := p_rule.starts_on;
      else
        v_candidate := p_rule.starts_on
          + (
            ceil(
              (v_cursor - p_rule.starts_on)::numeric / p_rule.interval_count
            )::int * p_rule.interval_count
          );
      end if;

    when 'week' then
      v_target_dow := coalesce(
        p_rule.by_weekday,
        extract(dow from p_rule.starts_on)::int
      );
      v_first := p_rule.starts_on
        + ((v_target_dow - extract(dow from p_rule.starts_on)::int + 7) % 7);
      v_anchor_week := nido._week_start(v_first, v_week_starts_on);

      v_candidate := greatest(v_cursor, v_first);
      loop
        v_guard := v_guard + 1;
        if v_guard > 4000 then
          raise exception 'next_occurrence week loop exceeded' using errcode = 'P0001';
        end if;

        if extract(dow from v_candidate)::int = v_target_dow then
          v_cand_week := nido._week_start(v_candidate, v_week_starts_on);
          v_weeks := ((v_cand_week - v_anchor_week) / 7);
          if v_candidate >= v_first
             and v_weeks >= 0
             and (v_weeks % p_rule.interval_count) = 0
          then
            exit;
          end if;
        end if;

        v_candidate := v_candidate + 1;
        if p_rule.ends_on is not null and v_candidate > p_rule.ends_on then
          return null;
        end if;
      end loop;

    when 'month' then
      v_day := coalesce(
        nullif(p_rule.by_month_day, -1),
        extract(day from p_rule.starts_on)::int
      );
      if p_rule.by_month_day = -1 then
        v_day := -1;
      end if;

      v_year := extract(year from greatest(v_cursor, p_rule.starts_on))::int;
      v_month := extract(month from greatest(v_cursor, p_rule.starts_on))::int;

      loop
        v_guard := v_guard + 1;
        if v_guard > 2400 then
          raise exception 'next_occurrence month loop exceeded' using errcode = 'P0001';
        end if;

        if v_day = -1 then
          v_candidate := nido._last_day_of_month(make_date(v_year, v_month, 1));
        else
          v_candidate := nido._clamp_month_day(v_year, v_month, v_day);
        end if;

        -- Honour interval from starts_on month.
        if v_candidate >= v_cursor
           and v_candidate >= p_rule.starts_on
           and (
             (
               (v_year - extract(year from p_rule.starts_on)::int) * 12
               + (v_month - extract(month from p_rule.starts_on)::int)
             ) % p_rule.interval_count = 0
           )
        then
          exit;
        end if;

        v_month := v_month + 1;
        if v_month > 12 then
          v_month := 1;
          v_year := v_year + 1;
        end if;
        if p_rule.ends_on is not null and make_date(v_year, v_month, 1) > p_rule.ends_on then
          return null;
        end if;
      end loop;

    when 'year' then
      v_day := coalesce(
        nullif(p_rule.by_month_day, -1),
        extract(day from p_rule.starts_on)::int
      );
      if p_rule.by_month_day = -1 then
        v_day := -1;
      end if;
      v_month := extract(month from p_rule.starts_on)::int;
      v_year := extract(year from greatest(v_cursor, p_rule.starts_on))::int;

      loop
        v_guard := v_guard + 1;
        if v_guard > 400 then
          raise exception 'next_occurrence year loop exceeded' using errcode = 'P0001';
        end if;

        if v_day = -1 then
          v_candidate := nido._last_day_of_month(make_date(v_year, v_month, 1));
        else
          v_candidate := nido._clamp_month_day(v_year, v_month, v_day);
        end if;

        if v_candidate >= v_cursor
           and v_candidate >= p_rule.starts_on
           and ((v_year - extract(year from p_rule.starts_on)::int) % p_rule.interval_count = 0)
        then
          exit;
        end if;

        v_year := v_year + 1;
        if p_rule.ends_on is not null and make_date(v_year, v_month, 1) > p_rule.ends_on then
          return null;
        end if;
      end loop;
  end case;

  if p_rule.ends_on is not null and v_candidate > p_rule.ends_on then
    return null;
  end if;

  return v_candidate;
end;
$$;

-- Convenience wrapper for tests / RPC callers that pass rule id.
create or replace function nido.next_occurrence_after(p_rule_id uuid, p_after date)
returns date
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_rule nido.recurring_rules%rowtype;
begin
  select * into v_rule from nido.recurring_rules where id = p_rule_id;
  if not found then
    raise exception 'rule not found' using errcode = 'P0002';
  end if;
  if auth.role() is distinct from 'service_role' and not nido.is_member(v_rule.space_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return nido.next_occurrence(v_rule, p_after);
end;
$$;

revoke all on function nido.next_occurrence_after(uuid, date) from public;
grant execute on function nido.next_occurrence_after(uuid, date) to authenticated, service_role;

-- ---------------------------------------------------------------------------------------
-- Price-change + create_transaction extensions
-- ---------------------------------------------------------------------------------------

create or replace function nido._notify_recurring_price_change(
  p_rule nido.recurring_rules,
  p_old bigint,
  p_new bigint
)
returns void
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  v_recipient uuid;
begin
  for v_recipient in
    select m.user_id
    from nido.space_members m
    where m.space_id = p_rule.space_id
      and m.status = 'active'
  loop
    perform nido.ensure_default_notification_prefs(p_rule.space_id, v_recipient);
    if exists (
      select 1 from nido.notification_preferences pref
      where pref.user_id = v_recipient
        and pref.space_id = p_rule.space_id
        and pref.kind = 'recurring_price_change'
        and pref.in_app
    ) and not exists (
      select 1 from nido.notifications n
      where n.space_id = p_rule.space_id
        and n.user_id = v_recipient
        and n.kind = 'recurring_price_change'
        and n.payload->>'rule_id' = p_rule.id::text
        and n.payload->>'new_amount_minor' = p_new::text
        and n.created_at::date = current_date
    ) then
      insert into nido.notifications (space_id, user_id, kind, title, body, payload, link)
      values (
        p_rule.space_id,
        v_recipient,
        'recurring_price_change',
        format('%s price changed', p_rule.name),
        format('Was %s, now %s.', p_old, p_new),
        jsonb_build_object(
          'rule_id', p_rule.id,
          'old_amount_minor', p_old,
          'new_amount_minor', p_new
        ),
        '/s/' || p_rule.space_id::text || '/subscriptions/' || p_rule.id::text
      );
    end if;
  end loop;
end;
$$;

create or replace function nido._apply_recurring_price_change(
  p_rule_id uuid,
  p_new_amount bigint,
  p_source text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rule nido.recurring_rules%rowtype;
  v_old bigint;
begin
  select * into v_rule from nido.recurring_rules where id = p_rule_id for update;
  if not found then
    return;
  end if;

  v_old := v_rule.amount_minor;
  if v_old <= 0 or p_new_amount <= 0 then
    return;
  end if;

  -- More than 1% absolute relative difference.
  if abs(p_new_amount - v_old)::numeric / v_old::numeric <= 0.01 then
    return;
  end if;

  insert into nido.recurring_price_changes (
    rule_id, space_id, old_amount_minor, new_amount_minor, detected_on, source
  ) values (
    v_rule.id, v_rule.space_id, v_old, p_new_amount, current_date, p_source
  );

  update nido.recurring_rules
  set amount_minor = p_new_amount
  where id = v_rule.id;

  v_rule.amount_minor := p_new_amount;
  perform nido._notify_recurring_price_change(v_rule, v_old, p_new_amount);
end;
$$;

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
    base_amount_minor, base_rate, description, merchant, notes,
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

comment on function nido.create_transaction(jsonb) is
  'Atomically inserts a transaction and server-computed splits. Client sends intent, not cents.';

revoke all on function nido.create_transaction(jsonb) from public;
grant execute on function nido.create_transaction(jsonb) to authenticated, service_role;

-- ---------------------------------------------------------------------------------------
-- materialize_recurring
-- ---------------------------------------------------------------------------------------

create or replace function nido._split_config_to_participants(p_split_config jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    (
      select jsonb_agg(
        case
          when e ? 'owed_minor' then
            jsonb_build_object(
              'participant_id', e ->> 'participant_id',
              'owed_minor', (e ->> 'owed_minor')::bigint,
              'weight', e -> 'weight'
            )
          else
            jsonb_build_object(
              'participant_id', e ->> 'participant_id',
              'weight', coalesce((e ->> 'weight')::numeric, 1)
            )
        end
      )
      from jsonb_array_elements(coalesce(p_split_config, '[]'::jsonb)) e
    ),
    '[]'::jsonb
  );
$$;

create or replace function nido.materialize_recurring(p_rule_id uuid, p_through date)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rule nido.recurring_rules%rowtype;
  v_created int := 0;
  v_run_on date;
  v_next date;
  v_tx_kind nido.tx_kind;
  v_params jsonb;
  v_prev_uid text;
  v_prev_claims text;
  v_prev_role text;
  v_existing uuid;
begin
  select * into v_rule from nido.recurring_rules where id = p_rule_id for update;
  if not found then
    raise exception 'rule not found' using errcode = 'P0002';
  end if;

  if auth.role() is distinct from 'service_role'
     and not nido.is_member(v_rule.space_id, array['owner', 'admin', 'member']::nido.member_role[])
  then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if not v_rule.is_active or v_rule.cancelled_at is not null or not v_rule.auto_create then
    return 0;
  end if;

  v_prev_uid := current_setting('request.jwt.claim.sub', true);
  v_prev_claims := current_setting('request.jwt.claims', true);
  v_prev_role := current_setting('role', true);

  perform set_config('request.jwt.claim.sub', v_rule.created_by::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', v_rule.created_by::text, 'role', 'authenticated')::text,
    true
  );

  v_run_on := v_rule.next_run_on;

  while v_run_on is not null
    and v_run_on <= p_through
    and (v_rule.ends_on is null or v_run_on <= v_rule.ends_on)
  loop
    select t.id into v_existing
    from nido.transactions t
    where t.recurring_rule_id = v_rule.id
      and t.booked_on = v_run_on
      and t.deleted_at is null
    limit 1;

    if v_existing is null then
      v_tx_kind := case
        when v_rule.kind = 'income' then 'income'::nido.tx_kind
        when v_rule.kind = 'transfer' then 'transfer'::nido.tx_kind
        else 'expense'::nido.tx_kind
      end;

      v_params := jsonb_build_object(
        'space_id', v_rule.space_id,
        'kind', v_tx_kind,
        'booked_on', v_run_on,
        'amount_minor', v_rule.amount_minor,
        'currency', v_rule.currency,
        'description', v_rule.name,
        'merchant', v_rule.merchant,
        'category_id', v_rule.category_id,
        'account_id', v_rule.account_id,
        'to_account_id', v_rule.to_account_id,
        'payer_participant_id', v_rule.payer_participant_id,
        'split_mode', v_rule.split_mode,
        'participants', nido._split_config_to_participants(v_rule.split_config),
        'recurring_rule_id', v_rule.id,
        'notes', v_rule.notes
      );

      begin
        perform nido.create_transaction(v_params);
        v_created := v_created + 1;
      exception
        when unique_violation then
          null; -- concurrent materialize; treat as already done
      end;
    end if;

    v_next := nido.next_occurrence(v_rule, v_run_on);
    update nido.recurring_rules
    set last_run_on = v_run_on,
        next_run_on = coalesce(v_next, v_run_on + 1)
    where id = v_rule.id;

    select * into v_rule from nido.recurring_rules where id = p_rule_id;
    v_run_on := v_rule.next_run_on;

    if v_next is null then
      update nido.recurring_rules
      set is_active = false
      where id = v_rule.id;
      exit;
    end if;
  end loop;

  if v_prev_uid is not null then
    perform set_config('request.jwt.claim.sub', v_prev_uid, true);
  end if;
  if v_prev_claims is not null then
    perform set_config('request.jwt.claims', v_prev_claims, true);
  end if;

  return v_created;
end;
$$;

revoke all on function nido.materialize_recurring(uuid, date) from public;
grant execute on function nido.materialize_recurring(uuid, date) to authenticated, service_role;

-- ---------------------------------------------------------------------------------------
-- Candidate + ghost detection
-- ---------------------------------------------------------------------------------------

create or replace function nido.normalize_merchant(p_merchant text)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(
    lower(trim(regexp_replace(coalesce(p_merchant, ''), '\s+', ' ', 'g'))),
    ''
  );
$$;

create or replace function nido.detect_recurring_candidates(p_space_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb := '[]'::jsonb;
begin
  if auth.role() is distinct from 'service_role' and not nido.is_member(p_space_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  with base as (
    select
      t.id,
      t.booked_on,
      t.amount_minor,
      t.currency,
      t.category_id,
      t.account_id,
      t.payer_participant_id,
      t.split_mode,
      t.merchant,
      nido.normalize_merchant(t.merchant) as merchant_key
    from nido.transactions t
    where t.space_id = p_space_id
      and t.deleted_at is null
      and t.kind = 'expense'
      and t.recurring_rule_id is null
      and nido.normalize_merchant(t.merchant) is not null
  ),
  ranked as (
    select
      b.*,
      lag(b.booked_on) over (
        partition by b.merchant_key, b.currency
        order by b.booked_on, b.id
      ) as prev_on
    from base b
  ),
  gaps as (
    select
      r.*,
      case when r.prev_on is null then null else (r.booked_on - r.prev_on) end as gap_days
    from ranked r
  ),
  grouped as (
    select
      merchant_key,
      currency,
      count(*)::int as tx_count,
      (array_agg(amount_minor order by booked_on, id))[1] as sample_amount,
      avg(amount_minor)::bigint as avg_amount,
      min(booked_on) as first_on,
      max(booked_on) as last_on,
      avg(gap_days) filter (where gap_days is not null) as avg_gap,
      stddev_pop(gap_days) filter (where gap_days is not null) as gap_stddev,
      jsonb_agg(id order by booked_on, id) as transaction_ids,
      (array_agg(category_id order by booked_on, id))[1] as category_id,
      (array_agg(account_id order by booked_on, id))[1] as account_id,
      (array_agg(payer_participant_id order by booked_on, id))[1] as payer_participant_id,
      (array_agg(split_mode order by booked_on, id))[1] as split_mode,
      (array_agg(merchant order by booked_on, id))[1] as merchant
    from gaps
    group by merchant_key, currency
  ),
  filtered as (
    select g.*
    from grouped g
    where g.tx_count >= 3
      and g.avg_gap is not null
      and g.avg_gap between 5 and 40
      and coalesce(g.gap_stddev, 0) <= 3
      and not exists (
        select 1
        from gaps x
        where x.merchant_key = g.merchant_key
          and x.currency = g.currency
          and abs(x.amount_minor - g.avg_amount)::numeric > g.avg_amount::numeric * 0.05
      )
      and not exists (
        select 1 from nido.recurring_rules rr
        where rr.space_id = p_space_id
          and rr.cancelled_at is null
          and nido.normalize_merchant(rr.merchant) = g.merchant_key
          and rr.currency = g.currency
      )
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'merchant', f.merchant,
        'merchant_key', f.merchant_key,
        'currency', f.currency,
        'amount_minor', f.avg_amount,
        'suggested_freq', case
          when f.avg_gap between 25 and 35 then 'month'
          when f.avg_gap between 12 and 16 then 'week'
          when f.avg_gap between 5 and 9 then 'week'
          else 'month'
        end,
        'suggested_interval', case
          when f.avg_gap between 12 and 16 then 2
          else 1
        end,
        'avg_gap_days', round(f.avg_gap::numeric, 2),
        'transaction_ids', f.transaction_ids,
        'category_id', f.category_id,
        'account_id', f.account_id,
        'payer_participant_id', f.payer_participant_id,
        'split_mode', f.split_mode,
        'first_on', f.first_on,
        'last_on', f.last_on,
        'tx_count', f.tx_count
      )
      order by f.tx_count desc, f.merchant_key
    ),
    '[]'::jsonb
  )
  into v_result
  from filtered f;

  return v_result;
end;
$$;

revoke all on function nido.detect_recurring_candidates(uuid) from public;
grant execute on function nido.detect_recurring_candidates(uuid) to authenticated, service_role;

create or replace function nido.detect_ghost_subscriptions(p_space_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_today date := current_date;
begin
  if auth.role() is distinct from 'service_role' and not nido.is_member(p_space_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'rule_id', r.id,
          'name', r.name,
          'merchant', r.merchant,
          'amount_minor', r.amount_minor,
          'currency', r.currency,
          'charge_count', c.charge_count,
          'total_paid_minor', c.total_paid_minor,
          'first_charged_on', c.first_charged_on,
          'last_charged_on', c.last_charged_on,
          'months_active', greatest(
            1,
            (
              (extract(year from age(c.last_charged_on, c.first_charged_on)) * 12)
              + extract(month from age(c.last_charged_on, c.first_charged_on))
            )::int
          ),
          'cancel_url', r.cancel_url
        )
        order by c.total_paid_minor desc
      )
      from nido.recurring_rules r
      join lateral (
        select
          count(*)::int as charge_count,
          coalesce(sum(t.amount_minor), 0)::bigint as total_paid_minor,
          min(t.booked_on) as first_charged_on,
          max(t.booked_on) as last_charged_on
        from nido.transactions t
        where t.recurring_rule_id = r.id
          and t.deleted_at is null
      ) c on true
      where r.space_id = p_space_id
        and r.is_active
        and r.cancelled_at is null
        and r.kind in ('subscription', 'bill')
        and r.marked_in_use_at is null
        and (r.ghost_snoozed_until is null or r.ghost_snoozed_until < v_today)
        and c.charge_count >= 3
        and not exists (
          select 1
          from nido.transactions t2
          where t2.space_id = p_space_id
            and t2.deleted_at is null
            and t2.booked_on >= (v_today - 90)
            and t2.recurring_rule_id is distinct from r.id
            and nido.normalize_merchant(t2.merchant) is not distinct from nido.normalize_merchant(r.merchant)
        )
    ),
    '[]'::jsonb
  );
end;
$$;

revoke all on function nido.detect_ghost_subscriptions(uuid) from public;
grant execute on function nido.detect_ghost_subscriptions(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------------------
-- Daily runner (Edge Function recurring-run)
-- ---------------------------------------------------------------------------------------

create or replace function nido._notify_recurring_due(
  p_rule nido.recurring_rules,
  p_due_on date,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  v_recipient uuid;
begin
  for v_recipient in
    select m.user_id
    from nido.space_members m
    where m.space_id = p_rule.space_id
      and m.status = 'active'
  loop
    perform nido.ensure_default_notification_prefs(p_rule.space_id, v_recipient);
    if exists (
      select 1 from nido.notification_preferences pref
      where pref.user_id = v_recipient
        and pref.space_id = p_rule.space_id
        and pref.kind = 'recurring_due'
        and pref.in_app
    ) and not exists (
      select 1 from nido.notifications n
      where n.space_id = p_rule.space_id
        and n.user_id = v_recipient
        and n.kind = 'recurring_due'
        and n.payload->>'rule_id' = p_rule.id::text
        and n.payload->>'due_on' = p_due_on::text
        and n.payload->>'reason' = p_reason
    ) then
      insert into nido.notifications (space_id, user_id, kind, title, body, payload, link)
      values (
        p_rule.space_id,
        v_recipient,
        'recurring_due',
        case
          when p_reason = 'reminder' then format('%s due soon', p_rule.name)
          else format('%s is due', p_rule.name)
        end,
        format('Scheduled for %s (%s).', p_due_on, p_rule.amount_minor),
        jsonb_build_object(
          'rule_id', p_rule.id,
          'due_on', p_due_on,
          'reason', p_reason,
          'amount_minor', p_rule.amount_minor
        ),
        '/s/' || p_rule.space_id::text || '/subscriptions/' || p_rule.id::text
      );
    end if;
  end loop;
end;
$$;

create or replace function nido.run_recurring_for_space(p_space_id uuid, p_today date default current_date)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rule nido.recurring_rules%rowtype;
  v_created int := 0;
  v_notified int := 0;
  v_n int;
begin
  if auth.role() is distinct from 'service_role'
     and not nido.is_member(p_space_id, array['owner', 'admin', 'member']::nido.member_role[])
  then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  for v_rule in
    select *
    from nido.recurring_rules r
    where r.space_id = p_space_id
      and r.is_active
      and r.cancelled_at is null
    order by r.next_run_on, r.id
  loop
    if v_rule.next_run_on <= p_today then
      if v_rule.auto_create then
        v_n := nido.materialize_recurring(v_rule.id, p_today);
        v_created := v_created + v_n;
      else
        perform nido._notify_recurring_due(v_rule, v_rule.next_run_on, 'due');
        v_notified := v_notified + 1;
      end if;
    elsif v_rule.next_run_on <= (p_today + v_rule.reminder_days_before) then
      perform nido._notify_recurring_due(v_rule, v_rule.next_run_on, 'reminder');
      v_notified := v_notified + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'space_id', p_space_id,
    'created', v_created,
    'notified', v_notified
  );
end;
$$;

create or replace function nido.run_recurring_all(p_today date default current_date)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_space record;
  v_results jsonb := '[]'::jsonb;
  v_one jsonb;
  v_space_today date;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  for v_space in
    select id, timezone from nido.spaces
  loop
    v_space_today := coalesce(
      (timezone(v_space.timezone, now()))::date,
      p_today
    );
    -- Prefer explicit p_today when provided for tests; production cron passes default current_date
    -- but edge function can pass null to use space-local day. When p_today is the default
    -- current_date at call time, still honour space timezone.
    if p_today is not distinct from current_date then
      v_space_today := (timezone(v_space.timezone, now()))::date;
    else
      v_space_today := p_today;
    end if;

    v_one := nido.run_recurring_for_space(v_space.id, v_space_today);
    v_results := v_results || jsonb_build_array(v_one);
  end loop;

  return jsonb_build_object('spaces', v_results);
end;
$$;

revoke all on function nido.run_recurring_for_space(uuid, date) from public;
revoke all on function nido.run_recurring_all(date) from public;
grant execute on function nido.run_recurring_for_space(uuid, date) to authenticated, service_role;
grant execute on function nido.run_recurring_all(date) to service_role;
