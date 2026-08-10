-- Phase 03 — dashboard analytics RPCs, FTS search, and profile period defaults.
-- See docs/phases/PHASE-03-dashboard.md and docs/02-DATA-MODEL.md §15.

-- Allow service_role to read balances when aggregating cached dashboard summaries
-- after an application-layer membership check.
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

  if auth.role() is distinct from 'service_role' and not nido.is_member(v_space_id) then
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

-- ---------------------------------------------------------------------------------------
-- Profile: persist the global period picker default
-- ---------------------------------------------------------------------------------------

alter table nido.profiles
  add column if not exists default_period_preset text not null default 'this_month'
    check (
      default_period_preset in (
        'this_month',
        'last_month',
        'last_3_months',
        'this_year',
        'last_year',
        'custom'
      )
    ),
  add column if not exists default_period_from date,
  add column if not exists default_period_to date;

comment on column nido.profiles.default_period_preset is
  'Last period preset chosen in the global PeriodPicker; restored on next visit.';
comment on column nido.profiles.default_period_from is
  'Inclusive custom range start when default_period_preset = custom.';
comment on column nido.profiles.default_period_to is
  'Inclusive custom range end when default_period_preset = custom.';

-- ---------------------------------------------------------------------------------------
-- search_transactions — GIN FTS for ⌘K
-- ---------------------------------------------------------------------------------------

create or replace function nido.search_transactions(
  p_space_id uuid,
  p_query text,
  p_limit integer default 20
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_q text := trim(coalesce(p_query, ''));
  v_limit integer := greatest(1, least(coalesce(p_limit, 20), 50));
  v_result jsonb;
begin
  -- Members via JWT, or service_role for Next.js unstable_cache after a membership check.
  if auth.role() is distinct from 'service_role' and not nido.is_member(p_space_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if char_length(v_q) < 1 then
    return '[]'::jsonb;
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', t.id,
        'booked_on', t.booked_on,
        'kind', t.kind,
        'description', t.description,
        'merchant', t.merchant,
        'amount_minor', t.amount_minor,
        'base_amount_minor', t.base_amount_minor,
        'currency', t.currency,
        'category_id', t.category_id
      )
      order by t.booked_on desc, t.id desc
    ),
    '[]'::jsonb
  )
    into v_result
  from (
    select
      t.id,
      t.booked_on,
      t.kind,
      t.description,
      t.merchant,
      t.amount_minor,
      t.base_amount_minor,
      t.currency,
      t.category_id
    from nido.transactions t
    where t.space_id = p_space_id
      and t.deleted_at is null
      and to_tsvector(
        'simple',
        coalesce(t.description, '') || ' ' || coalesce(t.merchant, '') || ' ' || coalesce(t.notes, '')
      ) @@ websearch_to_tsquery('simple', v_q)
    order by t.booked_on desc, t.id desc
    limit v_limit
  ) t;

  return v_result;
end;
$$;

comment on function nido.search_transactions(uuid, text, integer) is
  'Full-text search over description/merchant/notes for the command palette.';

revoke all on function nido.search_transactions(uuid, text, integer) from public;
grant execute on function nido.search_transactions(uuid, text, integer) to authenticated, service_role;

-- ---------------------------------------------------------------------------------------
-- space_series — bucketed income/expense with gap-filled buckets
-- ---------------------------------------------------------------------------------------

