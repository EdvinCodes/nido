-- Wave 3 — schedule remaining Edge Functions via pg_cron.
-- URLs and the bearer secret come from GUCs so hosted projects do not hard-code a ref:
--   alter role postgres set app.settings.supabase_url = 'https://<ref>.supabase.co';
--   alter role postgres set app.settings.cron_secret = '<same as CRON_SECRET>';
-- Local fallback: host.docker.internal:54321 + local-dev-cron.

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

do $$
declare
  v_jobid bigint;
  v_name text;
begin
  foreach v_name in array array[
    'budget-alerts-hourly',
    'budget-reconcile-nightly',
    'recurring-run-daily',
    'insights-weekly'
  ]
  loop
    select jobid into v_jobid from cron.job where jobname = v_name limit 1;
    if v_jobid is not null then
      perform cron.unschedule(v_jobid);
    end if;
  end loop;
end;
$$;

select cron.schedule(
  'budget-alerts-hourly',
  '0 * * * *',
  $$
  select net.http_post(
    url := coalesce(
      current_setting('app.settings.supabase_url', true),
      'http://host.docker.internal:54321'
    ) || '/functions/v1/budget-alerts',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || coalesce(current_setting('app.settings.cron_secret', true), 'local-dev-cron')
    ),
    body := '{}'::jsonb
  ) as request_id;
  $$
);

select cron.schedule(
  'budget-reconcile-nightly',
  '15 2 * * *',
  $$
  select net.http_post(
    url := coalesce(
      current_setting('app.settings.supabase_url', true),
      'http://host.docker.internal:54321'
    ) || '/functions/v1/budget-reconcile',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || coalesce(current_setting('app.settings.cron_secret', true), 'local-dev-cron')
    ),
    body := '{}'::jsonb
  ) as request_id;
  $$
);

-- 03:00 UTC. run_recurring_all still resolves "today" in each space timezone and is idempotent.
select cron.schedule(
  'recurring-run-daily',
  '0 3 * * *',
  $$
  select net.http_post(
    url := coalesce(
      current_setting('app.settings.supabase_url', true),
      'http://host.docker.internal:54321'
    ) || '/functions/v1/recurring-run',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || coalesce(current_setting('app.settings.cron_secret', true), 'local-dev-cron')
    ),
    body := '{}'::jsonb
  ) as request_id;
  $$
);

select cron.schedule(
  'insights-weekly',
  '0 8 * * 1',
  $$
  select net.http_post(
    url := coalesce(
      current_setting('app.settings.supabase_url', true),
      'http://host.docker.internal:54321'
    ) || '/functions/v1/insights-weekly',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || coalesce(current_setting('app.settings.cron_secret', true), 'local-dev-cron')
    ),
    body := '{}'::jsonb
  ) as request_id;
  $$
);
