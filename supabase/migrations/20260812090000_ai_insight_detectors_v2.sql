-- Phase 12 follow-up — remaining proactive insight detectors.

create or replace function nido.ai_run_insight_detectors(p_space_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb := '[]'::jsonb;
  v_space record;
  v_from date;
  v_to date;
  v_prev_from date;
  v_prev_to date;
  v_row record;
begin
  if auth.role() is distinct from 'service_role' and not nido.is_member(p_space_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select s.timezone, s.base_currency, s.month_starts_on
    into v_space
  from nido.spaces s
  where s.id = p_space_id;

  if not found then
    return '[]'::jsonb;
  end if;

  v_to := (timezone(v_space.timezone, now()))::date;
  v_from := (date_trunc('month', v_to::timestamp))::date;
  v_prev_to := v_from - 1;
  v_prev_from := (date_trunc('month', v_prev_to::timestamp))::date;

  -- Duplicate merchant charges on the same day
  for v_row in
    select
      t.merchant,
      t.booked_on,
      array_agg(t.id order by t.id) as tx_ids,
      sum(t.base_amount_minor)::bigint as total_minor,
      count(*)::integer as charge_count
    from nido.transactions t
    where t.space_id = p_space_id
      and t.deleted_at is null
      and t.kind = 'expense'
      and t.merchant is not null
      and t.booked_on >= v_from - 30
    group by t.merchant, t.booked_on
    having count(*) > 1
    limit 1
  loop
    v_result := v_result || jsonb_build_array(
      jsonb_build_object(
        'kind', 'duplicate_charge',
        'title', 'Duplicate charge',
        'body', format('%s charged %s times on %s', v_row.merchant, v_row.charge_count, v_row.booked_on),
        'severity', 'warning',
        'evidence', jsonb_build_object('transaction_ids', to_jsonb(v_row.tx_ids)),
        'potential_saving_minor', v_row.total_minor / v_row.charge_count,
        'subject_key', v_row.merchant || ':' || v_row.booked_on::text
      )
    );
  end loop;

  -- Category spike via ai_find_anomalies (last 30 days)
  for v_row in
    select elem
    from jsonb_array_elements(
      nido.ai_find_anomalies(p_space_id, v_from - 30, v_to, 3)
    ) elem
    where elem->>'type' = 'category_spike'
    limit 1
  loop
    v_result := v_result || jsonb_build_array(
      jsonb_build_object(
        'kind', 'category_spike',
        'title', 'Unusual category spike',
        'body', format('Spending in %s looks unusually high this period.', v_row.elem->>'category_name'),
        'severity', 'info',
        'evidence', jsonb_build_object(
          'transaction_ids', coalesce(
            (
              select to_jsonb(nido.ai_period_transaction_ids(
                p_space_id,
                v_from - 30,
                v_to,
                null,
                (v_row.elem->>'category_id')::uuid,
                'expense',
                50
              ))
            ),
            '[]'::jsonb
          )
        ),
        'subject_key', coalesce(v_row.elem->>'category_id', 'unknown')
      )
    );
  end loop;

  -- Subscription price increase
  for v_row in
    select
      r.id as rule_id,
      r.name,
      r.merchant,
      pc.old_amount_minor,
      pc.new_amount_minor,
      pc.detected_on,
      (
        select coalesce(array_agg(x.id), '{}'::uuid[])
        from (
          select t.id
          from nido.transactions t
          where t.recurring_rule_id = r.id
            and t.deleted_at is null
          order by t.booked_on desc
          limit 5
        ) x
      ) as tx_ids
    from nido.recurring_price_changes pc
    join nido.recurring_rules r on r.id = pc.rule_id
    where r.space_id = p_space_id
      and pc.detected_on >= v_from - 60
      and pc.new_amount_minor > pc.old_amount_minor
    order by pc.detected_on desc
    limit 1
  loop
    v_result := v_result || jsonb_build_array(
      jsonb_build_object(
        'kind', 'subscription_price_increase',
        'title', 'Subscription price increase',
        'body', format(
          '%s rose from %s to %s minor units.',
          coalesce(v_row.merchant, v_row.name),
          v_row.old_amount_minor,
          v_row.new_amount_minor
        ),
        'severity', 'warning',
        'evidence', jsonb_build_object('transaction_ids', to_jsonb(v_row.tx_ids)),
        'potential_saving_minor', v_row.new_amount_minor - v_row.old_amount_minor,
        'subject_key', v_row.rule_id::text
      )
    );
  end loop;

  -- Ghost subscriptions (active, no matching spend in 60+ days)
  for v_row in
    select
      r.id as rule_id,
      r.name,
      r.merchant,
      r.amount_minor,
      r.currency,
      max(t.booked_on) as last_used
    from nido.recurring_rules r
    left join nido.transactions t
      on t.recurring_rule_id = r.id
     and t.deleted_at is null
    where r.space_id = p_space_id
      and r.is_active
      and r.cancelled_at is null
      and r.kind = 'subscription'
    group by r.id, r.name, r.merchant, r.amount_minor, r.currency
    having max(t.booked_on) is null or max(t.booked_on) < v_to - 60
    order by r.amount_minor desc
    limit 1
  loop
    v_result := v_result || jsonb_build_array(
      jsonb_build_object(
        'kind', 'ghost_subscription',
        'title', 'Likely unused subscription',
        'body', format(
          '%s looks unused since %s.',
          coalesce(v_row.merchant, v_row.name),
          coalesce(v_row.last_used::text, 'never')
        ),
        'severity', 'info',
        'evidence', jsonb_build_object('transaction_ids', '[]'::jsonb),
        'potential_saving_minor', v_row.amount_minor,
        'subject_key', v_row.rule_id::text
      )
    );
  end loop;

  -- Three consecutive periods over budget
  for v_row in
    select
      b.id as budget_id,
      b.name,
      array_agg(bp.id order by bp.starts_on desc) as period_ids
    from nido.budgets b
    join nido.budget_periods bp on bp.budget_id = b.id
    where b.space_id = p_space_id
      and b.is_active
      and bp.spent_minor > bp.limit_minor
      and bp.starts_on >= v_from - interval '4 months'
    group by b.id, b.name
    having count(*) >= 3
    limit 1
  loop
    v_result := v_result || jsonb_build_array(
      jsonb_build_object(
        'kind', 'budget_over_three_periods',
        'title', 'Budget overrun streak',
        'body', format('%s has been over budget for three consecutive periods.', v_row.name),
        'severity', 'warning',
        'evidence', jsonb_build_object('transaction_ids', '[]'::jsonb, 'budget_id', v_row.budget_id),
        'subject_key', v_row.budget_id::text
      )
    );
  end loop;

  -- Declining savings rate (current month vs previous)
  for v_row in
    select
      cur.summary->'totals'->>'savings_rate' as cur_rate,
      prev.summary->'totals'->>'savings_rate' as prev_rate
    from (
      select nido.space_summary(p_space_id, v_from, v_to, null) as summary
    ) cur,
    (
      select nido.space_summary(p_space_id, v_prev_from, v_prev_to, null) as summary
    ) prev
    where (cur.summary->'totals'->>'savings_rate') is not null
      and (prev.summary->'totals'->>'savings_rate') is not null
      and (cur.summary->'totals'->>'savings_rate')::numeric
          < (prev.summary->'totals'->>'savings_rate')::numeric - 0.05
  loop
    v_result := v_result || jsonb_build_array(
      jsonb_build_object(
        'kind', 'declining_savings_rate',
        'title', 'Savings rate down',
        'body', format(
          'Savings rate fell from %s to %s versus the previous month.',
          v_row.prev_rate,
          v_row.cur_rate
        ),
        'severity', 'info',
        'evidence', jsonb_build_object(
          'transaction_ids', to_jsonb(
            nido.ai_period_transaction_ids(p_space_id, v_from, v_to, null, null, null, 50)
          )
        ),
        'subject_key', 'savings_rate'
      )
    );
  end loop;

  return coalesce(v_result, '[]'::jsonb);
end;
$$;

revoke all on function nido.ai_run_insight_detectors(uuid) from public;
grant execute on function nido.ai_run_insight_detectors(uuid) to service_role;