create or replace function nido.space_series(
  p_space_id uuid,
  p_from date,
  p_to date,
  p_granularity text default 'day'
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_granularity text := lower(coalesce(p_granularity, 'day'));
  v_result jsonb;
begin
  if auth.role() is distinct from 'service_role' and not nido.is_member(p_space_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if p_from is null or p_to is null or p_from > p_to then
    raise exception 'invalid date range' using errcode = '22023';
  end if;

  if v_granularity not in ('day', 'week', 'month') then
    raise exception 'invalid granularity' using errcode = '22023';
  end if;

  with bounds as (
    select
      case v_granularity
        when 'day' then p_from
        when 'week' then date_trunc('week', p_from::timestamp)::date
        else date_trunc('month', p_from::timestamp)::date
      end as series_start,
      case v_granularity
        when 'day' then p_to
        when 'week' then date_trunc('week', p_to::timestamp)::date
        else date_trunc('month', p_to::timestamp)::date
      end as series_end
  ),
  buckets as (
    select d::date as bucket_start
    from bounds b
    cross join lateral generate_series(
      b.series_start::timestamp,
      b.series_end::timestamp,
      case v_granularity
        when 'day' then interval '1 day'
        when 'week' then interval '1 week'
        else interval '1 month'
      end
    ) as d
  ),
  keyed as (
    select
      case v_granularity
        when 'day' then t.booked_on
        when 'week' then date_trunc('week', t.booked_on::timestamp)::date
        else date_trunc('month', t.booked_on::timestamp)::date
      end as bucket_start,
      case when t.kind = 'income' then t.base_amount_minor else 0 end as income_minor,
      case when t.kind = 'expense' then t.base_amount_minor else 0 end as expense_minor
    from nido.transactions t
    where t.space_id = p_space_id
      and t.deleted_at is null
      and t.kind in ('income', 'expense')
      and t.booked_on between p_from and p_to
  ),
  aggregated as (
    select
      bucket_start,
      coalesce(sum(income_minor), 0)::bigint as income_minor,
      coalesce(sum(expense_minor), 0)::bigint as expense_minor
    from keyed
    group by bucket_start
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'bucket_start', b.bucket_start,
        'income_minor', coalesce(a.income_minor, 0),
        'expense_minor', coalesce(a.expense_minor, 0),
        'net_minor', coalesce(a.income_minor, 0) - coalesce(a.expense_minor, 0)
      )
      order by b.bucket_start
    ),
    '[]'::jsonb
  )
    into v_result
  from buckets b
  left join aggregated a on a.bucket_start = b.bucket_start;

  return v_result;
end;
$$;

comment on function nido.space_series(uuid, date, date, text) is
  'Income/expense time series bucketed by day, week, or month with empty buckets filled.';

revoke all on function nido.space_series(uuid, date, date, text) from public;
grant execute on function nido.space_series(uuid, date, date, text) to authenticated, service_role;

-- ---------------------------------------------------------------------------------------
-- space_summary — one JSON document for the dashboard
-- ---------------------------------------------------------------------------------------

