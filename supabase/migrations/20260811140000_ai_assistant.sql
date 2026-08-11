-- Phase 12 — AI assistant tables, consent, RLS, and tool RPCs.

-- ---------------------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------------------

create table nido.ai_conversations (
  id         uuid primary key default gen_random_uuid(),
  space_id   uuid not null references nido.spaces(id) on delete cascade,
  user_id    uuid not null references nido.profiles(id) on delete cascade,
  title      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index ai_conversations_space_user_idx
  on nido.ai_conversations (space_id, user_id, updated_at desc);

create table nido.ai_messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references nido.ai_conversations(id) on delete cascade,
  space_id        uuid not null references nido.spaces(id) on delete cascade,
  role            text not null check (role in ('user', 'assistant', 'tool', 'system')),
  content         jsonb not null,
  tool_calls      jsonb,
  token_usage     jsonb,
  created_at      timestamptz not null default now()
);

create index ai_messages_conversation_idx
  on nido.ai_messages (conversation_id, created_at asc);

create table nido.ai_insights (
  id                     uuid primary key default gen_random_uuid(),
  space_id               uuid not null references nido.spaces(id) on delete cascade,
  kind                   text not null,
  title                  text not null,
  body                   text not null,
  severity               text not null default 'info'
    check (severity in ('info', 'warning', 'critical')),
  evidence               jsonb not null default '{}'::jsonb,
  potential_saving_minor bigint,
  subject_key            text,
  dismissed_at           timestamptz,
  dismissed_by           uuid references nido.profiles(id) on delete set null,
  created_at             timestamptz not null default now()
);

create index ai_insights_space_active_idx
  on nido.ai_insights (space_id, created_at desc)
  where dismissed_at is null;

create table nido.ai_consent (
  space_id        uuid primary key references nido.spaces(id) on delete cascade,
  consented_by    uuid not null references nido.profiles(id),
  consented_at    timestamptz not null default now(),
  provider        text not null,
  consent_text    text not null,
  use_real_names  boolean not null default false,
  retention_days  integer not null default 90 check (retention_days between 7 and 365),
  revoked_at      timestamptz,
  revoked_by      uuid references nido.profiles(id) on delete set null
);

comment on table nido.ai_consent is
  'Per-space opt-in for the AI assistant. Revoking deletes conversations.';

-- ---------------------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------------------

alter table nido.ai_conversations enable row level security;
alter table nido.ai_messages enable row level security;
alter table nido.ai_insights enable row level security;
alter table nido.ai_consent enable row level security;

create policy "select own conversations"
  on nido.ai_conversations for select
  using (
    user_id = (select auth.uid())
    and nido.is_member(space_id)
  );

create policy "insert own conversations"
  on nido.ai_conversations for insert
  with check (
    user_id = (select auth.uid())
    and nido.is_member(space_id)
  );

create policy "update own conversations"
  on nido.ai_conversations for update
  using (user_id = (select auth.uid()));

create policy "delete own conversations"
  on nido.ai_conversations for delete
  using (user_id = (select auth.uid()));

create policy "select own messages"
  on nido.ai_messages for select
  using (
    exists (
      select 1
      from nido.ai_conversations c
      where c.id = conversation_id
        and c.user_id = (select auth.uid())
    )
  );

create policy "insert own messages"
  on nido.ai_messages for insert
  with check (
    exists (
      select 1
      from nido.ai_conversations c
      where c.id = conversation_id
        and c.user_id = (select auth.uid())
        and c.space_id = space_id
    )
  );

create policy "delete own messages"
  on nido.ai_messages for delete
  using (
    exists (
      select 1
      from nido.ai_conversations c
      where c.id = conversation_id
        and c.user_id = (select auth.uid())
    )
  );

create policy "read insights for members"
  on nido.ai_insights for select
  using (nido.is_member(space_id));

create policy "dismiss insights for members"
  on nido.ai_insights for update
  using (nido.is_member(space_id))
  with check (nido.is_member(space_id));

create policy "insert insights service role only"
  on nido.ai_insights for insert
  with check (auth.role() = 'service_role');

create policy "read consent for members"
  on nido.ai_consent for select
  using (nido.is_member(space_id));

create policy "manage consent for admins"
  on nido.ai_consent for insert
  with check (
    nido.is_member(space_id, array['owner', 'admin']::nido.member_role[])
    and consented_by = (select auth.uid())
  );

create policy "update consent for admins"
  on nido.ai_consent for update
  using (nido.is_member(space_id, array['owner', 'admin']::nido.member_role[]));

-- ---------------------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------------------

