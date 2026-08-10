-- Phase 01 — atomic create_space RPC.

create or replace function nido.create_space(
  p_name text,
  p_kind nido.space_kind,
  p_currency nido.currency_code,
  p_timezone text,
  p_participants jsonb default '[]'::jsonb,
  p_month_starts_on smallint default 1,
  p_week_starts_on smallint default 1,
  p_category_keys text[] default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_space_id uuid;
  v_owner_participant_id uuid;
  v_owner_name text;
  v_ghost jsonb;
  v_idx integer := 1;
  v_color text;
  v_colors text[] := array[
    '#5B8A7A', '#6B8EAD', '#C49A6C', '#9B8EC4', '#D4849A', '#7BA3A8'
  ];
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  if p_name is null or char_length(trim(p_name)) < 1 or char_length(trim(p_name)) > 80 then
    raise exception 'invalid space name' using errcode = '22023';
  end if;

  if p_month_starts_on < 1 or p_month_starts_on > 28 then
    raise exception 'invalid month_starts_on' using errcode = '22023';
  end if;

  if p_week_starts_on < 0 or p_week_starts_on > 6 then
    raise exception 'invalid week_starts_on' using errcode = '22023';
  end if;

  select display_name into v_owner_name from nido.profiles where id = v_uid;
  if v_owner_name is null then
    raise exception 'profile not found' using errcode = 'P0001';
  end if;

  insert into nido.spaces (
    name, kind, base_currency, timezone, month_starts_on, week_starts_on, created_by
  ) values (
    trim(p_name), p_kind, p_currency, coalesce(nullif(trim(p_timezone), ''), 'Europe/Madrid'),
    p_month_starts_on, p_week_starts_on, v_uid
  )
  returning id into v_space_id;

  insert into nido.participants (space_id, user_id, display_name, color, position)
  values (v_space_id, v_uid, v_owner_name, v_colors[1], 0)
  returning id into v_owner_participant_id;

  insert into nido.space_members (space_id, user_id, participant_id, role, status)
  values (v_space_id, v_uid, v_owner_participant_id, 'owner', 'active');

  if p_participants is not null and jsonb_typeof(p_participants) = 'array' then
    for v_ghost in select * from jsonb_array_elements(p_participants)
    loop
      v_color := coalesce(
        nullif(v_ghost ->> 'color', ''),
        v_colors[(v_idx % array_length(v_colors, 1)) + 1]
      );
      insert into nido.participants (space_id, user_id, display_name, color, position)
      values (
        v_space_id,
        null,
        left(trim(coalesce(v_ghost ->> 'display_name', v_ghost ->> 'name', 'Member')), 60),
        v_color,
        v_idx::smallint
      );
      v_idx := v_idx + 1;
    end loop;
  end if;

  perform nido.seed_default_categories(v_space_id, p_category_keys);

  update nido.profiles
  set last_active_space_id = v_space_id
  where id = v_uid;

  return v_space_id;
end;
$$;

comment on function nido.create_space is
  'Atomically creates a space, owner participant + membership, ghosts, and default categories.';

revoke all on function nido.create_space(
  text, nido.space_kind, nido.currency_code, text, jsonb, smallint, smallint, text[]
) from public;
grant execute on function nido.create_space(
  text, nido.space_kind, nido.currency_code, text, jsonb, smallint, smallint, text[]
) to authenticated, service_role;
