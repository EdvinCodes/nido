-- Drop SQL fingerprint trigger (FNV-1a64 uint64 wrap is unsafe in signed bigint).
-- find_duplicate matches on normalized text + amount + date window instead.

drop trigger if exists transactions_fingerprint on nido.transactions;

create or replace function nido.find_duplicate(
  p_space_id uuid,
  p_fingerprint text,
  p_booked_on date,
  p_amount bigint,
  p_external_id text default null,
  p_normalized_text text default null
)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_match uuid;
  v_norm text;
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

  v_norm := coalesce(nullif(trim(lower(p_normalized_text)), ''), '');

  if v_norm <> '' then
    select t.id into v_match
    from nido.transactions t
    where t.space_id = p_space_id
      and t.amount_minor = p_amount
      and t.booked_on between p_booked_on - 3 and p_booked_on + 3
      and t.deleted_at is null
      and coalesce(
        nullif(nido._normalize_fingerprint_text(t.merchant), ''),
        nido._normalize_fingerprint_text(t.description)
      ) = v_norm
    order by abs(t.booked_on - p_booked_on), t.created_at
    limit 1;
  end if;

  if v_match is null and p_fingerprint is not null then
    select t.id into v_match
    from nido.transactions t
    where t.space_id = p_space_id
      and t.fingerprint = p_fingerprint
      and t.amount_minor = p_amount
      and t.booked_on between p_booked_on - 3 and p_booked_on + 3
      and t.deleted_at is null
    order by abs(t.booked_on - p_booked_on), t.created_at
    limit 1;
  end if;

  return v_match;
end;
$$;

revoke all on function nido.find_duplicate(uuid, text, date, bigint, text, text) from public;
grant execute on function nido.find_duplicate(uuid, text, date, bigint, text, text) to authenticated, service_role;

-- Drop old 5-arg overload if present.
drop function if exists nido.find_duplicate(uuid, text, date, bigint, text);