grant select, insert, update, delete on nido.ai_conversations to authenticated, service_role;
grant select, insert, delete on nido.ai_messages to authenticated, service_role;
grant select, update on nido.ai_insights to authenticated;
grant select, insert, update, delete on nido.ai_insights to service_role;
grant select, insert, update on nido.ai_consent to authenticated, service_role;

-- ---------------------------------------------------------------------------------------
-- ai_filter_transactions — filtered ledger rows for assistant tools (limit ≤ 50)
-- ---------------------------------------------------------------------------------------

create or replace function nido.ai_filter_transactions(
  p_space_id uuid,
  p_from date default null,
  p_to date default null,
  p_category_id uuid default null,
  p_participant_id uuid default null,
  p_merchant text default null,
  p_text text default null,
  p_amount_min_minor bigint default null,
  p_amount_max_minor bigint default null,
  p_limit integer default 50
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit, 50), 50));
  v_result jsonb;
begin
  if auth.role() is distinct from 'service_role' and not nido.is_member(p_space_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', t.id,
        'booked_on', t.booked_on,
        'kind', t.kind,
        'amount_minor', t.base_amount_minor,
        'currency', (select s.base_currency from nido.spaces s where s.id = p_space_id),
        'merchant', t.merchant,
        'description', t.description,
        'category_id', t.category_id,
        'category_name', c.name,
        'payer_participant_id', t.payer_participant_id
      )
      order by t.booked_on desc, t.id desc
    ),
    '[]'::jsonb
  )
    into v_result
  from (
    select t.*
    from nido.transactions t
    where t.space_id = p_space_id
      and t.deleted_at is null
      and t.kind in ('income', 'expense')
      and (p_from is null or t.booked_on >= p_from)
      and (p_to is null or t.booked_on <= p_to)
      and (p_category_id is null or t.category_id = p_category_id)
      and (p_participant_id is null or t.payer_participant_id = p_participant_id)
      and (p_merchant is null or t.merchant ilike '%' || p_merchant || '%')
      and (
        p_text is null
        or to_tsvector(
          'simple',
          coalesce(t.description, '') || ' ' || coalesce(t.merchant, '') || ' ' || coalesce(t.notes, '')
        ) @@ websearch_to_tsquery('simple', p_text)
      )
      and (p_amount_min_minor is null or t.base_amount_minor >= p_amount_min_minor)
      and (p_amount_max_minor is null or t.base_amount_minor <= p_amount_max_minor)
    order by t.booked_on desc, t.id desc
    limit v_limit
  ) t
  left join nido.categories c on c.id = t.category_id;

  return v_result;
end;
$$;

revoke all on function nido.ai_filter_transactions(uuid, date, date, uuid, uuid, text, text, bigint, bigint, integer) from public;
grant execute on function nido.ai_filter_transactions(uuid, date, date, uuid, uuid, text, text, bigint, bigint, integer)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------------------
-- ai_period_transaction_ids — backing ids for aggregate citations
-- ---------------------------------------------------------------------------------------

create or replace function nido.ai_period_transaction_ids(
  p_space_id uuid,
  p_from date,
  p_to date,
  p_participant_id uuid default null,
  p_category_id uuid default null,
  p_kind text default null,
  p_limit integer default 200
)
returns uuid[]
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit, 200), 500));
  v_ids uuid[];
