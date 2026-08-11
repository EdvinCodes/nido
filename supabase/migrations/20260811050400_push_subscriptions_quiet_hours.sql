-- Phase 10 — push subscriptions, quiet hours, notification dispatch hooks.

-- ---------------------------------------------------------------------------------------
-- push_subscriptions
-- ---------------------------------------------------------------------------------------

create table nido.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references nido.profiles (id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  user_agent text,
  created_at timestamptz not null default now()
);

create index push_subscriptions_user_idx on nido.push_subscriptions (user_id);

alter table nido.push_subscriptions enable row level security;

create policy "push_subscriptions_select_own"
  on nido.push_subscriptions for select
  using (user_id = (select auth.uid()));

create policy "push_subscriptions_insert_own"
  on nido.push_subscriptions for insert
  with check (user_id = (select auth.uid()));

create policy "push_subscriptions_update_own"
  on nido.push_subscriptions for update
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "push_subscriptions_delete_own"
  on nido.push_subscriptions for delete
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------------------
-- quiet hours (per user; applies to all spaces)
-- ---------------------------------------------------------------------------------------

create table nido.notification_quiet_hours (
  user_id      uuid primary key references nido.profiles (id) on delete cascade,
  enabled      boolean not null default false,
  start_minute smallint not null default 1320 check (start_minute between 0 and 1439),
  end_minute   smallint not null default 480 check (end_minute between 0 and 1439),
  timezone     text not null default 'UTC',
  updated_at   timestamptz not null default now()
);

alter table nido.notification_quiet_hours enable row level security;

create policy "quiet_hours_select_own"
  on nido.notification_quiet_hours for select
  using (user_id = (select auth.uid()));

create policy "quiet_hours_insert_own"
  on nido.notification_quiet_hours for insert
  with check (user_id = (select auth.uid()));

create policy "quiet_hours_update_own"
  on nido.notification_quiet_hours for update
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "quiet_hours_delete_own"
  on nido.notification_quiet_hours for delete
  using (user_id = (select auth.uid()));

-- Queued push deliveries suppressed during quiet hours.
create table nido.push_delivery_queue (
  id              uuid primary key default gen_random_uuid(),
  notification_id uuid not null references nido.notifications (id) on delete cascade,
  user_id         uuid not null references nido.profiles (id) on delete cascade,
  deliver_after   timestamptz not null,
  created_at      timestamptz not null default now(),
  unique (notification_id, user_id)
);

create index push_delivery_queue_deliver_after_idx
  on nido.push_delivery_queue (deliver_after);

alter table nido.push_delivery_queue enable row level security;

create policy "push_queue_select_own"
  on nido.push_delivery_queue for select
  using (user_id = (select auth.uid()));

-- Writes only via security definer functions / service role.
create policy "push_queue_insert_deny"
  on nido.push_delivery_queue for insert
  with check (false);

create policy "push_queue_update_deny"
  on nido.push_delivery_queue for update
  using (false);

create policy "push_queue_delete_deny"
  on nido.push_delivery_queue for delete
  using (false);

-- Track outbound channels on notifications.
alter table nido.notifications
  add column if not exists push_sent_at timestamptz,
  add column if not exists email_sent_at timestamptz;

-- ---------------------------------------------------------------------------------------
-- Dispatch helpers
-- ---------------------------------------------------------------------------------------

create or replace function nido.is_in_quiet_hours(p_user_id uuid, p_at timestamptz default now())
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_qh record;
  v_local time;
  v_minute int;
begin
  select * into v_qh
  from nido.notification_quiet_hours
  where user_id = p_user_id and enabled;

  if not found then
    return false;
  end if;

  v_local := (p_at at time zone v_qh.timezone)::time;
  v_minute := extract(hour from v_local)::int * 60 + extract(minute from v_local)::int;

  if v_qh.start_minute <= v_qh.end_minute then
    return v_minute >= v_qh.start_minute and v_minute < v_qh.end_minute;
  end if;

  -- Overnight window (e.g. 22:00 – 08:00).
  return v_minute >= v_qh.start_minute or v_minute < v_qh.end_minute;
end;
$$;

create or replace function nido.quiet_hours_end_at(p_user_id uuid, p_at timestamptz default now())
returns timestamptz
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_qh record;
  v_local timestamp;
  v_end timestamp;
  v_minute int;
begin
  select * into v_qh
  from nido.notification_quiet_hours
  where user_id = p_user_id and enabled;

  if not found then
    return p_at;
  end if;

  v_local := (p_at at time zone v_qh.timezone)::timestamp;
  v_end := date_trunc('day', v_local)
    + (v_qh.end_minute || ' minutes')::interval;

  if v_end <= v_local then
    v_end := v_end + interval '1 day';
  end if;

  return v_end at time zone v_qh.timezone;
end;
$$;

create or replace function nido.tg_dispatch_notification_channels()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
begin
  v_url := coalesce(
    current_setting('app.settings.supabase_url', true),
    'http://host.docker.internal:54321'
  );
  v_secret := coalesce(current_setting('app.settings.cron_secret', true), 'local-dev-cron');

  perform net.http_post(
    url := v_url || '/functions/v1/push-send',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_secret
    ),
    body := jsonb_build_object('notification_id', NEW.id)
  );

  perform net.http_post(
    url := v_url || '/functions/v1/email-send',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_secret
    ),
    body := jsonb_build_object('notification_id', NEW.id)
  );

  return NEW;
end;
$$;

create trigger notifications_dispatch_channels
  after insert on nido.notifications
  for each row
  execute function nido.tg_dispatch_notification_channels();

-- Flush queued push notifications every 5 minutes.
select cron.schedule(
  'push-queue-flush',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := coalesce(
      current_setting('app.settings.supabase_url', true),
      'http://host.docker.internal:54321'
    ) || '/functions/v1/push-send',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || coalesce(current_setting('app.settings.cron_secret', true), 'local-dev-cron')
    ),
    body := '{"flush_queue": true}'::jsonb
  ) as request_id;
  $$
);

revoke all on function nido.is_in_quiet_hours(uuid, timestamptz) from public;
grant execute on function nido.is_in_quiet_hours(uuid, timestamptz) to authenticated, service_role;

revoke all on function nido.quiet_hours_end_at(uuid, timestamptz) from public;
grant execute on function nido.quiet_hours_end_at(uuid, timestamptz) to authenticated, service_role;

grant select, insert, update, delete on nido.push_subscriptions to authenticated, service_role;
grant select, insert, update, delete on nido.notification_quiet_hours to authenticated, service_role;
grant select on nido.push_delivery_queue to authenticated, service_role;
