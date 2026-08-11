-- Phase 09 — cron schedules for fx-refresh and period-close Edge Functions.

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

do $$
declare
  v_jobid bigint;
begin
  select jobid into v_jobid from cron.job where jobname = 'fx-refresh-daily' limit 1;
  if v_jobid is not null then
    perform cron.unschedule(v_jobid);
  end if;

  select jobid into v_jobid from cron.job where jobname = 'period-close-daily' limit 1;
  if v_jobid is not null then
    perform cron.unschedule(v_jobid);
  end if;
end;
$$;

select cron.schedule(
  'fx-refresh-daily',
  '15 6 * * *',
  $$
  select net.http_post(
    url := coalesce(
      current_setting('app.settings.supabase_url', true),
      'http://host.docker.internal:54321'
    ) || '/functions/v1/fx-refresh',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || coalesce(current_setting('app.settings.cron_secret', true), 'local-dev-cron')
    ),
    body := '{}'::jsonb
  ) as request_id;
  $$
);

select cron.schedule(
  'period-close-daily',
  '0 7 * * *',
  $$
  select net.http_post(
    url := coalesce(
      current_setting('app.settings.supabase_url', true),
      'http://host.docker.internal:54321'
    ) || '/functions/v1/period-close',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || coalesce(current_setting('app.settings.cron_secret', true), 'local-dev-cron')
    ),
    body := '{}'::jsonb
  ) as request_id;
  $$
);