begin
  if auth.role() is distinct from 'service_role' and not nido.is_member(p_space_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select coalesce(array_agg(t.id order by t.booked_on desc, t.id desc), '{}'::uuid[])
    into v_ids
  from (
    select t.id, t.booked_on
    from nido.transactions t
    where t.space_id = p_space_id
      and t.deleted_at is null
      and t.kind in ('income', 'expense')
      and t.booked_on between p_from and p_to
      and (p_participant_id is null or t.payer_participant_id = p_participant_id)
      and (p_category_id is null or t.category_id = p_category_id)
      and (p_kind is null or t.kind = p_kind)
    order by t.booked_on desc, t.id desc
    limit v_limit
  ) t;

  return v_ids;
end;
$$;

revoke all on function nido.ai_period_transaction_ids(uuid, date, date, uuid, uuid, text, integer) from public;
grant execute on function nido.ai_period_transaction_ids(uuid, date, date, uuid, uuid, text, integer)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------------------
-- ai_find_anomalies — MAD-based category and transaction outliers
-- ---------------------------------------------------------------------------------------

create or replace function nido.ai_find_anomalies(
  p_space_id uuid,
  p_from date,
  p_to date,
  p_sensitivity numeric default 3
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_sensitivity numeric := greatest(1.5, least(coalesce(p_sensitivity, 3), 6));
  v_result jsonb;
begin
  if auth.role() is distinct from 'service_role' and not nido.is_member(p_space_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  with expenses as (
    select
      t.id,
      t.booked_on,
      t.base_amount_minor,
      t.category_id,
      c.name as category_name,
      t.merchant
    from nido.transactions t
    left join nido.categories c on c.id = t.category_id
    where t.space_id = p_space_id
      and t.deleted_at is null
      and t.kind = 'expense'
      and t.booked_on between p_from and p_to
  ),
  cat_medians as (
    select
      category_id,
      category_name,
      percentile_cont(0.5) within group (order by base_amount_minor) as median_amount
    from expenses
    group by category_id, category_name
  ),
  cat_stats as (
    select
      m.category_id,
      m.category_name,
      m.median_amount,
      percentile_cont(0.5) within group (order by abs(e.base_amount_minor - m.median_amount)) as mad
    from cat_medians m
    join expenses e on e.category_id is not distinct from m.category_id
    group by m.category_id, m.category_name, m.median_amount
  ),
  tx_outliers as (
    select
      e.id,
      e.booked_on,
      e.base_amount_minor,
      e.category_id,
      e.category_name,
      e.merchant,
      'transaction'::text as anomaly_type
    from expenses e
    join cat_stats s on s.category_id is not distinct from e.category_id
    where s.mad > 0
      and abs(e.base_amount_minor - s.median_amount) > v_sensitivity * s.mad
  ),
  period_totals as (
    select
      category_id,
      category_name,
      sum(base_amount_minor)::bigint as total_minor,
      count(*)::integer as tx_count
    from expenses
    group by category_id, category_name
  ),
  prev_totals as (
    select
      t.category_id,
      sum(t.base_amount_minor)::bigint as prev_total_minor
    from nido.transactions t
    where t.space_id = p_space_id
      and t.deleted_at is null
      and t.kind = 'expense'
      and t.booked_on between (p_from - ((p_to - p_from) + 1)) and (p_from - 1)
    group by t.category_id
  ),
  cat_spikes as (
    select
      null::uuid as id,
      p_to as booked_on,
      (p.total_minor - coalesce(pr.prev_total_minor, 0)) as base_amount_minor,
      p.category_id,
      p.category_name,
      null::text as merchant,
      'category_spike'::text as anomaly_type
    from period_totals p
    left join prev_totals pr on pr.category_id is not distinct from p.category_id
    where p.total_minor > 0
      and coalesce(pr.prev_total_minor, 0) > 0
      and p.total_minor::numeric / pr.prev_total_minor::numeric >= (1 + v_sensitivity / 10)
  ),
  combined as (
    select * from tx_outliers
    union all
    select * from cat_spikes
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'type', anomaly_type,
        'transaction_id', id,
        'booked_on', booked_on,
        'amount_minor', base_amount_minor,
        'category_id', category_id,
        'category_name', category_name,
        'merchant', merchant
      )
      order by booked_on desc
    ),
    '[]'::jsonb
  )
    into v_result
  from (select * from combined limit 50) combined;

  return v_result;
end;
$$;

revoke all on function nido.ai_find_anomalies(uuid, date, date, numeric) from public;
grant execute on function nido.ai_find_anomalies(uuid, date, date, numeric) to authenticated, service_role;

-- ---------------------------------------------------------------------------------------
-- ai_revoke_consent — delete conversations and mark consent revoked
-- ---------------------------------------------------------------------------------------

create or replace function nido.ai_revoke_consent(p_space_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not nido.is_member(p_space_id, array['owner', 'admin']::nido.member_role[]) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  delete from nido.ai_conversations where space_id = p_space_id;

  update nido.ai_consent
  set
    revoked_at = now(),
    revoked_by = (select auth.uid())
  where space_id = p_space_id
    and revoked_at is null;
end;
$$;

revoke all on function nido.ai_revoke_consent(uuid) from public;
grant execute on function nido.ai_revoke_consent(uuid) to authenticated;

-- ---------------------------------------------------------------------------------------
-- ai_prune_old_conversations — retention cleanup (called by cron)
-- ---------------------------------------------------------------------------------------

create or replace function nido.ai_prune_old_conversations()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted integer := 0;
begin
  with doomed as (
    select c.id
    from nido.ai_conversations c
    join nido.ai_consent ac on ac.space_id = c.space_id
    where ac.revoked_at is null
      and c.created_at < now() - make_interval(days => ac.retention_days)
  )
  delete from nido.ai_conversations c
  using doomed d
  where c.id = d.id;

  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke all on function nido.ai_prune_old_conversations() from public;
grant execute on function nido.ai_prune_old_conversations() to service_role;
