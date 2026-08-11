-- Phase 12 — proactive insight detectors (deterministic SQL).

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

  -- Duplicate merchant charges on the same day
  with dupes as (
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
  )
  select v_result || jsonb_build_array(
    jsonb_build_object(
      'kind', 'duplicate_charge',
      'title', 'Duplicate charge',
      'body', format('%s charged %s times on %s', merchant, charge_count, booked_on),
      'severity', 'warning',
      'evidence', jsonb_build_object('transaction_ids', to_jsonb(tx_ids)),
      'potential_saving_minor', total_minor / charge_count,
      'subject_key', merchant || ':' || booked_on::text
    )
  )
    into v_result
  from dupes;

  -- Category spike via ai_find_anomalies (last 30 days)
  with spike as (
    select elem
    from jsonb_array_elements(
      nido.ai_find_anomalies(p_space_id, v_from - 30, v_to, 3)
    ) elem
    where elem->>'type' = 'category_spike'
    limit 1
  )
  select v_result || jsonb_build_array(
    jsonb_build_object(
      'kind', 'category_spike',
      'title', 'Unusual category spike',
      'body', format('Spending in %s looks unusually high this period.', elem->>'category_name'),
      'severity', 'info',
      'evidence', jsonb_build_object(
        'transaction_ids', coalesce(
          (
            select to_jsonb(nido.ai_period_transaction_ids(
              p_space_id,
              v_from - 30,
              v_to,
              null,
              (elem->>'category_id')::uuid,
              'expense',
              50
            ))
          ),
          '[]'::jsonb
        )
      ),
      'subject_key', coalesce(elem->>'category_id', 'unknown')
    )
  )
    into v_result
  from spike;

  return coalesce(v_result, '[]'::jsonb);
end;
$$;

revoke all on function nido.ai_run_insight_detectors(uuid) from public;
grant execute on function nido.ai_run_insight_detectors(uuid) to service_role;

-- Suppress dismissed insight kinds for 60 days
create or replace function nido.ai_insight_is_suppressed(
  p_space_id uuid,
  p_kind text,
  p_subject_key text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from nido.ai_insights i
    where i.space_id = p_space_id
      and i.kind = p_kind
      and coalesce(i.subject_key, '') = coalesce(p_subject_key, '')
      and i.dismissed_at is not null
      and i.dismissed_at > now() - interval '60 days'
  );
$$;

revoke all on function nido.ai_insight_is_suppressed(uuid, text, text) from public;
grant execute on function nido.ai_insight_is_suppressed(uuid, text, text) to service_role;
