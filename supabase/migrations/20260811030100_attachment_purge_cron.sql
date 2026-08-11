/**
 * Weekly attachment purge via pg_cron → attachment-purge Edge Function.
 */
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

do $$
declare
  v_jobid bigint;
begin
  select jobid into v_jobid from cron.job where jobname = 'attachment-purge-weekly' limit 1;
  if v_jobid is not null then
    perform cron.unschedule(v_jobid);
  end if;
end;
$$;

select cron.schedule(
  'attachment-purge-weekly',
  '0 3 * * 0',
  $$
  select net.http_post(
    url := coalesce(
      current_setting('app.settings.supabase_url', true),
      'http://host.docker.internal:54321'
    ) || '/functions/v1/attachment-purge',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || coalesce(current_setting('app.settings.cron_secret', true), 'local-dev-cron')
    ),
    body := '{}'::jsonb
  ) as request_id;
  $$
);
