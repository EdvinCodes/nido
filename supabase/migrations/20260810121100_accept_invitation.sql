-- Phase 01 — accept_invitation RPC. Generic errors; token compared via hash lookup.

create or replace function nido.accept_invitation(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_hash text;
  v_invite nido.space_invitations%rowtype;
  v_participant_id uuid;
  v_display_name text;
begin
  if v_uid is null then
    raise exception 'invitation is invalid or expired' using errcode = 'P0001';
  end if;

  if p_token is null or char_length(p_token) < 16 then
    raise exception 'invitation is invalid or expired' using errcode = 'P0001';
  end if;

  v_hash := encode(extensions.digest(convert_to(p_token, 'UTF8'), 'sha256'), 'hex');

  select * into v_invite
  from nido.space_invitations i
  where i.token_hash = v_hash
  for update;

  if not found
     or v_invite.revoked_at is not null
     or v_invite.accepted_at is not null
     or v_invite.expires_at <= now() then
    perform 1 from nido.profiles where id = v_uid;
    raise exception 'invitation is invalid or expired' using errcode = 'P0001';
  end if;

  if v_invite.email is not null then
    if lower((select email from auth.users where id = v_uid)) is distinct from lower(v_invite.email::text) then
      raise exception 'invitation is invalid or expired' using errcode = 'P0001';
    end if;
  end if;

  if exists (
    select 1 from nido.space_members m
    where m.space_id = v_invite.space_id
      and m.user_id = v_uid
      and m.status = 'active'
  ) then
    update nido.space_invitations
    set accepted_at = now(), accepted_by = v_uid
    where id = v_invite.id and accepted_at is null;

    update nido.profiles set last_active_space_id = v_invite.space_id where id = v_uid;
    return v_invite.space_id;
  end if;

  select display_name into v_display_name from nido.profiles where id = v_uid;

  if v_invite.participant_id is not null then
    update nido.participants
    set user_id = v_uid,
        display_name = coalesce(v_display_name, display_name),
        is_active = true
    where id = v_invite.participant_id
      and space_id = v_invite.space_id
    returning id into v_participant_id;
  end if;

  if v_participant_id is null then
    insert into nido.participants (space_id, user_id, display_name, position)
    values (
      v_invite.space_id,
      v_uid,
      coalesce(v_display_name, 'Member'),
      coalesce(
        (select max(p.position) + 1 from nido.participants p where p.space_id = v_invite.space_id),
        0
      )
    )
    returning id into v_participant_id;
  end if;

  insert into nido.space_members (space_id, user_id, participant_id, role, status)
  values (v_invite.space_id, v_uid, v_participant_id, v_invite.role, 'active')
  on conflict (space_id, user_id) do update
    set role = excluded.role,
        status = 'active',
        participant_id = excluded.participant_id,
        joined_at = now();

  update nido.space_invitations
  set accepted_at = now(), accepted_by = v_uid
  where id = v_invite.id;

  update nido.profiles set last_active_space_id = v_invite.space_id where id = v_uid;

  return v_invite.space_id;
end;
$$;

comment on function nido.accept_invitation(text) is
  'Accepts a raw invite token. Always raises a generic error on failure.';

revoke all on function nido.accept_invitation(text) from public;
grant execute on function nido.accept_invitation(text) to authenticated, service_role;

create or replace function nido.hash_invite_token(p_token text)
returns text
language sql
immutable
set search_path = ''
as $$
  select encode(extensions.digest(convert_to(p_token, 'UTF8'), 'sha256'), 'hex');
$$;

revoke all on function nido.hash_invite_token(text) from public;
grant execute on function nido.hash_invite_token(text) to authenticated, service_role;
