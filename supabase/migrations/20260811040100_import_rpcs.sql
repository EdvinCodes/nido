-- Phase 08 — import RPCs: apply_categorization_rules, find_duplicate, commit_import, undo_import.

-- ---------------------------------------------------------------------------------------
-- apply_categorization_rules
-- ---------------------------------------------------------------------------------------

create or replace function nido.apply_categorization_rules(
  p_space_id uuid,
  p_text text,
  p_merchant text
)
returns table(category_id uuid, set_merchant text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_rule record;
  v_field text;
  v_haystack text;
begin
  if not nido.is_member(p_space_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  for v_rule in
    select r.*
    from nido.categorization_rules r
    where r.space_id = p_space_id
    order by r.priority asc, r.created_at asc
  loop
    v_field := case v_rule.field
      when 'merchant' then coalesce(p_merchant, '')
      when 'notes' then coalesce(p_text, '')
      else coalesce(p_text, '')
    end;
    v_haystack := lower(v_field);

    if v_rule.match_type = 'contains'
       and position(lower(v_rule.pattern) in v_haystack) > 0 then
      category_id := v_rule.category_id;
      set_merchant := v_rule.set_merchant;
      return next;
      return;
    elsif v_rule.match_type = 'starts_with'
       and v_haystack like lower(v_rule.pattern) || '%' then
      category_id := v_rule.category_id;
      set_merchant := v_rule.set_merchant;
      return next;
      return;
    elsif v_rule.match_type = 'exact'
       and v_haystack = lower(v_rule.pattern) then
      category_id := v_rule.category_id;
      set_merchant := v_rule.set_merchant;
      return next;
      return;
    elsif v_rule.match_type = 'regex'
       and v_field ~* v_rule.pattern then
      category_id := v_rule.category_id;
      set_merchant := v_rule.set_merchant;
      return next;
      return;
    end if;
  end loop;

  return;
end;
$$;

revoke all on function nido.apply_categorization_rules(uuid, text, text) from public;
grant execute on function nido.apply_categorization_rules(uuid, text, text) to authenticated, service_role;

-- ---------------------------------------------------------------------------------------
-- find_duplicate
-- ---------------------------------------------------------------------------------------

create or replace function nido.find_duplicate(
  p_space_id uuid,
  p_fingerprint text,
  p_booked_on date,
  p_amount bigint,
  p_external_id text default null
)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_match uuid;
begin
  if not nido.is_member(p_space_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if p_external_id is not null and length(trim(p_external_id)) > 0 then
    select t.id into v_match
    from nido.transactions t
    where t.space_id = p_space_id
      and t.external_id = p_external_id
      and t.deleted_at is null
    limit 1;
    if v_match is not null then
      return v_match;
    end if;
  end if;

  select t.id into v_match
  from nido.transactions t
  where t.space_id = p_space_id
    and t.fingerprint = p_fingerprint
    and t.amount_minor = p_amount
    and t.booked_on between p_booked_on - 3 and p_booked_on + 3
    and t.deleted_at is null
  order by abs(t.booked_on - p_booked_on), t.created_at
  limit 1;

  return v_match;
end;
$$;

revoke all on function nido.find_duplicate(uuid, text, date, bigint, text) from public;
grant execute on function nido.find_duplicate(uuid, text, date, bigint, text) to authenticated, service_role;

-- ---------------------------------------------------------------------------------------
-- commit_import
-- ---------------------------------------------------------------------------------------

create or replace function nido.commit_import(p_batch_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_batch nido.import_batches;
  v_uid uuid;
  v_row record;
  v_parsed jsonb;
  v_kind nido.tx_kind;
  v_amount bigint;
  v_result jsonb;
  v_tx_id uuid;
  v_imported int := 0;
  v_skipped int := 0;
  v_payer uuid;
  v_payload jsonb;
begin
  select * into v_batch
  from nido.import_batches
  where id = p_batch_id
  for update;

  if not found then
    raise exception 'import batch not found' using errcode = 'P0002';
  end if;

  v_uid := nido._assert_contributor(v_batch.space_id);

  if v_batch.status = 'committed' then
    raise exception 'import batch already committed' using errcode = 'P0001';
  end if;

  if v_batch.status = 'failed' then
    raise exception 'import batch failed' using errcode = 'P0001';
  end if;

  select p.id into v_payer
  from nido.participants p
  where p.space_id = v_batch.space_id
    and p.user_id = v_uid
    and p.is_active
  order by p.position
  limit 1;

  if v_payer is null then
    select p.id into v_payer
    from nido.participants p
    where p.space_id = v_batch.space_id and p.is_active
    order by p.position
    limit 1;
  end if;

  for v_row in
    select *
    from nido.import_rows
    where batch_id = p_batch_id
    order by created_at nulls last, id
  loop
    if v_row.decision = 'skip' or v_row.decision = 'duplicate' then
      v_skipped := v_skipped + 1;
      continue;
    end if;

    if v_row.decision <> 'import' then
      continue;
    end if;

    v_parsed := v_row.parsed;
    if v_parsed is null then
      raise exception 'import row % has no parsed data', v_row.id using errcode = '22023';
    end if;

    v_kind := coalesce((v_parsed ->> 'kind')::nido.tx_kind, 'expense');
    v_amount := (v_parsed ->> 'amount_minor')::bigint;

    if v_amount is null or v_amount <= 0 then
      raise exception 'import row % has invalid amount', v_row.id using errcode = '22023';
    end if;

    v_payload := jsonb_build_object(
      'space_id', v_batch.space_id,
      'kind', v_kind,
      'booked_on', v_parsed ->> 'booked_on',
      'amount_minor', v_amount,
      'currency', coalesce(v_parsed ->> 'currency', (
        select s.base_currency::text from nido.spaces s where s.id = v_batch.space_id
      )),
      'description', coalesce(v_parsed ->> 'description', ''),
      'merchant', nullif(v_parsed ->> 'merchant', ''),
      'notes', nullif(v_parsed ->> 'notes', ''),
      'category_id', nullif(v_parsed ->> 'category_id', ''),
      'account_id', coalesce(nullif(v_parsed ->> 'account_id', ''), v_batch.account_id::text),
      'external_id', nullif(v_parsed ->> 'external_id', ''),
      'split_mode', 'personal',
      'payer_participant_id', v_payer,
      'participants', jsonb_build_array(jsonb_build_object('participant_id', v_payer, 'weight', 1)),
      'import_row_id', v_row.id
    );

    v_result := nido.create_transaction(v_payload);
    v_tx_id := (v_result ->> 'id')::uuid;

    update nido.transactions
    set import_row_id = v_row.id
    where id = v_tx_id;

    update nido.import_rows
    set transaction_id = v_tx_id, error = null
    where id = v_row.id;

    v_imported := v_imported + 1;
  end loop;

  update nido.import_batches
  set
    status = 'committed',
    imported_count = v_imported,
    skipped_count = v_skipped,
    committed_at = now()
  where id = p_batch_id;

  return jsonb_build_object(
    'batch_id', p_batch_id,
    'imported', v_imported,
    'skipped', v_skipped
  );
exception
  when others then
    update nido.import_batches
    set status = 'failed'
    where id = p_batch_id;
    raise;
end;
$$;

revoke all on function nido.commit_import(uuid) from public;
grant execute on function nido.commit_import(uuid) to authenticated, service_role;

-- Extend create_transaction to accept import_row_id (ignored during insert; set after).
-- No change needed — commit_import updates import_row_id after create_transaction.

-- ---------------------------------------------------------------------------------------
-- undo_import
-- ---------------------------------------------------------------------------------------

create or replace function nido.undo_import(p_batch_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_batch nido.import_batches;
  v_uid uuid;
  v_count int := 0;
begin
  select * into v_batch
  from nido.import_batches
  where id = p_batch_id
  for update;

  if not found then
    raise exception 'import batch not found' using errcode = 'P0002';
  end if;

  v_uid := nido._assert_contributor(v_batch.space_id);

  if v_batch.status <> 'committed' then
    raise exception 'only committed imports can be undone' using errcode = 'P0001';
  end if;

  if v_batch.committed_at is null or v_batch.committed_at < now() - interval '24 hours' then
    raise exception 'undo window expired' using errcode = 'P0001';
  end if;

  update nido.transactions t
  set deleted_at = now()
  from nido.import_rows r
  where r.batch_id = p_batch_id
    and r.transaction_id = t.id
    and t.deleted_at is null
    and t.space_id = v_batch.space_id;

  get diagnostics v_count = row_count;

  update nido.import_batches
  set status = 'failed', imported_count = 0
  where id = p_batch_id;

  return jsonb_build_object('batch_id', p_batch_id, 'undone', v_count);
end;
$$;

revoke all on function nido.undo_import(uuid) from public;
grant execute on function nido.undo_import(uuid) to authenticated, service_role;

-- Increment rule hit_count when applied during preview (called from app or helper).
create or replace function nido.increment_rule_hit(p_rule_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_space_id uuid;
begin
  select space_id into v_space_id
  from nido.categorization_rules
  where id = p_rule_id;

  if not found or not nido.is_member(v_space_id, array['owner', 'admin', 'member']::nido.member_role[]) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  update nido.categorization_rules
  set hit_count = hit_count + 1
  where id = p_rule_id;
end;
$$;

revoke all on function nido.increment_rule_hit(uuid) from public;
grant execute on function nido.increment_rule_hit(uuid) to authenticated, service_role;

-- Bulk apply a rule to uncategorized transactions.
create or replace function nido.apply_rule_to_ledger(p_rule_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rule nido.categorization_rules;
  v_count int := 0;
begin
  select * into v_rule from nido.categorization_rules where id = p_rule_id;
  if not found then
    raise exception 'rule not found' using errcode = 'P0002';
  end if;

  perform nido._assert_contributor(v_rule.space_id);

  with matched as (
    select t.id
    from nido.transactions t
    where t.space_id = v_rule.space_id
      and t.deleted_at is null
      and t.kind <> 'transfer'
      and t.category_id is null
      and case v_rule.field
        when 'merchant' then coalesce(t.merchant, '')
        when 'notes' then coalesce(t.notes, '')
        else coalesce(t.description, '')
      end is not null
      and case v_rule.match_type
        when 'contains' then position(
          lower(v_rule.pattern) in lower(
            case v_rule.field
              when 'merchant' then coalesce(t.merchant, '')
              when 'notes' then coalesce(t.notes, '')
              else coalesce(t.description, '')
            end
          )
        ) > 0
        when 'starts_with' then lower(
          case v_rule.field
            when 'merchant' then coalesce(t.merchant, '')
            when 'notes' then coalesce(t.notes, '')
            else coalesce(t.description, '')
          end
        ) like lower(v_rule.pattern) || '%'
        when 'exact' then lower(
          case v_rule.field
            when 'merchant' then coalesce(t.merchant, '')
            when 'notes' then coalesce(t.notes, '')
            else coalesce(t.description, '')
          end
        ) = lower(v_rule.pattern)
        when 'regex' then (
          case v_rule.field
            when 'merchant' then coalesce(t.merchant, '')
            when 'notes' then coalesce(t.notes, '')
            else coalesce(t.description, '')
          end
        ) ~* v_rule.pattern
        else false
      end
  )
  update nido.transactions t
  set
    category_id = v_rule.category_id,
    merchant = coalesce(v_rule.set_merchant, t.merchant)
  from matched m
  where t.id = m.id;

  get diagnostics v_count = row_count;

  update nido.categorization_rules
  set hit_count = hit_count + v_count
  where id = p_rule_id;

  return v_count;
end;
$$;

revoke all on function nido.apply_rule_to_ledger(uuid) from public;
grant execute on function nido.apply_rule_to_ledger(uuid) to authenticated, service_role;

-- bank-sync cron (6h)
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

do $$
declare
  v_jobid bigint;
begin
  select jobid into v_jobid from cron.job where jobname = 'bank-sync-6h' limit 1;
  if v_jobid is not null then
    perform cron.unschedule(v_jobid);
  end if;
end;
$$;

select cron.schedule(
  'bank-sync-6h',
  '0 */6 * * *',
  $$
  select net.http_post(
    url := coalesce(
      current_setting('app.settings.supabase_url', true),
      'http://host.docker.internal:54321'
    ) || '/functions/v1/bank-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || coalesce(current_setting('app.settings.cron_secret', true), 'local-dev-cron')
    ),
    body := '{}'::jsonb
  ) as request_id;
  $$
);