create or replace function nido.space_summary(
  p_space_id uuid,
  p_from date,
  p_to date,
  p_participant_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_prev_from date;
  v_prev_to date;
  v_days integer;
  v_result jsonb;
begin
  if auth.role() is distinct from 'service_role' and not nido.is_member(p_space_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if p_from is null or p_to is null or p_from > p_to then
    raise exception 'invalid date range' using errcode = '22023';
  end if;

  v_days := (p_to - p_from) + 1;
  v_prev_to := p_from - 1;
  v_prev_from := v_prev_to - (v_days - 1);

  with
  scoped as (
    select t.*
    from nido.transactions t
    where t.space_id = p_space_id
      and t.deleted_at is null
      and t.kind in ('income', 'expense')
      and (
        p_participant_id is null
        or t.payer_participant_id = p_participant_id
        or exists (
          select 1
          from nido.transaction_splits s
          where s.transaction_id = t.id
            and s.participant_id = p_participant_id
        )
      )
  ),
  current_rows as (
    select * from scoped where booked_on between p_from and p_to
  ),
  previous_rows as (
    select * from scoped where booked_on between v_prev_from and v_prev_to
  ),
  current_totals as (
    select
      coalesce(sum(case when kind = 'income' then base_amount_minor else 0 end), 0)::bigint as income_minor,
      coalesce(sum(case when kind = 'expense' then base_amount_minor else 0 end), 0)::bigint as expense_minor,
      count(*)::integer as transaction_count
    from current_rows
  ),
  previous_totals as (
    select
      coalesce(sum(case when kind = 'income' then base_amount_minor else 0 end), 0)::bigint as income_minor,
      coalesce(sum(case when kind = 'expense' then base_amount_minor else 0 end), 0)::bigint as expense_minor,
      count(*)::integer as transaction_count
    from previous_rows
  ),
  totals_json as (
    select jsonb_build_object(
      'income_minor', c.income_minor,
      'expense_minor', c.expense_minor,
      'net_minor', c.income_minor - c.expense_minor,
      'transaction_count', c.transaction_count,
      'savings_rate',
        case
          when c.income_minor = 0 then null
          else round(((c.income_minor - c.expense_minor)::numeric / c.income_minor::numeric), 6)
        end
    ) as current_totals,
    jsonb_build_object(
      'income_minor', p.income_minor,
      'expense_minor', p.expense_minor,
      'net_minor', p.income_minor - p.expense_minor,
      'transaction_count', p.transaction_count,
      'savings_rate',
        case
          when p.income_minor = 0 then null
          else round(((p.income_minor - p.expense_minor)::numeric / p.income_minor::numeric), 6)
        end
    ) as previous_totals
    from current_totals c
    cross join previous_totals p
  ),
  day_spine as (
    select d::date as day
    from generate_series(p_from::timestamp, p_to::timestamp, interval '1 day') as d
  ),
  day_agg as (
    select
      booked_on as day,
      coalesce(sum(case when kind = 'income' then base_amount_minor else 0 end), 0)::bigint as income_minor,
      coalesce(sum(case when kind = 'expense' then base_amount_minor else 0 end), 0)::bigint as expense_minor
    from current_rows
    group by booked_on
  ),
  daily as (
    select
      s.day,
      coalesce(a.income_minor, 0)::bigint as income_minor,
      coalesce(a.expense_minor, 0)::bigint as expense_minor,
      sum(coalesce(a.income_minor, 0) - coalesce(a.expense_minor, 0))
        over (order by s.day rows between unbounded preceding and current row)::bigint
        as cumulative_net_minor
    from day_spine s
    left join day_agg a on a.day = s.day
  ),
  daily_json as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'date', day,
          'income_minor', income_minor,
          'expense_minor', expense_minor,
          'cumulative_net_minor', cumulative_net_minor
        )
        order by day
      ),
      '[]'::jsonb
    ) as value
    from daily
  ),
  cat_current as (
    select
      c.id,
      c.name,
      c.color,
      c.icon,
      t.kind,
      sum(t.base_amount_minor)::bigint as total_minor,
      count(*)::integer as count
    from current_rows t
    left join nido.categories c on c.id = t.category_id
    group by c.id, c.name, c.color, c.icon, t.kind
  ),
  cat_previous as (
    select
      t.category_id,
      t.kind,
      sum(t.base_amount_minor)::bigint as total_minor
    from previous_rows t
    group by t.category_id, t.kind
  ),
  cat_kind_totals as (
    select kind, sum(total_minor)::bigint as kind_total
    from cat_current
    group by kind
  ),
  categories_json as (
    select jsonb_build_object(
      'expense', coalesce(
        (
          select jsonb_agg(row_json order by (row_json ->> 'total_minor')::bigint desc)
          from (
            select jsonb_build_object(
              'id', cc.id,
              'name', coalesce(cc.name, '—'),
              'color', coalesce(cc.color, '#888888'),
              'icon', coalesce(cc.icon, 'circle'),
              'total_minor', cc.total_minor,
              'share',
                case
                  when kt.kind_total = 0 then 0
                  else round((cc.total_minor::numeric / kt.kind_total::numeric), 6)
                end,
              'count', cc.count,
              'change_minor', cc.total_minor - coalesce(cp.total_minor, 0)
            ) as row_json
            from cat_current cc
            join cat_kind_totals kt on kt.kind = cc.kind
            left join cat_previous cp
              on cp.category_id is not distinct from cc.id
             and cp.kind = cc.kind
            where cc.kind = 'expense'
          ) x
        ),
        '[]'::jsonb
      ),
      'income', coalesce(
        (
          select jsonb_agg(row_json order by (row_json ->> 'total_minor')::bigint desc)
          from (
            select jsonb_build_object(
              'id', cc.id,
              'name', coalesce(cc.name, '—'),
              'color', coalesce(cc.color, '#888888'),
              'icon', coalesce(cc.icon, 'circle'),
              'total_minor', cc.total_minor,
              'share',
                case
                  when kt.kind_total = 0 then 0
                  else round((cc.total_minor::numeric / kt.kind_total::numeric), 6)
                end,
              'count', cc.count,
              'change_minor', cc.total_minor - coalesce(cp.total_minor, 0)
            ) as row_json
            from cat_current cc
            join cat_kind_totals kt on kt.kind = cc.kind
            left join cat_previous cp
              on cp.category_id is not distinct from cc.id
             and cp.kind = cc.kind
            where cc.kind = 'income'
          ) x
        ),
        '[]'::jsonb
      )
    ) as value
  ),
  participant_paid as (
    select
      p.id,
      p.display_name,
      p.color,
      coalesce(sum(t.base_amount_minor), 0)::bigint as paid_minor
    from nido.participants p
    left join current_rows t
      on t.payer_participant_id = p.id
     and t.kind = 'expense'
    where p.space_id = p_space_id
      and p.is_active
    group by p.id, p.display_name, p.color
  ),
  participant_owed as (
    select
      s.participant_id,
      coalesce(sum(s.base_owed_minor), 0)::bigint as owed_minor
    from nido.transaction_splits s
    join current_rows t on t.id = s.transaction_id and t.kind = 'expense'
    group by s.participant_id
  ),
  participants_json as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', pp.id,
          'display_name', pp.display_name,
          'color', pp.color,
          'paid_minor', pp.paid_minor,
          'owed_minor', coalesce(po.owed_minor, 0)
        )
        order by pp.display_name
      ),
      '[]'::jsonb
    ) as value
    from participant_paid pp
    left join participant_owed po on po.participant_id = pp.id
  ),
  merchants_json as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'name', m.name,
          'total_minor', m.total_minor,
          'count', m.count
        )
        order by m.total_minor desc, m.name
      ),
      '[]'::jsonb
    ) as value
    from (
      select
        coalesce(nullif(trim(merchant), ''), '—') as name,
        sum(base_amount_minor)::bigint as total_minor,
        count(*)::integer as count
      from current_rows
      where kind = 'expense'
      group by coalesce(nullif(trim(merchant), ''), '—')
      order by sum(base_amount_minor) desc, 1
      limit 10
    ) m
  ),
  accounts_json as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', a.id,
          'name', a.name,
          'color', a.color,
          'currency', a.currency,
          'include_in_totals', a.include_in_totals,
          'balance_minor', nido.account_balance(a.id)
        )
        order by a.position, a.name
      ),
      '[]'::jsonb
    ) as value
    from nido.accounts a
    where a.space_id = p_space_id
      and a.archived_at is null
  )
  select jsonb_build_object(
    'from', p_from,
    'to', p_to,
    'previous_from', v_prev_from,
    'previous_to', v_prev_to,
    'totals', tj.current_totals,
    'previous_totals', tj.previous_totals,
    'daily', dj.value,
    'categories', cj.value,
    'participants', pj.value,
    'merchants', mj.value,
    'accounts', aj.value
  )
    into v_result
  from totals_json tj
  cross join daily_json dj
  cross join categories_json cj
  cross join participants_json pj
  cross join merchants_json mj
  cross join accounts_json aj;

  return v_result;
end;
$$;

comment on function nido.space_summary(uuid, date, date, uuid) is
  'Single-round-trip dashboard JSON: totals, deltas, daily series, categories, participants, merchants, balances.';

revoke all on function nido.space_summary(uuid, date, date, uuid) from public;
grant execute on function nido.space_summary(uuid, date, date, uuid) to authenticated, service_role;
